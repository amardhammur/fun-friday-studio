import type { PreparedActivity, Rect } from '../../../src/core/types';
import { rpc } from '../../../src/core/images/client';
import { createPhotoSet } from '../../../src/core/people/photo-sets';
import { makePairs, prepareCrops, storePhoto, syncPeople } from '../../../src/core/people/photos';
import type { CVEventUpdate, CVSession, GameState, Settings } from '../types';
const demoJob = rpc(() => new Worker(new URL('../demo/demo.worker.ts', import.meta.url), { type: 'module' }));
export async function loadDemo(segment: CVSession, event: CVEventUpdate): Promise<PreparedActivity<Settings, GameState>> {
  const demo = await demoJob<{ now: Blob; then: Blob; nowFaces: Rect[]; thenFaces: Rect[]; width: number; height: number }>({ type: 'demo' });
  const now = await storePhoto(demo.now, 'Demo team - now.jpg'), then = await storePhoto(demo.then, 'Demo team - then.jpg');
  const next = structuredClone(segment), nextEvent = structuredClone(event);
  for (const a of [now.asset, now.preview, then.asset, then.preview]) nextEvent.assets[a.id] = a;
  nextEvent.photoSets = [];
  const set = createPhotoSet(nextEvent, 'Demo team', 'group');
  set.nowImageId = now.asset.id; set.thenImageId = then.asset.id;
  set.previews = { [now.asset.id]: now.preview.id, [then.asset.id]: then.preview.id };
  nextEvent.facePairs = makePairs(demo.nowFaces, demo.thenFaces, set, .2);
  nextEvent.facePairs.forEach(p => { p.reviewStatus = 'confirmed'; }); nextEvent.people = []; syncPeople(nextEvent);
  const names = ['Asha', 'Leo', 'Maya', 'Dev']; const facts = ['Still the first one on the dance floor.', 'Has never met a puzzle he could resist.', 'The unofficial keeper of the snack drawer.', 'Always has a good story for the lunch table.'];
  nextEvent.people.forEach((p, i) => { p.name = names[i]; p.funFact = facts[i]; });
  nextEvent.isDemo = true;
  nextEvent.phase = 'segment'; next.setupStepId = 'upload'; next.game.rounds = []; next.game.currentRoundIndex = 0; nextEvent.scoreEntries = [];
  return { segment: next, event: await prepareCrops(nextEvent) };
}
