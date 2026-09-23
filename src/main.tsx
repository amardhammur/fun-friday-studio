import React from 'react';
import { createRoot } from 'react-dom/client';
import '@fontsource/bricolage-grotesque/latin-600.css';
import '@fontsource/bricolage-grotesque/latin-700.css';
import '@fontsource/atkinson-hyperlegible/latin-400.css';
import '@fontsource/atkinson-hyperlegible/latin-700.css';
import '@fontsource/caveat/latin-500.css';
import './theme/styles.css';
import { App } from './app/App';
import { discoverActivities, getActivities } from './core/registry';
import { activitySegment, applyActivitySegment, applyEventUpdate, createEvent, createSegment, eventDraft } from './core/event';
import type { EventUpdate } from './core/types';
import { validateEvent } from './core/session';
import type { EventSession } from './core/types';
import { checkStorage, readSavedSession, saveSession, storageWarning } from './core/storage';
class ErrorBoundary extends React.Component<{ children: React.ReactNode }, { error?: string }> {
  state: { error?: string } = {};
  static getDerivedStateFromError(error: Error) { return { error: error.message }; }
  render() { return this.state.error ? <main className="empty-state"><h1>The bell rang a little early.</h1><p>{this.state.error}</p><p>Your saved session is still on this laptop.</p><button className="button primary" onClick={() => location.reload()}>Reload Studio</button></main> : this.props.children; }
}
const root = createRoot(document.getElementById('root')!);
root.render(<div className="boot-screen"><span>✦</span><h1>fun friday studio</h1><p>Opening the activity cupboard…</p></div>);
async function boot() {
  await discoverActivities(); await checkStorage();
  const saved = readSavedSession(); let session: EventSession | undefined;
  if (saved) { try { session = validateEvent(saved); } catch (error) { storageWarning(`The saved session could not be restored. ${(error as Error).message}`); } }
  if (!session) {
    const activity = getActivities()[0];
    session = createEvent(); session.segments = [createSegment(activity)]; session.phase = 'segment'; session.segments[0].status = 'setup';
    if (activity.createDemo) { try { const evt: EventUpdate = eventDraft(session); const prepared = await activity.createDemo(activitySegment(session, 0), evt); activity.startNewGame(prepared.segment, prepared.event); applyActivitySegment(session, 0, prepared.segment); applyEventUpdate(session, prepared.event); } catch (error) { storageWarning(`The demo could not load. You can still upload your own photos. ${(error as Error).message}`); } }
    saveSession(session);
  }
  root.render(<ErrorBoundary><App initialSession={session}/></ErrorBoundary>);
}
boot().catch(error => root.render(<div className="empty-state"><h1>Studio couldn’t open.</h1><p>{String(error)}</p><button className="button primary" onClick={() => location.reload()}>Try again</button></div>));
