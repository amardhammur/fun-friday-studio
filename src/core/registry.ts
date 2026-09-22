import type { Activity } from './types';
const registry = new Map<string, Activity>();
export function registerActivity(activity: Activity) {
  if (registry.has(activity.id)) throw new Error(`Duplicate activity: ${activity.id}`);
  registry.set(activity.id, activity);
}
export const getActivities = () => [...registry.values()];
export const getActivity = (id: string) => registry.get(id);
export async function discoverActivities() {
  const modules = import.meta.glob('../../activities/*/index.ts');
  await Promise.all(Object.values(modules).map(load => load()));
}
