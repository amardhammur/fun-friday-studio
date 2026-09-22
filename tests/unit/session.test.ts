import { beforeAll, describe, expect, it } from 'vitest';
import eventV2 from '../fixtures/event-v2.json';
import { discoverActivities } from '../../src/core/registry';
import { validateEvent } from '../../src/core/session';

beforeAll(async () => { await discoverActivities(); });

describe('validateEvent', () => {
  it('accepts a valid v2 document and round-trips it unchanged', () => {
    const once = validateEvent(eventV2);
    expect(once.formatVersion).toBe(2);
    expect(once.segments).toHaveLength(1);
    expect(once.segments[0].activityId).toBe('childhood-vs-now');
    expect(validateEvent(JSON.parse(JSON.stringify(once)))).toEqual(once);
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
});
