import { useEffect, useLayoutEffect, useRef } from 'react';
import { RotateCw } from 'lucide-react';
import { Finale } from './Finale';
import { currentTurn, remainingQuestions, spinQuestion } from './logic';
import { PointsEntry } from './PointsEntry';
import { QuestionWheel } from './QuestionWheel';
import { SavedResults } from './SavedResults';
import type { Context } from './types';

export function Stage(context: Context) {
  const { segment, event, update } = context, turn = currentTurn(segment.game);
  const stage = useRef<HTMLElement>(null);
  useLayoutEffect(() => { stage.current?.scrollTo(0, 0); }, [turn?.id]);
  const complete = segment.game.turns.length > 0 && segment.game.turns.every(t => t.points !== undefined);
  // The shared Pause/Resume controls return to play, including when paused on the finale.
  useEffect(() => { if (complete) update(s => { s.phase = 'finale'; }); }, [complete, update]);
  if (complete) return <Finale {...context}/>;
  if (!turn) return <main className="empty-state">Set up Sharmila Awards to start.</main>;
  const team = event.teams.find(t => t.id === turn.teamId), question = segment.game.questions.find(q => q.id === turn.draw?.questionId);
  return <main ref={stage} className="game-stage sa-stage">
    <header className="sa-turn-header"><div><span className="eyebrow">CURRENT TEAM</span><h2><span className="team-dot" style={{ background: team?.color }}/>{team?.name}</h2></div>
      <p className="muted">Round {turn.round} of {segment.game.legacyTwoRounds ? 2 : 1} · Team {segment.game.currentTurnIndex % event.teams.length + 1} of {event.teams.length}</p>
    </header>
    <p className="sa-subtitle handwritten">Wrong answers. Full confidence.</p>
    <section className="sa-play" key={turn.id}>
      <div className="sa-wheel-area"><QuestionWheel questions={remainingQuestions(segment.game, turn)} draw={turn.draw}/>
        <p className="small muted">{remainingQuestions(segment.game, turn).length - (turn.draw ? 1 : 0)} questions remaining</p>
      </div>
      <div className="sa-answer" aria-live="polite">
        {question ? <><span className="eyebrow">YOUR QUESTION</span><h1>{question.text}</h1>
          <PointsEntry context={context} turn={turn}/>
        </> : <><h1>Make it wrong.<br/>Make it convincing.</h1>
          <button className="button primary large" onClick={() => update(s => spinQuestion(s, turn.id))}><RotateCw size={20}/> Spin</button>
        </>}
      </div>
    </section>
    <SavedResults context={context}/>
  </main>;
}
