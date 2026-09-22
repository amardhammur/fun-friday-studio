import { z } from 'zod';
import { getActivity } from './registry';
import { segmentView as segmentViewFor } from './event';
import type { EventSession, Segment } from './types';
export { newTeams, teamColors } from './event';
const rect = z.object({ x: z.number().min(0).max(1), y: z.number().min(0).max(1), width: z.number().positive().max(1), height: z.number().positive().max(1) }).refine(r => r.x + r.width <= 1.00001 && r.y + r.height <= 1.00001, 'Crop lies outside the image');
const crop = z.object({ sourceImageId: z.string(), faceBox: rect, padding: z.object({ top: z.number().min(0).max(3), right: z.number().min(0).max(3), bottom: z.number().min(0).max(3), left: z.number().min(0).max(3) }), cropImageId: z.string().optional() });
const segmentSchema = z.object({
  id: z.string(), activityId: z.string(), activityVersion: z.number().int().positive(), title: z.string(),
  settings: z.unknown(), game: z.unknown(),
  status: z.enum(['pending', 'setup', 'play', 'finale', 'done']), setupStepId: z.string(),
  weight: z.number().int().min(1).max(5),
});
const schema = z.object({
  formatVersion: z.literal(2), id: z.string(), title: z.string(), createdAt: z.string(), updatedAt: z.string(), isDemo: z.boolean(),
  segments: z.array(segmentSchema).max(12), currentSegmentIndex: z.number().int().min(0),
  phase: z.enum(['lineup', 'segment', 'interstitial', 'wager', 'finale']),
  wager: z.object({ question: z.string(), answer: z.string(), bets: z.record(z.string(), z.number().int().min(0)) }).optional(),
  correctPoints: z.number().int().min(1).max(10), stealPoints: z.number().int().min(0).max(10),
  people: z.array(z.object({ id: z.string(), name: z.string(), funFact: z.string(), included: z.boolean(), facePairId: z.string() })).max(500),
  facePairs: z.array(z.object({ id: z.string(), number: z.number().int().positive(), color: z.string(), now: crop.optional(), then: crop.optional(), matchMethod: z.enum(['automatic', 'manual']), reviewStatus: z.enum(['suggested', 'confirmed', 'unmatched']) })).max(1000),
  teams: z.array(z.object({ id: z.string(), name: z.string().min(1), color: z.string().regex(/^#[0-9a-f]{6}$/i) })).min(1).max(8),
  scoreEntries: z.array(z.object({ id: z.string(), teamId: z.string(), segmentId: z.string().optional(), roundId: z.string().optional(), kind: z.enum(['round-award', 'steal-award', 'manual-adjustment', 'wager']), points: z.number().int(), active: z.boolean() })),
  assets: z.record(z.string(), z.object({ id: z.string(), name: z.string(), width: z.number().positive(), height: z.number().positive(), mime: z.string() })),
});
// A v1 document is one activity. Wrap it as a single segment so old sessions and old ZIPs keep
// opening; everything shared already sat at the top level and stays there.
export function migrateV1(raw: unknown): unknown {
  const v1 = raw as Record<string, any>;
  const segment = {
    id: crypto.randomUUID(), activityId: v1.activityId, activityVersion: v1.activityVersion,
    title: getActivity(v1.activityId)?.name ?? v1.activityId,
    settings: v1.settings, game: v1.game,
    status: v1.phase, setupStepId: v1.setupStepId, weight: 1,
  };
  const { activityId, activityVersion, settings, game, phase, setupStepId, ...shared } = v1;
  return { ...shared, formatVersion: 2, segments: [segment], currentSegmentIndex: 0, phase: 'segment', correctPoints: 2, stealPoints: 1 };
}
export function validateEvent(raw: unknown): EventSession {
  const version = (raw as { formatVersion?: unknown })?.formatVersion;
  if (version !== 1 && version !== 2) throw new Error('This session needs a newer version of Fun Friday Studio.');
  const event = schema.parse(version === 1 ? migrateV1(raw) : raw);
  const segments: Segment[] = event.segments.map(segment => {
    const activity = getActivity(segment.activityId);
    if (!activity) throw new Error(`This session uses an activity that is not installed: ${segment.activityId}.`);
    if (segment.activityVersion > activity.version) throw new Error('This session needs a newer version of Fun Friday Studio.');
    const data = segment.activityVersion < activity.version ? activity.migrate(segment, segment.activityVersion) : segment;
    return { ...segment, activityVersion: activity.version, settings: activity.settingsSchema.parse(data.settings), game: activity.stateSchema.parse(data.game) };
  });
  const session: EventSession = { ...event, segments };
  if (session.segments.length && session.currentSegmentIndex >= session.segments.length) throw new Error('The event points at an activity that is not in its line-up.');
  for (const pair of session.facePairs) for (const face of [pair.now, pair.then]) {
    if (face && (!session.assets[face.sourceImageId] || (face.cropImageId && !session.assets[face.cropImageId]))) throw new Error('A face references a missing image in this session.');
  }
  if (session.people.some(p => !session.facePairs.some(f => f.id === p.facePairId))) throw new Error('A person references a missing face pair.');
  const ids = (items: { id: string }[]) => new Set(items.map(i => i.id)).size === items.length;
  if (![session.people, session.facePairs, session.teams, session.scoreEntries, session.segments].every(ids)) throw new Error('The session contains duplicate identifiers.');
  if (session.scoreEntries.some(e => !session.teams.some(t => t.id === e.teamId))) throw new Error('A score references an unknown team.');
  if (session.scoreEntries.some(e => e.segmentId && !session.segments.some(s => s.id === e.segmentId))) throw new Error('A score references an activity that is not in this event.');
  for (const [index, segment] of session.segments.entries()) {
    const issues = getActivity(segment.activityId)!.validateSession?.(segmentViewFor(session, index)) ?? [];
    if (issues.length) throw new Error(issues[0]);
  }
  return session;
}
