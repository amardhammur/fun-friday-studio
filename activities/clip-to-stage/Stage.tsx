import { useEffect } from 'react';
import { ArrowRight, Mic2 } from 'lucide-react';
import { Timer } from '../../src/core/play/TimerView';
import { completeScores, next, performancePrompt, setScore, timed } from './logic';
import { ReferenceVideo } from './ReferenceVideo';
import type { Context } from './types';

export function Stage(ctx: Context) {
  const { segment, event, update } = ctx, g = segment.game, settings = segment.settings;
  useEffect(() => { if (g.step === 'results') update(s => { s.phase = 'finale'; }); }, [g.step, update]);
  if (g.step === 'results') return null;
  const team = event.teams.find(t => t.id === g.teamIds[g.performanceIndex]);
  const heading = g.step === 'watch' ? 'Watch the clip.' : g.step === 'practise' ? 'Make it your own.' : team?.name;
  const nextLabel = g.step === 'watch' ? 'Start practice' : g.step === 'practise' ? 'Start first performance' : g.step === 'perform' ? g.performanceIndex === g.teamIds.length - 1 ? 'Enter judge scores' : 'Next team' : 'Save scores & see results';
  return <div className="stage-layout cts-stage"><main className="game-stage">
    <header className="cts-head"><span className="eyebrow">{g.step === 'perform' ? `PERFORMANCE ${g.performanceIndex + 1} / ${g.teamIds.length}` : g.step === 'practise' ? 'EVERY TEAM PRACTISES TOGETHER' : g.step === 'judging' ? 'JUDGE PANEL' : 'CLIP TO STAGE'}</span>{timed(g) && <Timer state={g.timer} label={g.step === 'practise' ? 'Practice timer' : 'Performance timer'} onChange={timer => update(s => { s.game.timer = timer; })}/>}</header>
    <section className="cts-scene">
      {g.step === 'judging' ? <div className="cts-judging"><h1>Judge scores.</h1><p>Judge panel: discuss offline. Host: enter each team’s total.</p><div className="cts-score-fields">{g.teamIds.map(id => {
        const scoredTeam = event.teams.find(t => t.id === id)!;
        return <label key={id}><span><span className="team-dot" style={{ background: scoredTeam.color }}/>{scoredTeam.name}</span><input type="number" min="0" step="1" inputMode="numeric" aria-label={`Score for ${scoredTeam.name}`} value={g.scores[id] ?? ''} placeholder="Points" onChange={e => update(s => setScore(s, id, e.target.value === '' || !e.target.validity.valid ? null : e.target.valueAsNumber))}/></label>;
      })}</div><p className="cts-note">Enter whole points, including 0. Scores can be edited after saving.</p></div> : <div className="cts-reference-scene"><div className="cts-prompt">
        {g.step === 'perform' && <span className="cts-on-air"><Mic2 size={22}/> YOUR STAGE</span>}
        <h1 style={g.step === 'perform' ? { color: team?.color } : undefined}>{heading}</h1>
        {settings.clipTitle.trim() && <h2>{settings.clipTitle}</h2>}
        <p>{performancePrompt(settings.performance)}</p>
        <p className="cts-note">{g.step === 'watch' ? 'Same clip for every team. Watch the song, rhythm and moves. The host starts practice when everyone is ready.' : g.step === 'practise' ? `You have ${settings.practiceMinutes} minutes. Replay the clip, choose your parts and rehearse together.` : 'Everyone else: enjoy the show. The judge panel scores after all teams have performed.'}</p>
      </div><ReferenceVideo settings={settings}/></div>}
    </section>
    <footer className="cts-actions"><span>{g.step === 'practise' ? 'Timer ends? Finish when the host is ready.' : g.step === 'judging' ? 'Judge totals go directly into the event standings.' : 'One clip. Your team’s own twist.'}</span><button className="button primary large" disabled={g.step === 'judging' && !completeScores(g)} onClick={() => next(ctx)}>{nextLabel}<ArrowRight size={19}/></button></footer>
  </main></div>;
}
