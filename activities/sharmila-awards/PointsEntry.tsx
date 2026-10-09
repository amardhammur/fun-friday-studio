import { ArrowRight, Check, ThumbsDown, ThumbsUp } from 'lucide-react';
import { canSavePoints, multiplier, parsePoints, savePoints } from './logic';
import type { Context, Turn } from './types';

export function PointsEntry({ context, turn, correction = false }: { context: Context; turn: Turn; correction?: boolean }) {
  const { segment, event, update } = context, raw = turn.pointsDraft ?? String(turn.points ?? ''), points = parsePoints(raw);
  const valid = (points === 0 || points === 1) && canSavePoints(segment, event, turn, points), changed = turn.pointsDraft !== undefined && points !== turn.points;
  const team = event.teams.find(t => t.id === turn.teamId), helpId = `points-${turn.id}-help`;
  const choose = (value: 0 | 1) => update(s => {
    const saved = s.game.turns.find(t => t.id === turn.id);
    if (saved?.draw) saved.pointsDraft = String(value);
  });
  return <form className="sa-points-entry" onSubmit={e => { e.preventDefault(); if (valid && (!correction || changed)) savePoints(context, turn.id, !correction); }}>
    <fieldset aria-describedby={helpId}>
      <legend>{correction ? `Points for ${team?.name} · Round ${turn.round}` : 'Points total'}</legend>
      <div className="sa-points-controls">
        <div className="sa-point-choices">
          <button type="button" className="button secondary sa-point-choice" aria-label="Thumbs up: 1 point" aria-pressed={points === 1} onClick={() => choose(1)}><ThumbsUp size={22}/> +1</button>
          <button type="button" className="button secondary sa-point-choice" aria-label="Thumbs down: 0 points" aria-pressed={points === 0} onClick={() => choose(0)}><ThumbsDown size={22}/> 0</button>
        </div>
        <button type="submit" className="button primary" disabled={!valid || correction && !changed}>{correction ? <><Check size={18}/> Save correction</> : <>Save & Next team <ArrowRight size={18}/></>}</button>
      </div>
    </fieldset>
    <p id={helpId} className="small muted">
      {valid ? `${points} base ×${multiplier(segment, event)} = ${points * multiplier(segment, event)} points` : 'Choose +1 or 0.'}
    </p>
  </form>;
}
