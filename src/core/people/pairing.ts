import type { Rect } from '../types';
const center = (r: Rect) => ({ x: r.x + r.width / 2, y: r.y + r.height / 2 });
export function distance(a: Rect, b: Rect) { const p = center(a), q = center(b); return Math.hypot(p.x - q.x, p.y - q.y); }
// Hungarian assignment with dummy rows/columns to allow unmatched faces.
export function pairFaces(now: Rect[], then: Rect[], tolerance = .12): { now?: number; then?: number; distance?: number }[] {
  const n = now.length + then.length;
  if (!n) return [];
  const costs = Array.from({ length: n }, (_, i) => Array.from({ length: n }, (_, j) => {
    if (i < now.length && j < then.length) { const d = distance(now[i], then[j]); return d <= tolerance ? d : 1e6; }
    return i >= now.length && j >= then.length ? 0 : tolerance / 2 + 1e-9;
  }));
  const u = Array(n + 1).fill(0), v = Array(n + 1).fill(0), p = Array(n + 1).fill(0), way = Array(n + 1).fill(0);
  for (let i = 1; i <= n; i++) {
    p[0] = i; let j0 = 0;
    const min = Array(n + 1).fill(Infinity), used = Array(n + 1).fill(false);
    do {
      used[j0] = true; const i0 = p[j0]; let delta = Infinity, j1 = 0;
      for (let j = 1; j <= n; j++) if (!used[j]) {
        const current = costs[i0 - 1][j - 1] - u[i0] - v[j];
        if (current < min[j]) { min[j] = current; way[j] = j0; }
        if (min[j] < delta) { delta = min[j]; j1 = j; }
      }
      for (let j = 0; j <= n; j++) { if (used[j]) { u[p[j]] += delta; v[j] -= delta; } else min[j] -= delta; }
      j0 = j1;
    } while (p[j0] !== 0);
    do { const j1 = way[j0]; p[j0] = p[j1]; j0 = j1; } while (j0);
  }
  const assignment = Array(n).fill(-1);
  for (let j = 1; j <= n; j++) assignment[p[j] - 1] = j - 1;
  const taken = new Set<number>();
  const results: { now?: number; then?: number; distance?: number }[] = now.map((_, i) => {
    const j = assignment[i];
    if (j < then.length && distance(now[i], then[j]) <= tolerance) { taken.add(j); return { now: i, then: j, distance: distance(now[i], then[j]) }; }
    return { now: i };
  });
  then.forEach((_, j) => { if (!taken.has(j)) results.push({ then: j }); });
  return results;
}
export { intersectionOverUnion } from '../images/math';
