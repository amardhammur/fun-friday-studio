import { Lightbulb, Users, Check } from 'lucide-react';
import type { Activity } from '../../src/core/types';
import { settingsSchema, stateSchema, initialState, type Settings, type Game } from './types';
import { advance, reveal, scoreTeam, startNewGame, holdClock, releaseClock, toggleClock } from './logic';
import { Setup, Stage, Finale, Preview } from './Views';
export const waitWhy: Activity<Settings, Game> = {
  id: 'wait-why', version: 1, archived: true, name: 'Wait, Why?', description: 'Small puzzles. Big aha moments. Think together, commit to a prediction, and discover why the answer makes sense.', icon: Lightbulb, order: 2, estimatedMinutes: 20,
  card: { label: 'THE CURIOSITY ONE', eyebrow: 'EVERY TEAM. EVERY ROUND.', tags: [{ icon: Users, text: '10–40 people' }, { icon: Check, text: 'No prep or phones' }, { text: '15–30 minutes' }] },
  setupSteps: [{ id: 'game', title: 'Game setup', View: Setup, validate: (_s, e) => e.teams.length && e.teams.every(t => t.name.trim()) ? [] : ['Add named event teams first.'] }],
  settingsSchema, stateSchema, settingsFields: [], Stage, Finale, Preview,
  createInitialState: initialState, defaultSettings: () => ({ rounds: 8, seconds: 60 }), startNewGame,
  hasProgress: g => g.step !== 'rules', progressLabel: g => `${g.index + (g.step === 'answer' ? 1 : 0)} of ${g.deck.length} puzzles revealed.`,
  onPause: holdClock, onResume: releaseClock, remapImages: g => g,
  validateSession: (s) => s.phase !== 'setup' && !s.game.deck.length ? ['The saved game has no puzzles.'] : [],
  migrate: (saved, version) => { if (version !== 1) throw new Error(`Wait, Why? version ${version} is not supported.`); const s = saved as { settings: unknown; game: unknown }; return { settings: settingsSchema.parse(s.settings), game: stateSchema.parse(s.game) }; },
  createDemo: async (segment, event) => ({ segment, event: { ...event, isDemo: true, teams: event.teams.slice(0, 3) } }),
  shortcuts: [
    { key: 'n', label: 'Start / next', run: ctx => ctx.update(s => advance(s)) },
    { key: 'r', label: 'Reveal', run: ctx => ctx.update(s => reveal(s)) },
    { key: 't', label: 'Timer', run: ctx => ctx.update(s => toggleClock(s)) },
    ...Array.from({ length: 8 }, (_, i) => ({ key: String(i + 1), label: 'Award team (1–8)', run: (ctx: Parameters<typeof scoreTeam>[0]) => scoreTeam(ctx, i) })),
  ],
};
