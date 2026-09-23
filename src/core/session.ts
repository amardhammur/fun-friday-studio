import { z } from 'zod';
import { getActivity } from './registry';
import { activitySegment, activityEvent } from './event';
import type { EventSession, Segment } from './types';
import { migrateEventV2 } from './migrate';
import { MAX_PHOTO_SETS } from './people/photo-sets';
import { MAX_FACE_PAIRS, MAX_PEOPLE } from './people/limits';
export { newTeams, teamColors } from './event';
const rect = z.object({ x: z.number().min(0).max(1), y: z.number().min(0).max(1), width: z.number().positive().max(1), height: z.number().positive().max(1) }).refine(r => r.x + r.width <= 1.00001 && r.y + r.height <= 1.00001, 'Crop lies outside the image');
const crop = z.object({ sourceImageId: z.string(), faceBox: rect, padding: z.object({ top: z.number().min(0).max(3), right: z.number().min(0).max(3), bottom: z.number().min(0).max(3), left: z.number().min(0).max(3) }), cropImageId: z.string().optional() });
const photoSet = z.object({ id: z.string(), name: z.string().trim().min(1).max(80), kind: z.enum(['group', 'single']), nowImageId: z.string().optional(), thenImageId: z.string().optional(), previews: z.record(z.string(), z.string()), order: z.number().int().min(0) });
const segmentSchema = z.object({
  id: z.string(), activityId: z.string(), activityVersion: z.number().int().positive(), title: z.string(),
  settings: z.unknown(), game: z.unknown(),
  status: z.enum(['pending', 'setup', 'play', 'finale', 'done']), setupStepId: z.string(),
  weight: z.number().int().min(1).max(5),
});
const schema = z.object({
  formatVersion: z.literal(3), id: z.string(), title: z.string(), createdAt: z.string(), updatedAt: z.string(), isDemo: z.boolean(),
  segments: z.array(segmentSchema).max(12), currentSegmentIndex: z.number().int().min(0),
  phase: z.enum(['lineup', 'segment', 'interstitial', 'wager', 'finale']),
  wager: z.object({ question: z.string(), answer: z.string(), bets: z.record(z.string(), z.number().int().min(0)) }).optional(),
  correctPoints: z.number().int().min(1).max(10), stealPoints: z.number().int().min(0).max(10),
  people: z.array(z.object({ id: z.string(), name: z.string(), funFact: z.string(), included: z.boolean(), facePairId: z.string() })).max(MAX_PEOPLE),
  facePairs: z.array(z.object({ id: z.string(), number: z.number().int().positive(), color: z.string(), setId: z.string(), now: crop.optional(), then: crop.optional(), matchMethod: z.enum(['automatic', 'manual']), reviewStatus: z.enum(['suggested', 'confirmed', 'unmatched']) })).max(MAX_FACE_PAIRS),
  teams: z.array(z.object({ id: z.string(), name: z.string().min(1), color: z.string().regex(/^#[0-9a-f]{6}$/i) })).min(1).max(8),
  scoreEntries: z.array(z.object({ id: z.string(), teamId: z.string(), segmentId: z.string().optional(), roundId: z.string().optional(), kind: z.enum(['round-award', 'steal-award', 'manual-adjustment', 'wager']), points: z.number().int(), active: z.boolean() })),
  assets: z.record(z.string(), z.object({ id: z.string(), name: z.string(), width: z.number().positive(), height: z.number().positive(), mime: z.string() })),
  photoSets: z.array(photoSet).max(MAX_PHOTO_SETS),
});
export function validateEvent(input: unknown): EventSession {
  let raw = input;
  const version = (raw as { formatVersion?: unknown })?.formatVersion;
  if (version === 1) throw new Error('This session was saved before Fun Friday Studio learned to run events. Please set up your game again — your photos and names are safe in Export pairs.');
  if (version === 2) raw = migrateEventV2(raw as Record<string, unknown>);
  else if (version !== 3) throw new Error('This session needs a newer version of Fun Friday Studio.');
  const event = schema.parse(raw);
  const segments: Segment[] = event.segments.map(segment => {
    const activity = getActivity(segment.activityId);
    if (!activity) throw new Error(`This session uses an activity that is not installed: ${segment.activityId}.`);
    if (segment.activityVersion > activity.version) throw new Error('This session needs a newer version of Fun Friday Studio.');
    const data = segment.activityVersion < activity.version ? activity.migrate(segment, segment.activityVersion) : segment;
    // Setup steps can be renamed between versions; an unknown step falls back to the first one.
    const stepIds = activity.setupSteps.map(step => step.id);
    return { ...segment, setupStepId: stepIds.includes(segment.setupStepId) ? segment.setupStepId : stepIds[0], activityVersion: activity.version, settings: activity.settingsSchema.parse(data.settings), game: activity.stateSchema.parse(data.game) };
  });
  const session: EventSession = { ...event, segments };
  if (session.segments.length && session.currentSegmentIndex >= session.segments.length) throw new Error('The event points at an activity that is not in its line-up.');
  for (const pair of session.facePairs) for (const face of [pair.now, pair.then]) {
    if (face && (!session.assets[face.sourceImageId] || (face.cropImageId && !session.assets[face.cropImageId]))) throw new Error('A face references a missing image in this session.');
  }
  if (session.people.some(p => !session.facePairs.some(f => f.id === p.facePairId))) throw new Error('A person references a missing face pair.');
  for (const set of session.photoSets) for (const id of [set.nowImageId, set.thenImageId, ...Object.keys(set.previews), ...Object.values(set.previews)]) if (id && !session.assets[id]) throw new Error('A photo set references a missing image.');
  if (new Set(session.photoSets.map(set => set.order)).size !== session.photoSets.length) throw new Error('Two photo sets share a position.');
  if ([...session.photoSets].sort((a, b) => a.order - b.order).some((set, index) => set.order !== index)) throw new Error('Photo set positions must be contiguous.');
  for (const pair of session.facePairs) {
    const set = session.photoSets.find(s => s.id === pair.setId);
    if (!set) throw new Error('A face pair references an unknown photo set.');
    if ((pair.now && pair.now.sourceImageId !== set.nowImageId) || (pair.then && pair.then.sourceImageId !== set.thenImageId)) throw new Error('A face uses a photo from a different photo set.');
  }
  for (const set of session.photoSets) if (set.kind === 'single' && session.facePairs.filter(p => p.setId === set.id).length !== 1) throw new Error('A single-photo set must hold exactly one person.');
  const ids = (items: { id: string }[]) => new Set(items.map(i => i.id)).size === items.length;
  if (![session.people, session.facePairs, session.teams, session.scoreEntries, session.segments, session.photoSets].every(ids)) throw new Error('The session contains duplicate identifiers.');
  if (session.scoreEntries.some(e => !session.teams.some(t => t.id === e.teamId))) throw new Error('A score references an unknown team.');
  if (session.scoreEntries.some(e => e.segmentId && !session.segments.some(s => s.id === e.segmentId))) throw new Error('A score references an activity that is not in this event.');
  for (const [index, segment] of session.segments.entries()) {
    const issues = getActivity(segment.activityId)!.validateSession?.(activitySegment(session, index), activityEvent(session)) ?? [];
    if (issues.length) throw new Error(issues[0]);
  }
  return session;
}
