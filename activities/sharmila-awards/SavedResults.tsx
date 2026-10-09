import { PointsEntry } from './PointsEntry';
import type { Context } from './types';

export function SavedResults({ context }: { context: Context }) {
  const saved = context.segment.game.turns.filter(t => t.points !== undefined);
  if (!saved.length) return null;
  return <details className="sa-saved-results"><summary>Saved results & corrections ({saved.length})</summary>
    {saved.map(turn => <section className="sa-correction" key={turn.id}>
      <h3>{context.event.teams.find(t => t.id === turn.teamId)?.name} · Round {turn.round} · {turn.points} base points</h3>
      <p className="muted">{context.segment.game.questions.find(q => q.id === turn.draw?.questionId)?.text}</p>
      <PointsEntry context={context} turn={turn} correction/>
    </section>)}
  </details>;
}
