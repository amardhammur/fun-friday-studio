import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { createEvent } from '../../src/core/event';
import { EventFinale } from '../../src/app/EventFinale';
import { Scoreboard } from '../../src/core/teams/Scoreboard';
import { activityEvent } from '../../src/core/event';

const noop = () => {};
describe('event score presentation', () => {
  it('shows activity contributions and unassigned adjustments alongside final totals', () => {
    const event = createEvent();
    event.teams = [{ id: 'a', name: 'Comets', color: '#abcdef' }];
    event.segments = [{ id: 's1', title: 'Opening game', activityId: 'act-it-out', activityVersion: 1, settings: {}, game: {}, status: 'done', setupStepId: 'game', weight: 3 }];
    event.scoreEntries = [
      { id: '1', teamId: 'a', segmentId: 's1', kind: 'round-award', points: 6, active: true },
      { id: '2', teamId: 'a', kind: 'manual-adjustment', points: 2, active: true },
      { id: '3', teamId: 'a', kind: 'wager', points: -1, active: true },
    ];
    const html = renderToStaticMarkup(createElement(EventFinale, { event, onRestart: noop, onHome: noop }));
    expect(html).toContain('Opening game');
    expect(html).toContain('Adjustments');
    expect(html).toContain('Final wager');
    expect(html).toContain('Score breakdown');
  });
  it('clearly labels the live scoreboard as event totals', () => {
    const html = renderToStaticMarkup(createElement(Scoreboard, { event: activityEvent(createEvent()), updateEvent: noop }));
    expect(html).toContain('Overall leaderboard');
    expect(html).toContain('Across all activities');
  });
});
