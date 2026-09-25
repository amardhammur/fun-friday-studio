import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { expect, it } from 'vitest';
import { createEvent } from '../../src/core/event';
import { validateEvent } from '../../src/core/session';
import { resetEventProgress } from '../../src/core/people/event-library';
import { Wager } from '../../src/core/play/WagerView';
import { maxWager, setWagerResult } from '../../src/core/play/wager';

function fixture(stage: 'betting' | 'question' | 'answer' | 'results' = 'betting') {
  const event = createEvent();
  event.phase = 'wager';
  event.teams = [{ id: 'a', name: 'Comets', color: '#abcdef' }, { id: 'b', name: 'Moons', color: '#fedcba' }];
  event.wager = { question: 'Which planet?', answer: 'Neptune', bets: { a: 10, b: 5 }, ...{ stage } };
  event.scoreEntries = [{ id: 'base', teamId: 'a', kind: 'manual-adjustment', points: 20, active: true }];
  return event;
}
const render = (event: ReturnType<typeof fixture>) => renderToStaticMarkup(createElement(Wager, { event, onChange: () => {}, onFinish: () => {} }));
it('reveals only the question and keeps the answer behind a separate host click', () => {
  const event = validateEvent(JSON.parse(JSON.stringify(fixture('question'))));
  const html = render(event);
  expect(html).toContain('Which planet?');
  expect(html).not.toContain('Neptune');
  expect(html).toContain('Reveal the answer');
  expect(html).not.toContain('type="number"');
});
it('keeps committed bets locked after reloading with one team marked', () => {
  const event = fixture('results');
  event.scoreEntries = setWagerResult(event.scoreEntries, 'a', 10, true);
  const restored = validateEvent(JSON.parse(JSON.stringify(event)));
  const html = render(restored);
  expect(html).toContain('Neptune');
  expect(html).not.toContain('type="number"');
  expect(restored.wager?.bets).toEqual({ a: 10, b: 5 });
  expect(restored.scoreEntries.find(e => e.id === 'wager-a')?.points).toBe(10);
  expect(html).toContain('aria-pressed="true"');
});
it.each([true, false])('calculates caps from pre-wager scores after a result (%s)', correct => {
  const event = fixture();
  const entries = setWagerResult(event.scoreEntries, 'a', 10, correct);
  expect(maxWager(entries, 'a')).toBe(20);
});
it('keeps legacy saves with wager awards out of betting', () => {
  const event = fixture();
  delete (event.wager as { stage?: string }).stage;
  event.scoreEntries = setWagerResult(event.scoreEntries, 'a', 10, true);
  expect(render(validateEvent(event))).not.toContain('type="number"');
});

it('reopens betting only when event progress is explicitly reset', () => {
  const event = fixture('results');
  resetEventProgress(event);
  expect(render(event)).toContain('type="number"');
  expect(event.wager?.bets).toEqual({});
});
