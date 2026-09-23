import type { Activity } from './types';
const registry = new Map<string, Activity>();
export function registerActivity(activity: Activity) {
  if (registry.has(activity.id)) throw new Error(`Duplicate activity: ${activity.id}`);
  registry.set(activity.id, activity);
}
// Filename order must not decide this: discovery is alphabetical by path, so main.tsx's and
// App.tsx's getActivities()[0] defaults need an explicit, stable ordering to rely on instead.
export const getActivities = () => [...registry.values()].sort((a, b) => (a.order ?? Number.MAX_SAFE_INTEGER) - (b.order ?? Number.MAX_SAFE_INTEGER));
export const getActivity = (id: string) => registry.get(id);
export async function discoverActivities() {
  const modules = import.meta.glob('../../activities/*/index.ts');
  await Promise.all(Object.values(modules).map(load => load()));
}
