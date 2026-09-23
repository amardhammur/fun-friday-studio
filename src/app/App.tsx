import { useCallback, useEffect, useRef, useState } from 'react';
import { BookOpen, Download, Upload, Maximize, Home as HomeIcon, Users, ArrowLeft, ArrowRight, Check, ShieldCheck, X, AlertTriangle, LoaderCircle, Settings, Keyboard, WifiOff } from 'lucide-react';
import type { Activity, ActivityContext, EventSession, EventUpdate } from '../core/types';
import { getActivities, getActivity } from '../core/registry';
import { activityEvent, activitySegment, applyActivitySegment, applyEventUpdate, createEvent, createSegment, currentSegment, defaultEventTitle, eventDraft, foldSegmentView, segmentView } from '../core/event';
import { getStorageWarnings, saveSession } from '../core/storage';
import { exportSession, importSession } from '../core/transfer';
import { shortcutKeyLabel, toggleFullscreen, useShortcuts } from '../core/projector';
import { Home } from './Home';
import { Lineup } from './Lineup';
import { Interstitial } from './Interstitial';
import { EventFinale } from './EventFinale';
import { advanceSegment } from './standings-logic';
import { PeopleLibrary } from '../core/people/PeopleLibrary';
import { Wager } from '../core/play/WagerView';
import { libraryLocked, prepareSegmentPeople } from '../core/people/event-library';
export function App({ initialSession }: { initialSession: EventSession }) {
  const [session, setSession] = useState(initialSession), sessionRef = useRef(initialSession);
  const [route, setRoute] = useState<'home' | 'session' | 'people'>(initialSession.phase === 'lineup' || currentSegment(initialSession)?.status === 'setup' ? 'home' : 'session');
  const [toast, setToast] = useState(''), [busy, setBusy] = useState(''), busyRef = useRef(false);
  const [warnings, setWarnings] = useState(getStorageWarnings()), [offlineReady, setOfflineReady] = useState(false), [offlineError, setOfflineError] = useState(false);
  const [shortcutsOpen, setShortcutsOpen] = useState(false);
  const importInput = useRef<HTMLInputElement>(null);
  const segment = currentSegment(session), activity = segment ? getActivity(segment.activityId) : undefined;
  const activitySegmentView = segment ? activitySegment(session, session.currentSegmentIndex) : undefined;
  const view = segment ? segmentView(session, session.currentSegmentIndex) : undefined;
  const activityEventView = activityEvent(session);
  const notify = useCallback((message: string) => setToast(message), []);
  // The event owns updatedAt, so install must run on the event itself, never on a segment view.
  const install = useCallback((next: EventSession) => { next.updatedAt = new Date().toISOString(); sessionRef.current = next; saveSession(next); setSession(next); }, []);
  // An activity only ever edits its own segment: run the change against a view of a clone, fold it back, install the event.
  const update = useCallback<ActivityContext['update']>(change => { try { const next = structuredClone(sessionRef.current); const index = next.currentSegmentIndex; const draft = activitySegment(next, index); change(draft); applyActivitySegment(next, index, draft); install(next); } catch (error) { notify(error instanceof Error ? error.message : 'This change could not be applied.'); } }, [install, notify]);
  const updateEvent = useCallback((change: (draft: EventSession) => void) => { try { const next = structuredClone(sessionRef.current); change(next); install(next); } catch (error) { notify(error instanceof Error ? error.message : 'This change could not be applied.'); } }, [install, notify]);
  const runTask = useCallback(async (label: string, task: () => Promise<void>) => {
    if (busyRef.current) return;
    busyRef.current = true; setBusy(label);
    try { await task(); } catch (error) { notify(error instanceof Error ? error.message : 'Something went wrong. Please try again.'); }
    finally { busyRef.current = false; setBusy(''); }
  }, [notify]);
  useEffect(() => { const handler = () => setWarnings(getStorageWarnings()); window.addEventListener('studio-storage-warning', handler); return () => window.removeEventListener('studio-storage-warning', handler); }, []);
  useEffect(() => { if (!toast) return; const timer = setTimeout(() => setToast(''), 10000); return () => clearTimeout(timer); }, [toast]);
  useEffect(() => {
    if (import.meta.env.PROD && 'serviceWorker' in navigator) {
      navigator.serviceWorker.register(`${import.meta.env.BASE_URL}sw.js`).then(() => navigator.serviceWorker.ready).then(async () => {
        // Installation may finish just before clients.claim(). Do not promise offline
        // reload until this document is actually controlled by the installed worker.
        if (!navigator.serviceWorker.controller) await new Promise<void>(resolve => navigator.serviceWorker.addEventListener('controllerchange', () => resolve(), { once: true }));
        setOfflineReady(true);
      }).catch(() => setOfflineError(true));
    }
  }, []);
  useEffect(() => { window.scrollTo(0, 0); }, [route, session.phase, segment?.status, segment?.setupStepId]);
  const rosterLocked = session.segments.some((s, i) => i !== session.currentSegmentIndex && ['play', 'finale', 'done'].includes(s.status));
  const hasSavedEvent = !session.isDemo && (session.segments.length > 0 || session.scoreEntries.length > 0 || session.phase !== 'lineup');
  const updateActivityEvent = useCallback((change: (draft: EventUpdate) => void) => updateEvent(next => { const draft: EventUpdate = eventDraft(next); change(draft); applyEventUpdate(next, draft); }), [updateEvent]);
  const context: ActivityContext | undefined = activitySegmentView && { rosterLocked, segment: activitySegmentView, event: activityEventView, update, updateEvent: updateActivityEvent, notify, runTask, goHome: () => setRoute('home'), openPeople: () => setRoute('people') };
  useShortcuts(activity, context, !!activity && !!context && route === 'session' && segment?.status === 'play' && !busy);
  const beginSetup = (chosen: Activity) => {
    if (hasSavedEvent && !window.confirm('Start a new one-activity event? Your current event will stay saved only if you export it first.')) return;
    if (session.isDemo && segment?.activityId === chosen.id) { updateEvent(s => { s.phase = 'segment'; s.segments[s.currentSegmentIndex].status = 'setup'; s.segments[s.currentSegmentIndex].setupStepId = 'people'; }); setRoute('session'); return; }
    updateEvent(s => { s.segments = [createSegment(chosen)]; s.currentSegmentIndex = 0; s.phase = 'segment'; s.segments[0].status = 'setup'; s.scoreEntries = []; s.wager = undefined; s.isDemo = false; s.title = defaultEventTitle(); });
    updateEvent(s => { s.phase = 'segment'; prepareSegmentPeople(s, s.currentSegmentIndex); });
    setRoute('session');
  };
  const buildEvent = () => {
    if (!session.isDemo && (session.segments.length || session.scoreEntries.length || session.wager) && !window.confirm('Start a fresh event? Your current activities and scores will be cleared, but your people and teams will stay.')) return;
    updateEvent(s => { s.segments = []; s.scoreEntries = []; s.wager = undefined; s.currentSegmentIndex = 0; s.phase = 'lineup'; s.isDemo = false; s.title = defaultEventTitle(); });
    setRoute('session');
  };
  const demo = (chosen: Activity) => void runTask('Drawing a little Friday nostalgia…', async () => {
    if (!session.isDemo && !window.confirm('Try a new demo session? Export your current session first if you want to keep it.')) return;
    if (!chosen.createDemo) throw new Error('This activity does not include a demo.');
    const next = createEvent(); next.segments = [createSegment(chosen)]; next.phase = 'segment';
    const seg = activitySegment(next, 0);
    const evt: EventUpdate = eventDraft(next);
    const prepared = await chosen.createDemo(seg, evt); chosen.startNewGame(prepared.segment, prepared.event); applyActivitySegment(next, 0, prepared.segment); applyEventUpdate(next, prepared.event);
    install(next); setRoute('session');
  });
  const jumpStep = (id: string) => {
    if (!activity || !view) return;
    if (rosterLocked && id !== 'game') { notify('People and teams are shared with completed activities. Import a replacement library to reset the event before changing the roster.'); return; }
    const index = activity.setupSteps.findIndex(step => step.id === id);
    for (let i = 0; i < index; i++) { const issues = activity.setupSteps[i].validate(activitySegmentView!, activityEventView); if (issues.length) { notify(issues[0]); return; } }
    update(s => { s.setupStepId = id; });
  };
  const currentStep = activity?.setupSteps.find(step => step.id === segment?.setupStepId) ?? activity?.setupSteps[0];
  const isStage = route === 'session' && session.phase === 'segment' && !!segment && (segment.status === 'play' || segment.status === 'finale');
  return <div className={`app ${isStage ? 'presentation' : ''}`}><header className="app-header"><button className="brand" onClick={() => setRoute('home')} aria-label="Fun Friday Studio home"><span className="brand-mark"><BookOpen size={25}/><i>✦</i></span><span>fun friday<span className="brand-studio">STUDIO</span></span></button>{!isStage ? <nav className="main-nav" aria-label="Main navigation"><button className={route === 'home' ? 'active' : ''} onClick={() => setRoute('home')}><HomeIcon size={15}/> Activity library</button><button className={route === 'people' ? 'active' : ''} onClick={() => setRoute('people')}><Users size={15}/> People library</button></nav> : <div className="stage-app-title"><span className="eyebrow">{activity?.name}</span></div>}<div className="header-actions"><span className={`offline-status ${offlineError ? 'warning-text' : ''}`} title={offlineReady ? 'All app, font, and model assets are cached on this laptop.' : import.meta.env.DEV ? 'Development server: use a production build to prepare the offline cache.' : offlineError ? 'Offline cache failed. Keep the local server running or retry online.' : 'Downloading the app assets for offline use…'}>{offlineReady ? <WifiOff size={14}/> : <ShieldCheck size={14}/>}<span>{offlineReady ? 'Offline ready' : import.meta.env.DEV ? 'Local & private' : offlineError ? 'Offline cache unavailable' : 'Preparing offline'}</span></span><button className="icon-button" title="Import session ZIP" aria-label="Import session ZIP" onClick={() => importInput.current?.click()}><Upload size={18}/></button><button className="button secondary header-export" onClick={() => void runTask('Packing your Friday memories…', () => exportSession(session))}><Download size={16}/><span>Export session</span></button>{isStage && <button className="icon-button" aria-label="Full screen" title="Full screen" onClick={() => void toggleFullscreen().catch(e => notify(e.message))}><Maximize size={19}/></button>}</div></header>
    <input ref={importInput} type="file" accept=".zip,application/zip" className="visually-hidden" aria-label="Choose session ZIP" onChange={e => { const file = e.target.files?.[0]; e.target.value = ''; if (file) void runTask('Restoring your Friday session…', async () => { const next = await importSession(file); install(next); setRoute('session'); notify('Session restored. Welcome back to the office.'); }); }}/>
    {warnings.length > 0 && <div className="storage-warning" role="alert"><AlertTriangle size={19}/><div>{warnings.map(w => <p key={w}>{w}</p>)}</div><button className="button small-button secondary" onClick={() => void runTask('Exporting your temporary session…', () => exportSession(session))}>Export now</button></div>}
    {session.isDemo && session.phase === 'segment' && !rosterLocked && route !== 'home' && activity?.setupSteps.some(s => s.id === 'people') && <div className="demo-banner"><span>✦ DEMO TEAM</span> These are locally generated cartoons. Upload your own photos to make it personal.<button onClick={() => { update(s => { s.phase = 'setup'; s.setupStepId = 'people'; }); setRoute('session'); }}>Use my photos <ArrowLeft size={13} style={{ transform: 'rotate(180deg)' }}/></button></div>}
    {route === 'home' && <Home session={view} event={session} onSetup={beginSetup} onDemo={demo} onResume={() => setRoute('session')} onBuildEvent={buildEvent}/>}
    {route === 'people' && <PeopleLibrary session={session} update={updateEvent} notify={notify} runTask={runTask} locked={libraryLocked(session)}/>}
    {route === 'session' && session.phase === 'lineup' && <Lineup event={session} onChange={updateEvent} onStart={() => updateEvent(s => { s.phase = 'segment'; s.currentSegmentIndex = 0; s.segments[0].status = 'setup'; prepareSegmentPeople(s, 0); })}/>}
    {route === 'session' && session.phase === 'segment' && segment?.status === 'setup' && activity && context && currentStep && <><div className="setup-topbar"><button className="button subtle small-button" onClick={() => setRoute('home')}><ArrowLeft size={16}/> Activities</button><span>{activity.name}</span><span className="small muted">HOST’S DESK</span></div><nav className="setup-steps" aria-label="Activity setup">{activity.setupSteps.map((step, i) => { const current = step.id === currentStep.id, passed = i < activity.setupSteps.findIndex(s => s.id === currentStep.id); return <button key={step.id} className={current ? 'current' : passed ? 'passed' : ''} aria-current={current ? 'step' : undefined} disabled={rosterLocked && step.id !== 'game'} onClick={() => jumpStep(step.id)}><span>{passed ? <Check size={15}/> : `0${i + 1}`}</span>{step.title}</button>; })}</nav><currentStep.View {...context}/></>}
    {route === 'session' && session.phase === 'segment' && segment?.status === 'play' && activity && context && <activity.Stage {...context}/>}
    {route === 'session' && session.phase === 'segment' && segment?.status === 'finale' && activity?.Finale && context && <activity.Finale {...context}/>}
    {route === 'session' && session.phase === 'segment' && segment?.status === 'finale' && <div className="segment-finale-bar"><button className="button primary" onClick={() => updateEvent(s => { s.phase = 'interstitial'; })}>Leaderboard <ArrowRight size={18}/></button></div>}
    {route === 'session' && session.phase === 'interstitial' && <Interstitial event={session} onContinue={() => updateEvent(advanceSegment)}/>}
    {route === 'session' && session.phase === 'wager' && session.wager && <Wager event={session} onChange={updateEvent} onFinish={() => updateEvent(s => { s.phase = 'finale'; })}/>}
    {route === 'session' && session.phase === 'finale' && <EventFinale event={session} onRestart={() => updateEvent(s => { s.phase = 'lineup'; s.scoreEntries = []; s.segments = []; s.wager = undefined; s.currentSegmentIndex = 0; s.title = defaultEventTitle(); })} onHome={() => setRoute('home')}/>}
    {isStage ? <footer className="stage-footer"><button onClick={() => { if (window.confirm('Return to game setup? Your current progress remains saved until you start a new game.')) update(s => { s.phase = 'setup'; s.setupStepId = 'game'; }); }}><Settings size={15}/> Host settings</button><div>{(activity?.shortcuts ?? []).filter((s, i, all) => all.findIndex(o => o.label === s.label) === i).map(s => <span key={s.label}><kbd>{shortcutKeyLabel(s.key)}</kbd> {s.label}</span>)}</div><button aria-label="Keyboard shortcuts" onClick={() => setShortcutsOpen(true)}><Keyboard size={17}/></button></footer> : <footer className="app-footer"><span>FUN FRIDAY STUDIO</span><span>A little nostalgia. A lot of team spirit.</span><span>Made for Fridays. And your people.</span></footer>}
    {toast && <div className="toast" role="status"><span>{toast}</span><button className="icon-button" aria-label="Dismiss notification" onClick={() => setToast('')}><X size={17}/></button></div>}
    {busy && <div className="busy-overlay" role="dialog" aria-modal="true" aria-label={busy}><div><LoaderCircle className="spinner" size={33}/><h3>{busy}</h3><p>All the magic happens right here on your laptop.</p></div></div>}
    {shortcutsOpen && activity && <div className="modal-backdrop"><section className="modal" role="dialog" aria-modal="true" aria-labelledby="shortcuts-title"><button className="modal-close icon-button" aria-label="Close shortcuts" onClick={() => setShortcutsOpen(false)}><X/></button><h2 id="shortcuts-title">Your host shortcuts</h2>{activity.shortcuts.map(s => <div className="shortcut-row" key={s.key}><kbd>{shortcutKeyLabel(s.key)}</kbd><span>{s.label}</span></div>)}<p className="muted">Shortcuts are ignored while typing or using a dialog.</p></section></div>}
  </div>;
}
