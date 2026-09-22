import { ArrowRight, ShieldCheck, Sparkles } from 'lucide-react';
import { DropZone } from '../../../src/components/DropZone';
import { alignChildhood, loadDemo, storePhoto } from '../logic/preparation';
import type { Context } from '../types';
export function UploadStep({ session, update, runTask, notify }: Context) {
  const upload = (side: 'now' | 'then', file: File) => runTask('Opening your photo…', async () => {
    if (session.facePairs.length && !session.isDemo && !window.confirm('Replacing a group photo resets face matches and game progress. Continue?')) return;
    const stored = await storePhoto(file, file.name);
    let next = structuredClone(session);
    if (next.isDemo) { next.game.originalImageId = undefined; next.game.childhoodImageId = undefined; next.game.childhoodUploadId = undefined; next.game.previews = {}; next.assets = {}; }
    next.isDemo = false; next.facePairs = []; next.people = []; next.scoreEntries = []; next.game.rounds = []; next.game.currentRoundIndex = 0;
    next.assets[stored.asset.id] = stored.asset; next.assets[stored.preview.id] = stored.preview;
    next.game.previews[stored.asset.id] = stored.preview.id;
    if (side === 'now') next.game.originalImageId = stored.asset.id;
    else { next.game.childhoodUploadId = stored.asset.id; next.game.childhoodImageId = stored.asset.id; }
    next = await alignChildhood(next); update(s => Object.assign(s, next));
    notify('Photo saved on this laptop.');
  });
  const nowId = session.game.originalImageId, thenId = session.game.childhoodImageId;
  return <div className="setup-content"><div className="section-heading"><span className="eyebrow">01 / THE CLASS PHOTOS</span><h1>Let’s turn back the clock<span className="accent">.</span></h1><p>Same people. Same places. A few decades apart.</p></div>
    <div className="upload-grid"><DropZone label="THE GROWN-UPS" title="Original group photo (now)" subtitle="Your team, just as they are today." imageId={nowId && (session.game.previews[nowId] || nowId)} onFile={f => void upload('now', f)}/><DropZone label="THE LITTLE ONES" title="Childhood group photo (then)" subtitle="The same photo, already edited into 5–6 year olds." imageId={thenId && (session.game.previews[thenId] || thenId)} onFile={f => void upload('then', f)}/></div>
    <div className="info-strip"><ShieldCheck size={20}/><span>Your photos stay on this laptop. Full resolution is preserved; different image sizes are aligned automatically.</span></div>
    <div className="setup-footer"><button className="button subtle" onClick={() => void runTask('Drawing your demo class…', async () => { const next = await loadDemo(session); update(s => Object.assign(s, next)); })}><Sparkles size={17}/> Use demo photos</button><button className="button primary" disabled={!nowId || !thenId} onClick={() => update(s => { s.setupStepId = 'match'; })}>Match people <ArrowRight size={18}/></button></div>
  </div>;
}
