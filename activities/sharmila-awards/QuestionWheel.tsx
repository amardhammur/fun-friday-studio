import { useMemo, type CSSProperties } from 'react';
import type { GameState, Turn } from './types';

const point = (degrees: number, radius: number) => {
  const radians = degrees * Math.PI / 180;
  return [180 + Math.cos(radians) * radius, 180 + Math.sin(radians) * radius];
};
export function QuestionWheel({ questions, draw }: { questions: GameState['questions']; draw?: Turn['draw'] }) {
  const angle = 360 / Math.max(1, questions.length), selected = questions.findIndex(q => q.id === draw?.questionId);
  const startedAt = draw?.startedAt;
  const style = useMemo(() => startedAt !== undefined ? {
    '--sa-wheel-turn': `${1440 - selected * angle}deg`,
    animationDelay: `${Math.min(0, startedAt - Date.now())}ms`,
  } as CSSProperties : undefined, [startedAt, selected, angle]);
  return <div className="sa-wheel-holder">
    <span className="sa-wheel-pointer" aria-hidden="true"/>
    <svg viewBox="0 0 360 360" role="img" aria-label="Question wheel" className={`sa-wheel ${draw ? 'sa-wheel-spun' : ''}`} style={style}>
      {questions.map((question, i) => {
        const mid = i * angle - 90, start = point(mid - angle / 2, 166), end = point(mid + angle / 2, 166), [x, y] = point(mid, 132);
        return <g key={question.id} className={`sa-wheel-slice sa-wheel-colour-${i % 4}`}>
          <title>{question.text}</title>
          {questions.length === 1 ? <circle cx="180" cy="180" r="166"/> : <path d={`M180 180L${start.join(' ')}A166 166 0 ${angle > 180 ? 1 : 0} 1 ${end.join(' ')}Z`}/>}
          {(questions.length <= 24 || i % Math.ceil(questions.length / 24) === 0) && <text x={x} y={y} textAnchor="middle" dominantBaseline="middle" transform={`rotate(${i * angle} ${x} ${y})`}>{i + 1}</text>}
        </g>;
      })}
      <circle cx="180" cy="180" r="39" className="sa-wheel-hub"/>
      <text x="180" y="184" textAnchor="middle" dominantBaseline="middle" className="sa-wheel-question">?</text>
    </svg>
  </div>;
}
