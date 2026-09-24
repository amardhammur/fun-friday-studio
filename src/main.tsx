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
import { createEvent, createSegment } from './core/event';
import { createDemoEvent } from './core/demo';
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
    if (activity.createDemo) { try { session = await createDemoEvent(activity); } catch (error) { storageWarning(`The demo could not load. You can still set up your own game. ${(error as Error).message}`); } }
    saveSession(session);
  }
  let personalSession: EventSession | undefined;
  const personal = readSavedSession(true);
  if (personal) {
    try { const restored = validateEvent(personal); if (!restored.isDemo) personalSession = restored; }
    catch (error) { storageWarning(`Your personal session could not be restored. ${(error as Error).message}`); }
  }
  root.render(<ErrorBoundary><App initialSession={session} personalSession={personalSession}/></ErrorBoundary>);
}
boot().catch(error => root.render(<div className="empty-state"><h1>Studio couldn’t open.</h1><p>{String(error)}</p><button className="button primary" onClick={() => location.reload()}>Try again</button></div>));
