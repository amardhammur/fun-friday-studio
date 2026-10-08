import { Check } from 'lucide-react';
import { playerNumber, saveCount } from './logic';
import type { Context, Turn } from './types';

export function ResultEntry({ context, turn }: { context: Context; turn: Turn }) {
  const count = turn.countDraft ?? turn.count, correction = turn.status === 'done';
  return <div className="bottle-result-entry">
    <fieldset><legend>{correction ? 'Correct count' : 'Valid toothpicks'}</legend>
      <div className="bottle-counts" role="group" aria-label={`Valid toothpicks for player ${playerNumber(context.segment.game, turn)}`}>{Array.from({ length: 11 }, (_, n) => <button key={n} aria-label={`${n} valid toothpicks`} aria-pressed={count === n} onClick={() => context.update(s => {
        const saved = s.game.turns.find(t => t.id === turn.id);
        if (saved && ['counting', 'done'].includes(saved.status)) saved.countDraft = n;
      })}>{n}</button>)}</div>
    </fieldset>
    <button className="button primary" disabled={count === undefined || (correction && count === turn.count)} onClick={() => saveCount(context, turn.id)}><Check size={18}/>{correction ? 'Save correction' : 'Confirm count'}</button>
  </div>;
}
