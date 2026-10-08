import { Search, Users, Check } from 'lucide-react';
import type { Activity } from '../../src/core/types';
import { Setup } from './Setup';
import { Stage } from './Stage';
import { Finale } from './Finale';
import { Preview } from './Preview';
import { settingsSchema, stateSchema, initialState, type Settings, type Game } from './types';
import { availableRounds } from './content';
import { advance, reveal, showClue, scoreTeam, startNewGame, holdClock, releaseClock, toggleClock } from './logic';
import './style.css';
export const realOrRidiculous: Activity<Settings, Game> = {
  id: 'real-or-ridiculous', version: 1, name: 'Real or Ridiculous?', description: 'Two documented inventions. One fictional pitch. Debate your suspicions, follow one more clue, and decide whether to stick or switch.', icon: Search, order: 2, estimatedMinutes: 20,
  card: { label: 'THE CURIOSITY ONE', eyebrow: 'SOMEBODY MADE THAT?', tags: [{ icon: Users, text: '10–40 people' }, { icon: Check, text: 'No props or phones' }, { text: 'Every team, every round' }] },
  setupSteps: [{ id: 'game', title: 'Game setup', View: Setup, validate: (s, e) => e.teams.length < 2 || e.teams.some(t => !t.name.trim()) ? ['Add at least two named event teams.'] : s.settings.rounds > availableRounds ? ['Add more inventions to the content bank.'] : [] }],
  settingsSchema, stateSchema, settingsFields: [], Stage, Finale, Preview,
  createInitialState: initialState, defaultSettings: () => ({ rounds: 6, seconds: 60 }), startNewGame,
  hasProgress: g => g.step !== 'rules', progressLabel: g => `${g.index + (g.step === 'reveal' ? 1 : 0)} of ${g.deck.length} cases revealed.`,
  onPause: holdClock, onResume: releaseClock, remapImages: g => g,
  validateSession: s => s.phase !== 'setup' && !s.game.deck.length ? ['The saved activity has no rounds.'] : [],
  migrate: (saved, version) => { if (version !== 1) throw new Error(`Real or Ridiculous? version ${version} is not supported.`); const s = saved as { settings: unknown; game: unknown }; return { settings: settingsSchema.parse(s.settings), game: stateSchema.parse(s.game) }; },
  createDemo: async (segment, event) => ({ segment, event: { ...event, isDemo: true, teams: event.teams.slice(0, 3) } }),
  shortcuts: [
    { key: 'n', label: 'Start / vote / next', run: ctx => ctx.update(s => advance(s)) },
    { key: 'h', label: 'Clue', run: ctx => ctx.update(s => showClue(s)) },
    { key: 'r', label: 'Reveal', run: ctx => ctx.update(s => reveal(s)) },
    { key: 't', label: 'Timer', run: ctx => ctx.update(s => toggleClock(s)) },
    ...Array.from({ length: 8 }, (_, i) => ({ key: String(i + 1), label: 'Award (1–8)', run: (ctx: Parameters<typeof scoreTeam>[0]) => scoreTeam(ctx, i) })),
  ],
};
