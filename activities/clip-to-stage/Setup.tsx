import { Play, Upload } from 'lucide-react';
import { setupIssues, start } from './logic';
import { storeVideo } from './media';
import { ReferenceVideo } from './ReferenceVideo';
import type { Context } from './types';

export function Setup(ctx: Context) {
  const { segment, event, update, updateEvent, runTask } = ctx, settings = segment.settings;
  const issues = setupIssues(settings, event), selected = settings.videoAssetId && event.assets[settings.videoAssetId];
  const upload = (file: File) => runTask('Saving your reference clip…', async () => {
    const asset = await storeVideo(file);
    updateEvent(e => { e.assets[asset.id] = asset; });
    update(s => { s.settings.videoAssetId = asset.id; s.settings.source = 'local'; if (!s.settings.clipTitle.trim()) s.settings.clipTitle = file.name.replace(/\.[^.]+$/, '').slice(0, 120); });
  });
  return <main className="setup-content cts-setup">
    <div className="section-heading"><span className="eyebrow">THE ENCORE</span><h1>Clip to Stage<span className="accent">.</span></h1><p>Watch it. Practise it. Make it your team’s moment.</p></div>
    <section className="panel cts-settings">
      <label className="cts-wide">Clip title<input aria-label="Clip title" maxLength={120} value={settings.clipTitle} placeholder="Give your song or clip a name" onChange={e => update(s => { s.settings.clipTitle = e.target.value; })}/></label>
      <label>Reference source<select aria-label="Reference source" value={settings.source} onChange={e => update(s => { s.settings.source = e.target.value as 'youtube' | 'local'; })}><option value="youtube">YouTube link · internet needed</option><option value="local">Local video · works offline</option></select></label>
      <label>Team performance<select aria-label="Team performance" value={settings.performance} onChange={e => update(s => { s.settings.performance = e.target.value as typeof settings.performance; })}><option value="both">Singing, dance, or both</option><option value="sing">Sing the song together</option><option value="dance">Recreate the dance or performance</option></select></label>
      {settings.source === 'youtube' ? <label className="cts-wide">YouTube video, Shorts or clip link<input type="url" aria-label="YouTube link" maxLength={2048} value={settings.youtubeUrl} placeholder="https://www.youtube.com/shorts/…" onChange={e => update(s => { s.settings.youtubeUrl = e.target.value; })}/><small>YouTube plays online. Upload a local video to run the activity fully offline.</small></label> : <label className="cts-wide cts-upload"><span><Upload size={18}/> {selected ? `Selected: ${selected.name}` : 'Upload your reference video'}</span><input type="file" aria-label="Local video" accept="video/mp4,video/webm,.mp4,.webm" onChange={e => { const file = e.target.files?.[0]; e.target.value = ''; if (file) void upload(file); }}/><small>MP4 or WebM · up to 100 MB · saved for offline playback and event export</small></label>}
      <label>Practice time<select aria-label="Practice time" value={settings.practiceMinutes} onChange={e => update(s => { s.settings.practiceMinutes = +e.target.value; })}>{[2, 5, 8, 10, 15, 20].map(n => <option key={n} value={n}>{n} minutes</option>)}</select></label>
      <label>Each performance<select aria-label="Each performance" value={settings.performanceSeconds} onChange={e => update(s => { s.settings.performanceSeconds = +e.target.value; })}>{[60, 120, 180, 300].map(n => <option key={n} value={n}>{n / 60} minutes</option>)}</select></label>
    </section>
    <p className="cts-team-summary">{event.teams.length} teams · one shared clip · one performance each</p>
    {issues.length > 0 && <div role="status" className="warning-text">{issues.map(issue => <p key={issue}>{issue}</p>)}</div>}
    {issues.length === 0 && <details className="panel cts-preview-video"><summary>Preview reference clip</summary><ReferenceVideo settings={settings}/></details>}
    <div className="setup-footer"><span className="privacy-note">Offline judge panel · host enters final points</span><button className="button primary large" disabled={issues.length > 0} onClick={() => start(ctx)}><Play size={20}/> Start activity</button></div>
  </main>;
}
