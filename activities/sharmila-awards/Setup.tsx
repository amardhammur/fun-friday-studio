import { Play } from 'lucide-react';
import { eventDraft } from '../../src/core/event';
import { multiplier, setupIssues, startNewGame } from './logic';
import { questionList, starterQuestions } from './questions';
import type { Context } from './types';

export function Setup({ segment, event, update, updateEvent }: Context) {
  const issues = setupIssues(segment.settings, event), count = questionList(segment.settings.questionText).length;
  const start = () => {
    let started = false;
    update(s => { startNewGame(s, eventDraft(event)); started = true; });
    if (started) updateEvent(e => { e.scoreEntries = e.scoreEntries.filter(entry => entry.segmentId !== segment.segmentId); });
  };
  return <main className="setup-content sa-setup">
    <div className="section-heading"><span className="eyebrow">SHARMILA AWARDS</span><h1>Wrong answers. Full confidence.</h1>
      <p>Give the most confident wrong explanation you can.</p>
    </div>
    <section className="sa-start"><div><h3>{event.teams.length} teams · 1 round</h3><p className="muted">One turn per team · ×{multiplier(segment, event)} points</p></div>
      <button className="button primary large" disabled={issues.length > 0} onClick={start}><Play size={20}/> Start activity</button>
    </section>
    <details className="panel sa-question-list"><summary>Question list · {count} unique questions</summary>
      <label htmlFor="sa-questions">Questions (one per line)</label>
      <textarea id="sa-questions" rows={12} maxLength={60_000} value={segment.settings.questionText} onChange={e => update(s => { s.settings.questionText = e.target.value; })}/>
      <button className="button secondary small-button" onClick={() => update(s => { s.settings.questionText = starterQuestions.join('\n'); })}>Use starter questions</button>
      <p className="small muted">Use at least {event.teams.length} unique questions. Blank lines and duplicates are skipped. Each question is used at most once.</p>
    </details>
    {issues.length > 0 && <div className="sa-issues" role="status">{issues.map(issue => <p key={issue}>{issue}</p>)}</div>}
  </main>;
}
