import { useState } from 'react';
import { ArrowRight } from 'lucide-react';
import { createPhotoSet } from '../photo-sets';
import type { LibraryContext } from './context';
import { SetMatch } from './SetMatch';
import { SetNames } from './SetNames';
import { SetUpload } from './SetUpload';
type Props = { ctx: LibraryContext; setId?: string; doneLabel: string; onDone: () => void; onCancel?: () => void };
// Name → photos → matches → names. A set only exists once it is named, so every later screen can
// rely on it being in the event.
export function GroupWizard({ ctx, setId: initial, doneLabel, onDone, onCancel }: Props) {
  const [setId, setSetId] = useState(initial), [step, setStep] = useState<'upload' | 'match' | 'names'>('upload');
  const [name, setName] = useState(() => `Group ${ctx.event.photoSets.filter(s => s.kind === 'group').length + 1}`);
  const set = ctx.event.photoSets.find(s => s.id === setId);
  const create = () => { let created = ''; ctx.updateEvent(e => { created = createPhotoSet(e, name, 'group').id; }); if (created) setSetId(created); };
  if (!set) return <div className="setup-content"><div className="section-heading"><span className="eyebrow">A NEW GROUP</span><h1>Name this group<span className="accent">.</span></h1><p>A team, a year or an offsite — something you will recognise later.</p></div><label className="group-name-field"><span className="eyebrow">GROUP NAME</span><input aria-label="Group name" maxLength={80} value={name} onChange={e => setName(e.target.value)}/></label><div className="setup-footer">{onCancel ? <button className="button subtle" onClick={onCancel}>Cancel</button> : <span/>}<button className="button primary" disabled={!name.trim()} onClick={create}>Continue <ArrowRight size={18}/></button></div></div>;
  if (step === 'match') return <SetMatch ctx={ctx} setId={set.id} onBack={() => setStep('upload')} onNext={() => setStep('names')} nextLabel="Name people"/>;
  if (step === 'names') return <SetNames ctx={ctx} setId={set.id} onBack={() => setStep('match')} onDone={onDone} doneLabel={doneLabel}/>;
  return <SetUpload ctx={ctx} setId={set.id} footer={<div className="setup-footer">{onCancel ? <button className="button subtle" onClick={onCancel}>Back to the library</button> : <span/>}<button className="button primary" disabled={!set.nowImageId || !set.thenImageId} onClick={() => setStep('match')}>Match people <ArrowRight size={18}/></button></div>}/>;
}
