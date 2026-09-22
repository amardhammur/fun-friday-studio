import { ArrowRight, ShieldCheck, Sparkles } from 'lucide-react';
import { DropZone } from '../../../src/components/DropZone';
import { alignChildhood, loadDemo, storePhoto } from '../logic/preparation';
import type { Context } from '../types';
import type { CVEventUpdate } from '../types';
export function UploadStep({ segment, event, update, updateEvent, runTask, notify }: Context) {
  const upload = (side: 'now' | 'then', file: File) => runTask('Opening your photo…', async () => {
    if (event.facePairs.length && !event.isDemo && !window.confirm('Replacing a group photo resets face matches and game progress. Continue?')) return;
    const stored = await storePhoto(file, file.name);
    let nextSegment = structuredClone(segment), nextEvent: CVEventUpdate = structuredClone({ ...event, people: [...event.people], facePairs: [...event.facePairs], teams: [...event.teams], scoreEntries: [...event.scoreEntries], assets: { ...event.assets } });
    if (nextEvent.isDemo) { nextSegment.game.originalImageId = undefined; nextSegment.game.childhoodImageId = undefined; nextSegment.game.childhoodUploadId = undefined; nextSegment.game.previews = {}; nextEvent.assets = {}; }
    nextEvent.isDemo = false; nextEvent.facePairs = []; nextEvent.people = []; nextEvent.scoreEntries = []; nextSegment.game.rounds = []; nextSegment.game.currentRoundIndex = 0;
    nextEvent.assets[stored.asset.id] = stored.asset; nextEvent.assets[stored.preview.id] = stored.preview;
    nextSegment.game.previews[stored.asset.id] = stored.preview.id;
    if (side === 'now') nextSegment.game.originalImageId = stored.asset.id;
    else { nextSegment.game.childhoodUploadId = stored.asset.id; nextSegment.game.childhoodImageId = stored.asset.id; }
    const aligned = await alignChildhood(nextSegment, nextEvent as CVEventUpdate); nextSegment = aligned.segment; nextEvent = aligned.event; update(s => Object.assign(s, nextSegment)); updateEvent(e => Object.assign(e, nextEvent));
    notify('Photo saved on this laptop.');
  });
  const nowId = segment.game.originalImageId, thenId = segment.game.childhoodImageId;
  return <div className="setup-content"><div className="section-heading"><span className="eyebrow">01 / THE TEAM PHOTOS</span><h1>Let’s turn back the clock<span className="accent">.</span></h1><p>Same people. Same places. A few decades apart.</p></div>
    <div className="upload-grid"><DropZone label="THE GROWN-UPS" title="Original group photo (now)" subtitle="Your team, just as they are today." imageId={nowId && (segment.game.previews[nowId] || nowId)} onFile={f => void upload('now', f)}/><DropZone label="THE LITTLE ONES" title="Childhood group photo (then)" subtitle="The same photo, already edited into 5–6 year olds." imageId={thenId && (segment.game.previews[thenId] || thenId)} onFile={f => void upload('then', f)}/></div>
    <div className="info-strip"><ShieldCheck size={20}/><span>Your photos stay on this laptop. Full resolution is preserved; different image sizes are aligned automatically.</span></div>
    <div className="setup-footer"><button className="button subtle" onClick={() => void runTask('Drawing your demo team…', async () => { const next = await loadDemo(segment, { ...event, people: [...event.people], facePairs: [...event.facePairs], teams: [...event.teams], scoreEntries: [...event.scoreEntries], assets: { ...event.assets } }); update(s => Object.assign(s, next.segment)); updateEvent(e => Object.assign(e, next.event)); })}><Sparkles size={17}/> Use demo photos</button><button className="button primary" disabled={!nowId || !thenId} onClick={() => update(s => { s.setupStepId = 'match'; })}>Match people <ArrowRight size={18}/></button></div>
  </div>;
}
