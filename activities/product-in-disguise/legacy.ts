import { Clapperboard, Users, Eye } from 'lucide-react';
import type { Activity } from '../../src/core/types';
import { Setup } from './Setup';
import { Stage } from './Stage';
import { Finale } from './Finale';
import { Preview } from './Preview';
import { settingsSchema, stateSchema, initialState, type Settings, type Game, type Context } from './types';
import { advance, briefsMatch, confirmClues, hasProgress, holdClock, lockGuesses, markRemainingMissed, prepareBriefs, progressLabel, releaseClock, reveal, scoreTeam, startNewGame, toggleClock, validateSession } from './logic';
import './style.css';

export const productInDisguise: Activity<Settings, Game> = {
  id: 'product-in-disguise', version: 1, order: 3, name: 'Product in Disguise',
  description: 'Turn an everyday product into a ridiculous commercial. Other teams guess what you are selling before the big reveal.', icon: Clapperboard, estimatedMinutes: 35,
  card: { label: 'THE AD BREAK', eyebrow: 'ORDINARY PRODUCT. EXTRAORDINARY AD.', tags: [{ icon: Users, text: '15–30 people' }, { icon: Eye, text: 'Guessing teams score' }, { text: '30–45 minutes' }] },
  setupSteps: [{ id: 'game', title: 'Game setup', View: Setup, validate: (s, e) => e.teams.length < 2 || e.teams.length > 8 || e.teams.some(t => !t.name.trim()) ? ['Use 2–8 named event teams.'] : !briefsMatch(s.game, e) ? ['Prepare team briefs first.'] : !s.settings.briefsShared ? ['Share each team’s brief privately before starting.'] : [] }],
  settingsSchema, stateSchema, settingsFields: [], Stage, Finale, Preview,
  defaultSettings: () => ({ preparationMinutes: 10, performanceSeconds: 75, guessSeconds: 45, briefsShared: false }),
  createInitialState: initialState, startNewGame, hasProgress, progressLabel,
  onPause: holdClock, onResume: releaseClock, validateSession, remapImages: game => game,
  migrate: (saved, version) => {
    if (version !== 1) throw new Error(`Product in Disguise version ${version} is not supported.`);
    const s = saved as { settings: unknown; game: unknown };
    return { settings: settingsSchema.parse(s.settings), game: stateSchema.parse(s.game) };
  },
  createDemo: async (segment, event) => {
    const demoEvent = { ...event, isDemo: true, teams: event.teams.slice(0, 3) };
    prepareBriefs(segment, demoEvent); segment.settings.briefsShared = true;
    return { segment, event: demoEvent };
  },
  shortcuts: [
    { key: 'n', label: 'Next', run: ctx => ctx.update(s => advance(s)) },
    { key: 'c', label: 'Clues', run: ctx => ctx.update(s => confirmClues(s)) },
    { key: 'l', label: 'Lock', run: ctx => ctx.update(s => lockGuesses(s)) },
    { key: 'r', label: 'Reveal', run: ctx => ctx.update(reveal) },
    { key: 'm', label: 'Missed', run: markRemainingMissed },
    { key: 't', label: 'Timer', run: ctx => ctx.update(s => toggleClock(s)) },
    ...Array.from({ length: 8 }, (_, i) => ({ key: String(i + 1), label: 'Award 1–8', run: (ctx: Context) => scoreTeam(ctx, i) })),
  ],
};
