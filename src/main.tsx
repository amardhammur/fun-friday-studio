import React from 'react';
import { createRoot } from 'react-dom/client';
import '@fontsource/bricolage-grotesque/latin-600.css';
import '@fontsource/bricolage-grotesque/latin-700.css';
import '@fontsource/atkinson-hyperlegible/latin-400.css';
import '@fontsource/atkinson-hyperlegible/latin-700.css';
import '@fontsource/caveat/latin-500.css';
import './theme/styles.css';
import { applyTheme, readTheme } from './theme/theme';
import { App } from './app/App';
import { discoverActivities } from './core/registry';
import { preserveRejected, restoreStartup } from './core/startup';
import { checkStorage, saveSession } from './core/storage';
class ErrorBoundary extends React.Component<{ children: React.ReactNode }, { error?: string }> {
  state: { error?: string } = {};
  static getDerivedStateFromError(error: Error) { return { error: error.message }; }
  render() { return this.state.error ? <main className="empty-state"><h1>We hit a pause.</h1><p>{this.state.error}</p><p>Your saved session is still on this laptop.</p><button className="button primary" onClick={() => location.reload()}>Reload Studio</button></main> : this.props.children; }
}
applyTheme(readTheme());
const root = createRoot(document.getElementById('root')!);
root.render(<div className="boot-screen"><span>✦</span><h1>fun friday studio</h1><p>Getting the good times ready…</p></div>);
async function boot() {
  await discoverActivities(); await checkStorage();
  const { session, personalSession, rejected } = restoreStartup();
  const open = () => root.render(<ErrorBoundary><App initialSession={session} personalSession={personalSession}/></ErrorBoundary>);
  if (rejected.length) {
    root.render(<main className="empty-state"><h1>A saved event needs recovery.</h1><p>The original documents have not been changed. Download them before continuing if you need to recover their contents.</p>
      {rejected.map(({ key, raw, error }) => <section key={key}><p>{error}</p><a className="button secondary" download={`${key}.json`} href={`data:application/json;charset=utf-8,${encodeURIComponent(raw)}`}>Download rejected {key.includes('.demo.') ? 'demo' : 'personal event'}</a></section>)}
      <button className="button primary" onClick={() => {
        try { preserveRejected(rejected); saveSession(session); open(); }
        catch { window.alert('The original save could not be backed up. Download it and free browser storage before continuing.'); }
      }}>Back up originals and continue</button></main>);
  } else { saveSession(session); open(); }
}
boot().catch(error => root.render(<div className="empty-state"><h1>Studio couldn’t open.</h1><p>{String(error)}</p><button className="button primary" onClick={() => location.reload()}>Try again</button></div>));
