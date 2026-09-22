import { z } from 'zod';
import { getActivity } from './registry';
import type { Activity, AnySession } from './types';
export const teamColors = ['#f7d873', '#eea7bb', '#8fcbe0', '#9edbbd', '#d2b5f2', '#f0b085', '#b8d685', '#c2c9ed'];
export const newTeams = () => ['Coffee Breakers', 'Reply-All Crew', 'Deadline Dodgers', 'Snack Drawer Squad'].map((name, i) => ({ id: crypto.randomUUID(), name, color: teamColors[i] }));
export function createSession(activity: Activity): AnySession {
  const now = new Date().toISOString();
  return { formatVersion: 1, id: crypto.randomUUID(), title: 'Our Fun Friday', activityId: activity.id, activityVersion: activity.version, segmentId: 'default', createdAt: now, updatedAt: now, isDemo: false, phase: 'setup', setupStepId: activity.setupSteps[0].id, people: [], facePairs: [], teams: newTeams(), scoreEntries: [], settings: activity.defaultSettings(), game: activity.createInitialState(), assets: {} };
}
const rect = z.object({ x: z.number().min(0).max(1), y: z.number().min(0).max(1), width: z.number().positive().max(1), height: z.number().positive().max(1) }).refine(r => r.x + r.width <= 1.00001 && r.y + r.height <= 1.00001, 'Crop lies outside the image');
const crop = z.object({ sourceImageId: z.string(), faceBox: rect, padding: z.object({ top: z.number().min(0).max(3), right: z.number().min(0).max(3), bottom: z.number().min(0).max(3), left: z.number().min(0).max(3) }), cropImageId: z.string().optional() });
const schema = z.object({
  formatVersion: z.literal(1), id: z.string(), title: z.string(), activityId: z.string(), activityVersion: z.number().int().positive(), segmentId: z.string(), createdAt: z.string(), updatedAt: z.string(), isDemo: z.boolean(), phase: z.enum(['setup', 'play', 'finale']), setupStepId: z.string(),
  people: z.array(z.object({ id: z.string(), name: z.string(), funFact: z.string(), included: z.boolean(), facePairId: z.string() })).max(500),
  facePairs: z.array(z.object({ id: z.string(), number: z.number().int().positive(), color: z.string(), now: crop.optional(), then: crop.optional(), matchMethod: z.enum(['automatic', 'manual']), reviewStatus: z.enum(['suggested', 'confirmed', 'unmatched']) })).max(1000),
  teams: z.array(z.object({ id: z.string(), name: z.string().min(1), color: z.string().regex(/^#[0-9a-f]{6}$/i) })).min(1).max(8),
  scoreEntries: z.array(z.object({ id: z.string(), teamId: z.string(), segmentId: z.string().optional(), roundId: z.string().optional(), kind: z.enum(['round-award', 'steal-award', 'manual-adjustment', 'wager']), points: z.number().int(), active: z.boolean() })),
  assets: z.record(z.string(), z.object({ id: z.string(), name: z.string(), width: z.number().positive(), height: z.number().positive(), mime: z.string() })), settings: z.unknown(), game: z.unknown(),
});
export function validateSession(raw: unknown): AnySession {
  const saved = schema.parse(raw);
  const activity = getActivity(saved.activityId);
  if (!activity) throw new Error('This ZIP uses an activity that is not installed.');
  if (saved.activityVersion > activity.version) throw new Error('This session needs a newer version of Fun Friday Studio.');
  const data = saved.activityVersion < activity.version ? activity.migrate(saved, saved.activityVersion) : saved;
  const session = { ...saved, activityVersion: activity.version, settings: activity.settingsSchema.parse(data.settings), game: activity.stateSchema.parse(data.game) };
  for (const pair of session.facePairs) for (const face of [pair.now, pair.then]) {
    if (face && (!session.assets[face.sourceImageId] || (face.cropImageId && !session.assets[face.cropImageId]))) throw new Error('A face references a missing image in this session.');
  }
  if (session.people.some(p => !session.facePairs.some(f => f.id === p.facePairId))) throw new Error('A person references a missing face pair.');
  const ids = (items: {id: string}[]) => new Set(items.map(i => i.id)).size === items.length;
  if (![session.people, session.facePairs, session.teams, session.scoreEntries].every(ids)) throw new Error('The session contains duplicate identifiers.');
  if (session.scoreEntries.some(e => !session.teams.some(t => t.id === e.teamId))) throw new Error('A score references an unknown team.');
  const issues = activity.validateSession?.(session) ?? [];
  if (issues.length) throw new Error(issues[0]);
  return session;
}
