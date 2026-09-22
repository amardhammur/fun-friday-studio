import { describe, expect, it } from 'vitest';
import { validateSession } from '../../src/core/session';
import { getActivity, registerActivity } from '../../src/core/registry';
import { childhoodVsNow } from '../../activities/childhood-vs-now/activity';
import type { AnySession } from '../../src/core/types';

if (!getActivity(childhoodVsNow.id)) registerActivity(childhoodVsNow);

// Derived from the demoSession() fixture in tests/unit/pairs.test.ts:300, trimmed to the
// smallest shape that also satisfies the activity's settings/state schemas and the
// team/score invariants validateSession enforces, so it can go through the real parse path.
function validSession(): AnySession {
  return {
    formatVersion: 1, id: 'session-id', title: 'Demo', activityId: 'childhood-vs-now',
    activityVersion: 1, segmentId: 'default', points: { correct: 2, steal: 1 }, createdAt: '', updatedAt: '', isDemo: false, phase: 'setup',
    setupStepId: 'people',
    teams: [{ id: 'team-id', name: 'Team 1', color: '#f7d873' }],
    scoreEntries: [],
    settings: { shuffle: true, matchingTolerance: .12 },
    assets: {},
    facePairs: [],
    people: [],
    game: { previews: {}, rounds: [], currentRoundIndex: 0, finale: { wipePosition: 0 } },
  };
}

describe('session schema compatibility', () => {
  it('defaults a missing segmentId to "default" so pre-segment session documents still import', () => {
    const raw = validSession() as unknown as Record<string, unknown>;
    delete raw.segmentId;
    const result = validateSession(raw);
    expect(result.segmentId).toBe('default');
  });
});
