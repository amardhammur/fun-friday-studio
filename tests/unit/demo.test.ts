import { describe, expect, it } from 'vitest';
import { createDemoEvent } from '../../src/core/demo';
import type { Activity } from '../../src/core/types';

describe('activity demo contract', () => {
  it('marks activity-provided sample data as a demo even when the activity omits the flag', async () => {
    const activity = {
      id: 'future-activity', version: 1, name: 'Future activity',
      setupSteps: [{ id: 'settings' }], defaultSettings: () => ({}), createInitialState: () => ({}),
      createDemo: async (segment, event) => ({ segment, event: { ...event, isDemo: false, title: 'Custom sample' } }),
      startNewGame: segment => { segment.phase = 'play'; },
    } as Activity;
    const result = await createDemoEvent(activity);
    expect(result.isDemo).toBe(true);
    expect(result.title).toBe('Custom sample');
    expect(result.segments[0].activityId).toBe('future-activity');
    expect(result.segments[0].status).toBe('play');
    expect(result.people).toEqual([]);
  });
});
