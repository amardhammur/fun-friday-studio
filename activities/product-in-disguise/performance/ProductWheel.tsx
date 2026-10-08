import { useMemo, type CSSProperties } from 'react';
import { products } from '../content';
import type { Game } from './types';

const colours = ['#f7d873', '#8fcbe0', '#d2b5f2', '#9edbbd', '#f0b085', '#eea7bb'];
const angle = 360 / products.length;
const point = (degrees: number, radius: number) => {
  const radians = degrees * Math.PI / 180;
  return [200 + Math.cos(radians) * radius, 200 + Math.sin(radians) * radius];
};

export function ProductWheel({ spin }: { spin?: Game['spin'] }) {
  const startedAt = spin?.startedAt, endsAt = spin?.endsAt, rotation = spin?.rotation;
  // A reload resumes elapsed time; ordinary renders must not move that offset.
  const style = useMemo(() => startedAt !== undefined && endsAt !== undefined ? {
    '--cc-wheel-turn': `${rotation}deg`,
    animationDuration: `${endsAt - startedAt}ms`,
    animationDelay: `${Math.min(0, startedAt - Date.now())}ms`,
  } as CSSProperties : undefined, [startedAt, endsAt, rotation]);
  return <div className="cc-wheel-holder">
    <span className="cc-wheel-pointer" aria-hidden="true"/>
    <svg viewBox="0 0 400 400" role="img" aria-label="Product wheel" className={`cc-wheel-svg ${spin ? 'is-spinning' : ''}`} style={style}>
      {products.map((product, i) => {
        const mid = i * angle - 90;
        const start = point(mid - angle / 2, 184), end = point(mid + angle / 2, 184);
        const [x, y] = point(mid, 126), words = product.name.split(' ');
        return <g key={product.id}>
          <path d={`M200 200L${start.join(' ')}A184 184 0 0 1 ${end.join(' ')}Z`} fill={colours[i % colours.length]} stroke="#263237" strokeWidth="2"/>
          <text transform={`translate(${x} ${y}) rotate(${i * angle})`} textAnchor="middle" dominantBaseline="middle">
            {words.map((word, index) => <tspan key={index} x="0" y={(index - (words.length - 1) / 2) * 17}>{word}</tspan>)}
          </text>
        </g>;
      })}
      <circle cx="200" cy="200" r="43" fill="#263237" stroke="#f5f4ef" strokeWidth="4"/>
      <text x="200" y="202" textAnchor="middle" dominantBaseline="middle" className="cc-wheel-hub">AD</text>
    </svg>
  </div>;
}
