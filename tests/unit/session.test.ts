import { beforeAll, describe, expect, it } from 'vitest';
import eventV2 from '../fixtures/event-v2.json';
import { discoverActivities, getActivity } from '../../src/core/registry';
import { validateEvent } from '../../src/core/session';

beforeAll(async () => { await discoverActivities(); });
// A valid version 3 session to mutate for the rejection tests below.
const v3 = () => structuredClone(validateEvent(eventV2));

describe('validateEvent', () => {
  it('migrates a valid v2 document to v3 and round-trips it unchanged', () => {
    const once = validateEvent(eventV2);
    expect(once.formatVersion).toBe(3);
    expect(once.photoSets).toHaveLength(1);
    expect(once.segments).toHaveLength(1);
    expect(once.segments[0].activityId).toBe('childhood-vs-now');
    expect(validateEvent(JSON.parse(JSON.stringify(once)))).toEqual(once);
  });
  it('upgrades a version 1 Act It Out segment on load', () => {
    const v1 = { id: 'aio', activityId: 'act-it-out', activityVersion: 1, title: 'Act It Out', status: 'setup', setupStepId: 'prompts', weight: 1,
      settings: { categories: ['Actions'], customPrompts: ['Kalaripayattu'], turnSeconds: 90, roundsPerTeam: 1 },
      game: { deck: [], cursor: 0, turns: [], currentTurnIndex: 0, timer: { durationMs: 90_000 } } };
    const loaded = validateEvent({ ...eventV2, segments: [...eventV2.segments, v1] }).segments[1];
    const settings = loaded.settings as { rule: string; categories: { name: string; on: boolean; prompts: string[] }[] };
    expect(loaded.activityVersion).toBe(2);
    expect(settings.rule).toBe('act');
    expect(settings.categories.filter(c => c.on).map(c => c.name)).toEqual(['Your own', 'Actions']);
    expect(settings.categories[0].prompts).toEqual(['Kalaripayattu']);
  });
  it('rejects a segment whose activity is not installed', () => {
    const broken = { ...eventV2, segments: [{ ...eventV2.segments[0], activityId: 'not-real' }] };
    expect(() => validateEvent(broken)).toThrow(/not installed/);
  });
  it('rejects a score entry naming an unknown team', () => {
    const broken = { ...eventV2, scoreEntries: [{ ...eventV2.scoreEntries[0], teamId: 'ghost' }] };
    expect(() => validateEvent(broken)).toThrow(/unknown team/);
  });
  it('rejects a score entry naming a segment not in the event', () => {
    const broken = { ...eventV2, scoreEntries: [{ ...eventV2.scoreEntries[0], segmentId: 'ghost-segment' }] };
    expect(() => validateEvent(broken)).toThrow(/not in this event/);
  });
  it('rejects currentSegmentIndex beyond the end of segments', () => {
    const broken = { ...eventV2, currentSegmentIndex: 5 };
    expect(() => validateEvent(broken)).toThrow(/not in its line-up/);
  });
  it('rejects duplicate ids', () => {
    const broken = { ...eventV2, teams: [...eventV2.teams, { ...eventV2.teams[0] }] };
    expect(() => validateEvent(broken)).toThrow(/duplicate identifiers/);
  });
  it('rejects a formatVersion 1 document, pointing the host at Export pairs', () => {
    const v1 = { ...eventV2, formatVersion: 1 };
    expect(() => validateEvent(v1)).toThrow(/Export pairs/);
  });
  it('rejects a face pair naming an unknown photo set', () => {
    const broken = v3(); broken.facePairs[0].setId = 'ghost-set';
    expect(() => validateEvent(broken)).toThrow(/unknown photo set/);
  });
  it('rejects a face pair whose photo belongs to a different photo set', () => {
    const broken = v3(); broken.facePairs[0].now!.sourceImageId = broken.photoSets[0].thenImageId!;
    expect(() => validateEvent(broken)).toThrow(/different photo set/);
  });
  it('rejects two photo sets that share a position', () => {
    const broken = v3(); broken.photoSets.push({ ...broken.photoSets[0], id: 'set-2' });
    expect(() => validateEvent(broken)).toThrow(/share a position/);
  });
  it('rejects gaps in photo-set order', () => {
    const broken = v3(); broken.photoSets.push({ ...broken.photoSets[0], id: 'set-2', name: 'Second group', order: 2 });
    expect(() => validateEvent(broken)).toThrow(/contiguous/);
  });
  it('rejects a photo set that references a missing image', () => {
    const broken = v3(); broken.photoSets[0].nowImageId = 'ghost-image';
    expect(() => validateEvent(broken)).toThrow(/missing image/);
  });
  it('rejects a single-photo set that does not hold exactly one person', () => {
    const broken = v3(); broken.photoSets.push({ id: 'solo', name: 'Priya', kind: 'single', previews: {}, order: 1 });
    expect(() => validateEvent(broken)).toThrow(/exactly one person/);
  });
  it('falls back an unknown setupStepId to the activity\'s first setup step', () => {
    const broken = v3(); broken.segments[0].setupStepId = 'not-a-real-step';
    const loaded = validateEvent(broken);
    expect(loaded.segments[0].setupStepId).toBe(getActivity('childhood-vs-now')!.setupSteps[0].id);
  });
});
