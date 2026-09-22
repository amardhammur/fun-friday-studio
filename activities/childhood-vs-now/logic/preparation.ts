import type { Asset, FaceCrop, FacePair, Rect, EventUpdate, ActivitySegment, PreparedActivity } from '../../../src/core/types';
import { imageStore } from '../../../src/core/storage';
import { cropMany, rpc, inspectImage, scaleImage } from '../../../src/core/images/client';
import { defaultPadding } from '../../../src/core/images/math';
import { teamColors } from '../../../src/core/session';
import { pairFaces } from './pairing';
import type { CVEventUpdate, CVSession, GameState, Settings } from '../types';
const demoJob = rpc(() => new Worker(new URL('../demo/demo.worker.ts', import.meta.url), { type: 'module' }));
export async function storeAsset(blob: Blob, name: string, width: number, height: number): Promise<Asset> {
  const id = await imageStore.put(blob); return { id, name, width, height, mime: blob.type || 'application/octet-stream' };
}
export async function storePhoto(blob: Blob, name: string) {
  const info = await inspectImage(blob);
  const asset = await storeAsset(blob, name, info.width, info.height);
  const scale = Math.min(1, 1600 / Math.max(info.width, info.height));
  const preview = await storeAsset(info.preview, `Preview - ${name}`, Math.round(info.width * scale), Math.round(info.height * scale));
  return { asset, preview };
}
export function makePairs(now: Rect[], then: Rect[], nowId: string, thenId: string, tolerance: number): FacePair[] {
  return pairFaces(now, then, tolerance).map((match, i) => ({ id: crypto.randomUUID(), number: i + 1, color: teamColors[i % teamColors.length], now: match.now === undefined ? undefined : { sourceImageId: nowId, faceBox: now[match.now], padding: { ...defaultPadding } }, then: match.then === undefined ? undefined : { sourceImageId: thenId, faceBox: then[match.then], padding: { ...defaultPadding } }, matchMethod: 'automatic', reviewStatus: match.now !== undefined && match.then !== undefined ? 'suggested' : 'unmatched' }));
}
export function syncPeople(event: CVEventUpdate) {
  event.people = event.facePairs.map(pair => {
    const existing = event.people.find(p => p.facePairId === pair.id);
    return existing ? { ...existing, included: Boolean(pair.now && pair.then && existing.included) } : { id: crypto.randomUUID(), facePairId: pair.id, name: '', funFact: '', included: Boolean(pair.now && pair.then) };
  });
}
export async function prepareCrops(segment: CVSession, event: CVEventUpdate, progress?: (s: string) => void): Promise<PreparedActivity<Settings, GameState>> {
  const updated = structuredClone(segment), updatedEvent = structuredClone(event);
  const groups = new Map<string, { face: FaceCrop; label: string }[]>();
  for (const pair of updatedEvent.facePairs) for (const side of ['now', 'then'] as const) {
    const face = pair[side]; if (!face || face.cropImageId) continue;
    const entries = groups.get(face.sourceImageId) ?? [];
    entries.push({ face, label: `Face ${pair.number} - ${side}.jpg` }); groups.set(face.sourceImageId, entries);
  }
  // Decode each source just once, even for a 50-person group.
  for (const [source, entries] of groups) {
    progress?.(`Preparing ${entries.length} face crops…`);
    const crops = await cropMany(await imageStore.get(source), entries.map(e => e.face));
    for (let i = 0; i < crops.length; i++) {
      const crop = crops[i], asset = await storeAsset(crop.blob, entries[i].label, crop.width, crop.height);
    entries[i].face.cropImageId = asset.id; updatedEvent.assets[asset.id] = asset;
    }
  }
  return { segment: updated, event: updatedEvent };
}
export async function alignChildhood(segment: CVSession, event: CVEventUpdate): Promise<PreparedActivity<Settings, GameState>> {
  const now = segment.game.originalImageId && event.assets[segment.game.originalImageId];
  const upload = segment.game.childhoodUploadId && event.assets[segment.game.childhoodUploadId];
  if (!now || !upload) return { segment, event };
  const updated = structuredClone(segment), updatedEvent = structuredClone(event);
  if (now.width === upload.width && now.height === upload.height) { updated.game.childhoodImageId = upload.id; return { segment: updated, event: updatedEvent }; }
  const blob = await scaleImage(await imageStore.get(upload.id), now.width, now.height);
  const { asset, preview } = await storePhoto(blob, 'Childhood - aligned.jpg');
  updatedEvent.assets[asset.id] = asset; updatedEvent.assets[preview.id] = preview;
  updated.game.childhoodImageId = asset.id; updated.game.previews[asset.id] = preview.id;
  return { segment: updated, event: updatedEvent };
}
export async function loadDemo(segment: CVSession, event: CVEventUpdate): Promise<PreparedActivity<Settings, GameState>> {
  const demo = await demoJob<{ now: Blob; then: Blob; nowFaces: Rect[]; thenFaces: Rect[]; width: number; height: number }>({ type: 'demo' });
  const now = await storePhoto(demo.now, 'Demo team - now.jpg'), then = await storePhoto(demo.then, 'Demo team - then.jpg');
  const next = structuredClone(segment), nextEvent = structuredClone(event);
  for (const a of [now.asset, now.preview, then.asset, then.preview]) nextEvent.assets[a.id] = a;
  next.game.originalImageId = now.asset.id; next.game.childhoodImageId = then.asset.id; next.game.childhoodUploadId = then.asset.id;
  next.game.previews = { [now.asset.id]: now.preview.id, [then.asset.id]: then.preview.id };
  nextEvent.facePairs = makePairs(demo.nowFaces, demo.thenFaces, now.asset.id, then.asset.id, .2);
  nextEvent.facePairs.forEach(p => { p.reviewStatus = 'confirmed'; }); syncPeople(nextEvent);
  const names = ['Asha', 'Leo', 'Maya', 'Dev']; const facts = ['Still the first one on the dance floor.', 'Has never met a puzzle he could resist.', 'The unofficial keeper of the snack drawer.', 'Always has a good story for the lunch table.'];
  nextEvent.people.forEach((p, i) => { p.name = names[i]; p.funFact = facts[i]; });
  nextEvent.isDemo = true;
  nextEvent.phase = 'segment'; next.setupStepId = 'upload'; next.game.rounds = []; next.game.currentRoundIndex = 0; nextEvent.scoreEntries = [];
  return prepareCrops(next, nextEvent);
}
