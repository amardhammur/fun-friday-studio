import type { Asset, FaceCrop, FacePair, Rect } from '../../../src/core/types';
import { imageStore } from '../../../src/core/storage';
import { cropMany, rpc, inspectImage, scaleImage } from '../../../src/core/images/client';
import { defaultPadding } from '../../../src/core/images/math';
import { teamColors } from '../../../src/core/session';
import { pairFaces } from './pairing';
import type { CVSession } from '../types';
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
export function syncPeople(session: CVSession) {
  session.people = session.facePairs.map(pair => {
    const existing = session.people.find(p => p.facePairId === pair.id);
    return existing ? { ...existing, included: Boolean(pair.now && pair.then && existing.included) } : { id: crypto.randomUUID(), facePairId: pair.id, name: '', funFact: '', included: Boolean(pair.now && pair.then) };
  });
}
export async function prepareCrops(session: CVSession, progress?: (s: string) => void) {
  const updated = structuredClone(session);
  const groups = new Map<string, { face: FaceCrop; label: string }[]>();
  for (const pair of updated.facePairs) for (const side of ['now', 'then'] as const) {
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
      entries[i].face.cropImageId = asset.id; updated.assets[asset.id] = asset;
    }
  }
  return updated;
}
export async function alignChildhood(session: CVSession) {
  const now = session.game.originalImageId && session.assets[session.game.originalImageId];
  const upload = session.game.childhoodUploadId && session.assets[session.game.childhoodUploadId];
  if (!now || !upload) return session;
  const updated = structuredClone(session);
  if (now.width === upload.width && now.height === upload.height) { updated.game.childhoodImageId = upload.id; return updated; }
  const blob = await scaleImage(await imageStore.get(upload.id), now.width, now.height);
  const { asset, preview } = await storePhoto(blob, 'Childhood - aligned.jpg');
  updated.assets[asset.id] = asset; updated.assets[preview.id] = preview;
  updated.game.childhoodImageId = asset.id; updated.game.previews[asset.id] = preview.id;
  return updated;
}
export async function loadDemo(session: CVSession): Promise<CVSession> {
  const demo = await demoJob<{ now: Blob; then: Blob; nowFaces: Rect[]; thenFaces: Rect[]; width: number; height: number }>({ type: 'demo' });
  const now = await storePhoto(demo.now, 'Demo class - now.jpg'), then = await storePhoto(demo.then, 'Demo class - then.jpg');
  const next = structuredClone(session);
  for (const a of [now.asset, now.preview, then.asset, then.preview]) next.assets[a.id] = a;
  next.game.originalImageId = now.asset.id; next.game.childhoodImageId = then.asset.id; next.game.childhoodUploadId = then.asset.id;
  next.game.previews = { [now.asset.id]: now.preview.id, [then.asset.id]: then.preview.id };
  next.facePairs = makePairs(demo.nowFaces, demo.thenFaces, now.asset.id, then.asset.id, .2);
  next.facePairs.forEach(p => { p.reviewStatus = 'confirmed'; }); syncPeople(next);
  const names = ['Asha', 'Leo', 'Maya', 'Dev']; const facts = ['Still the first one on the dance floor.', 'Has never met a puzzle he could resist.', 'The unofficial keeper of the snack drawer.', 'Always has a good story for the lunch table.'];
  next.people.forEach((p, i) => { p.name = names[i]; p.funFact = facts[i]; });
  next.isDemo = true;
  next.phase = 'setup'; next.setupStepId = 'upload'; next.game.rounds = []; next.game.currentRoundIndex = 0; next.scoreEntries = [];
  return prepareCrops(next);
}
