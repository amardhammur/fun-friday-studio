import { useState } from 'react';
import { ArrowRight, ScanFace, MousePointer2, Link, SquarePlus, Layers, Columns2, Trash2, Check, AlertTriangle } from 'lucide-react';
import { PhotoEditor, type EditorMode } from '../../../components/PhotoEditor';
import { detectFaces } from '../../images/client';
import { imageStore } from '../../storage';
import { clampRect, defaultPadding } from '../../images/math';
import { teamColors } from '../../event';
import type { Rect } from '../../types';
import { intersectionOverUnion } from '../pairing';
import { defaultIncluded, nextPairNumber } from '../photo-sets';
import { makePairs, prepareCrops, syncPeople } from '../photos';
import { libraryDraft, type LibraryContext } from './context';
type Props = { ctx: LibraryContext; setId: string; onBack: () => void; onNext: () => void; nextLabel: string };
export function SetMatch({ ctx, setId, onBack, onNext, nextLabel }: Props) {
  const { event, updateEvent, runTask, notify } = ctx;
  const [mode, setMode] = useState<EditorMode>('select'), [overlay, setOverlay] = useState(false), [opacity, setOpacity] = useState(.5), [tolerance, setTolerance] = useState(.12);
  const [selected, setSelected] = useState<string>(), [side, setSide] = useState<'now' | 'then'>('now');
  const [pending, setPending] = useState<{ id: string; side: 'now' | 'then' }>();
  const [progress, setProgress] = useState('');
  const set = event.photoSets.find(s => s.id === setId), single = set?.kind === 'single';
  const nowId = set?.nowImageId ?? '', thenId = set?.thenImageId ?? '', now = event.assets[nowId], then = event.assets[thenId];
  if (!set || !now || !then) return <div className="empty-state"><h2>Two photos, one time machine.</h2><p>Upload both photos first.</p><button className="button primary" onClick={onBack}>Upload photos</button></div>;
  const pairs = event.facePairs.filter(p => p.setId === setId);
  const pair = pairs.find(p => p.id === selected), face = pair?.[side];
  const unmatched = pairs.filter(p => !p.now || !p.then).length;
  const select = (id: string, clickedSide: 'now' | 'then') => {
    setSelected(id); setSide(clickedSide);
    if (mode !== 'pair') return;
    if (!pending || pending.side === clickedSide) { setPending({ id, side: clickedSide }); return; }
    updateEvent(s => {
      const previouslyComplete = new Set(s.facePairs.filter(p => p.now && p.then).map(p => p.id));
      const nowPair = s.facePairs.find(p => p.id === (clickedSide === 'now' ? id : pending.id))!;
      const thenPair = s.facePairs.find(p => p.id === (clickedSide === 'then' ? id : pending.id))!;
      if (nowPair.id !== thenPair.id) [nowPair.then, thenPair.then] = [thenPair.then, nowPair.then];
      for (const p of [nowPair, thenPair]) { p.matchMethod = 'manual'; p.reviewStatus = p.now && p.then ? 'confirmed' : 'unmatched'; }
      s.facePairs = s.facePairs.filter(p => p.now || p.then); syncPeople(s);
      for (const person of s.people) { const p = s.facePairs.find(p => p.id === person.facePairId)!; if (p.now && p.then && !previouslyComplete.has(p.id)) person.included = defaultIncluded(s); }
    }); setPending(undefined); notify('Pair connected.');
  };
  const change = (id: string, imageSide: 'now' | 'then', rect: Rect) => updateEvent(s => {
    const p = s.facePairs.find(p => p.id === id)!; const f = p[imageSide]!;
    f.faceBox = clampRect(rect); f.cropImageId = undefined; p.matchMethod = 'manual';
  });
  const add = (imageSide: 'now' | 'then', rect: Rect) => {
    const id = crypto.randomUUID(), number = nextPairNumber(event.facePairs);
    updateEvent(s => { s.facePairs.push({ id, number, color: teamColors[(number - 1) % teamColors.length], setId, [imageSide]: { sourceImageId: imageSide === 'now' ? nowId : thenId, faceBox: rect, padding: { ...defaultPadding } }, matchMethod: 'manual', reviewStatus: 'unmatched' }); syncPeople(s); });
    setSelected(id); setSide(imageSide); setMode('pair'); setPending({ id, side: imageSide });
  };
  const detect = () => runTask('Finding the faces in your team…', async () => {
    try {
      setProgress('Loading the local face detector…');
      const nowFaces = await detectFaces(await imageStore.get(nowId), setProgress);
      const thenFaces = await detectFaces(await imageStore.get(thenId), setProgress);
      const locked = pairs.filter(p => p.matchMethod === 'manual' || p.reviewStatus === 'confirmed'), others = event.facePairs.filter(p => p.setId !== setId);
      const newNow = nowFaces.filter(r => !locked.some(p => p.now && intersectionOverUnion(p.now.faceBox, r) > .2));
      const newThen = thenFaces.filter(r => !locked.some(p => p.then && intersectionOverUnion(p.then.faceBox, r) > .2));
      const added = makePairs(newNow, newThen, set, tolerance, nextPairNumber([...others, ...locked]));
      updateEvent(s => { s.facePairs = [...others, ...locked, ...added]; syncPeople(s); });
      notify(added.length ? `Found ${nowFaces.length} current and ${thenFaces.length} childhood faces. Review the suggested matches.` : 'No new faces found. Use “Add face” to draw any missed faces.');
    } finally { setProgress(''); }
  });
  const aspect = (imageSide: 'now' | 'then') => imageSide === 'now' ? now.width / now.height : then.width / then.height;
  const editor = (imageSide: 'now' | 'then', isOverlay = false) => <PhotoEditor imageId={set.previews[isOverlay || imageSide === 'now' ? nowId : thenId] || (imageSide === 'now' ? nowId : thenId)} overlayId={isOverlay ? set.previews[thenId] || thenId : undefined} overlayOpacity={opacity} aspect={isOverlay ? aspect('now') : aspect(imageSide)} pairs={pairs} side={imageSide} mode={mode} selected={selected} onSelect={select} onChange={(id, rect) => change(id, imageSide, rect)} onAdd={rect => add(imageSide, rect)}/>;
  return <div className="setup-content wide"><div className="section-heading"><span className="eyebrow">02 / CONNECT THE DOTS</span><h1>{single ? 'Frame the face' : 'Same smile, different year'}<span className="accent">.</span></h1><p>{single ? 'Drag each box so it sits snugly around the face.' : 'Find the faces. Check the pairs. Make everyone part of the story.'}</p></div>
    {!single && <div className="match-toolbar"><button className="button primary" onClick={() => void detect()}><ScanFace size={18}/> Detect faces</button><div className="segmented">{([{ value: 'select', label: 'Adjust', Icon: MousePointer2 }, { value: 'add', label: 'Add face', Icon: SquarePlus }, { value: 'pair', label: 'Pair faces', Icon: Link }] as const).map(({ value, label, Icon }) => <button key={value} aria-pressed={mode === value} onClick={() => { setMode(value); setPending(undefined); }}><Icon size={16}/>{label}</button>)}</div><div className="segmented"><button aria-pressed={!overlay} onClick={() => setOverlay(false)}><Columns2 size={17}/> Side by side</button><button aria-pressed={overlay} onClick={() => setOverlay(true)}><Layers size={17}/> Overlay</button></div></div>}
    <p className="instruction">{progress || (mode === 'add' ? 'Draw a box around a face. Then click its partner in the other photo.' : mode === 'pair' ? pending ? `Now click the matching face in the ${pending.side === 'now' ? 'childhood' : 'original'} photo.` : 'Click one face in each photo to connect them. Existing partners are swapped.' : 'Click a face to select it. Drag its box to move; drag the bottom-right handle to resize.')}</p>
    {overlay && !single ? <div className="overlay-editor"><div className="overlay-controls"><label>Childhood opacity <input aria-label="Childhood overlay opacity" type="range" min="0" max="1" step=".05" value={opacity} onChange={e => setOpacity(+e.target.value)}/></label><div className="segmented"><button aria-pressed={side === 'now'} onClick={() => setSide('now')}>Edit now</button><button aria-pressed={side === 'then'} onClick={() => setSide('then')}>Edit then</button></div></div>{editor(side, true)}</div> : <div className="photo-pair-grid"><div><div className="photo-label"><span>THE GROWN-UPS</span><b>Now</b></div>{editor('now')}</div><div><div className="photo-label"><span>THE LITTLE ONES</span><b>Then</b></div>{editor('then')}</div></div>}
    {!single && <div className="match-details"><div className="match-summary"><strong>{pairs.filter(p => p.now && p.then).length} pairs</strong><span className={unmatched ? 'warning-text' : 'mint-text'}>{unmatched ? <><AlertTriangle size={16}/> {unmatched} unmatched — pair or remove these faces</> : <><Check size={16}/> All faces paired</>}</span></div><label className="tolerance">Match tolerance <input aria-label="Match tolerance" type="range" min=".02" max=".25" step=".01" value={tolerance} onChange={e => setTolerance(+e.target.value)}/><span>{Math.round(tolerance * 100)}%</span></label></div>}
    {face && pair && <div className="crop-controls"><strong>Face {pair.number} · {side}</strong>{(['x', 'y', 'width', 'height'] as const).map(key => <label key={key}>{key}<input aria-label={`Crop ${key}`} type="number" step=".1" min="0" max="100" value={+(face.faceBox[key] * 100).toFixed(1)} onChange={e => change(pair.id, side, { ...face.faceBox, [key]: +e.target.value / 100 })}/></label>)}{!single && <><button className="button subtle" onClick={() => updateEvent(s => { const p = s.facePairs.find(p => p.id === pair.id)!; if (p.now && p.then) p.reviewStatus = 'confirmed'; })} disabled={!pair.now || !pair.then}><Check size={16}/> Confirm pair</button><button className="button danger subtle" onClick={() => { updateEvent(s => { const p = s.facePairs.find(p => p.id === pair.id)!; delete p[side]; p.reviewStatus = 'unmatched'; s.facePairs = s.facePairs.filter(f => f.now || f.then); syncPeople(s); }); setSelected(undefined); }}><Trash2 size={16}/> Delete this face</button></>}</div>}
    <div className="setup-footer"><button className="button subtle" onClick={onBack}>{single ? 'Back' : 'Back to photos'}</button><button className="button primary" disabled={!pairs.some(p => p.now && p.then)} onClick={() => void runTask('Preparing your face pairs…', async () => { const next = await prepareCrops(libraryDraft(event)); updateEvent(s => Object.assign(s, next)); onNext(); })}>{nextLabel} <ArrowRight size={18}/></button></div>
  </div>;
}
