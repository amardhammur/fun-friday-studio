import { createElement } from 'react';
import { z } from 'zod';
import { Clapperboard, Trophy, Users } from 'lucide-react';
import type { Activity, ActivityContext, ActivitySegment } from '../../src/core/types';
import { productInDisguise as legacy } from './legacy';
import type { Settings as LegacySettings, Game as LegacyGame, Context as LegacyContext } from './types';
import { Setup } from './performance/Setup';
import { Stage } from './performance/Stage';
import { Finale } from './performance/Finale';
import { Preview } from './performance/Preview';
import * as play from './performance/logic';
import { migrateVotingGame } from './performance/migration';
import { defaultSettings, initialState, settingsSchema, stateSchema, type Settings, type Game, type Context, type Segment } from './performance/types';
import './performance/style.css';

type SavedSettings = Settings | LegacySettings;
type SavedGame = Game | LegacyGame;
type SavedContext = ActivityContext<SavedSettings, SavedGame>;
const isLegacy = (game: SavedGame): game is LegacyGame => !('mode' in game);
const legacyContext = (ctx: SavedContext) => ctx as LegacyContext;
const performanceContext = (ctx: SavedContext) => ctx as Context;

// Keep a running version-one game playable. Fresh setups and Start over use the
// performance game; neither migration nor loading rewrites historical scores.
export const productInDisguise: Activity<SavedSettings, SavedGame> = {
  id: legacy.id, version: 4, order: 3, name: 'Commercial Clash',
  description: 'Turn an everyday product into a funny skit. Perform your ad and let the judge panel score it offline.',
  icon: Clapperboard, estimatedMinutes: 34,
  card: { label: 'THE AD BREAK', eyebrow: 'BIG DRAMA. TINY PRODUCT.', tags: [{ icon: Users, text: '15–30 people' }, { icon: Trophy, text: 'Judge panel' }, { text: '30–45 minutes' }] },
  setupSteps: [{ id: 'game', title: 'Game setup', View: ctx => isLegacy(ctx.segment.game) ? createElement(legacy.setupSteps[0].View, legacyContext(ctx)) : createElement(Setup, performanceContext(ctx)), validate: (s, e) => isLegacy(s.game) ? legacy.setupSteps[0].validate(s as ActivitySegment<LegacySettings, LegacyGame>, e) : play.validTeams(e) ? [] : ['Use 3–8 named event teams.'] }],
  settingsSchema: z.union([settingsSchema, legacy.settingsSchema]), stateSchema: z.union([stateSchema, legacy.stateSchema]), settingsFields: [],
  Stage: ctx => isLegacy(ctx.segment.game) ? createElement(legacy.Stage, legacyContext(ctx)) : createElement(Stage, performanceContext(ctx)),
  Finale: ctx => isLegacy(ctx.segment.game) ? createElement(legacy.Finale!, legacyContext(ctx)) : createElement(Finale, performanceContext(ctx)),
  Preview, defaultSettings, createInitialState: initialState,
  preparePeople: s => { if (!isLegacy(s.game) && !('mode' in s.settings)) s.settings = defaultSettings(); },
  startNewGame: (s, e) => {
    if (isLegacy(s.game)) legacy.startNewGame(s as ActivitySegment<LegacySettings, LegacyGame>, e);
    else { if (!('mode' in s.settings)) s.settings = defaultSettings(); play.startNewGame(s as Segment, e); }
  },
  hasProgress: game => isLegacy(game) ? legacy.hasProgress!(game) : play.hasProgress(game),
  progressLabel: game => isLegacy(game) ? legacy.progressLabel!(game) : play.progressLabel(game),
  onPause: s => isLegacy(s.game) ? legacy.onPause!(s as ActivitySegment<LegacySettings, LegacyGame>) : play.holdClock(s as Segment),
  onResume: s => isLegacy(s.game) ? legacy.onResume!(s as ActivitySegment<LegacySettings, LegacyGame>) : play.releaseClock(s as Segment),
  validateSession: (s, e) => {
    if (isLegacy(s.game)) return 'mode' in s.settings ? ['The saved game and settings do not match.'] : legacy.validateSession!(s as ActivitySegment<LegacySettings, LegacyGame>, e);
    return 'mode' in s.settings ? play.validateSession(s as Segment, e) : ['The saved game and settings do not match.'];
  },
  remapImages: game => game,
  migrate: (saved, version) => {
    if (version === 1) {
      const data = legacy.migrate(saved, 1);
      const phase = saved as { status?: string; phase?: string };
      const started = ['play', 'finale', 'done'].includes(phase.status ?? phase.phase ?? '');
      return started || legacy.hasProgress!(data.game) ? data : { settings: defaultSettings(), game: initialState() };
    }
    if (version === 2 || version === 3 || version === 4) {
      const s = saved as { settings: unknown; game: unknown; status?: string; phase?: string };
      if (version < 4 && (s.game as { mode?: string }).mode === 'commercial-clash') return migrateVotingGame(s, version);
      return { settings: productInDisguise.settingsSchema.parse(s.settings), game: productInDisguise.stateSchema.parse(s.game) };
    }
    throw new Error(`Commercial Clash version ${version} is not supported.`);
  },
  createDemo: async (segment, event) => ({ segment, event: { ...event, isDemo: true, teams: event.teams.slice(0, 3) } }),
  shortcuts: [
    { key: 's', label: 'Spin', run: ctx => { if (!isLegacy(ctx.segment.game)) play.spin(performanceContext(ctx)); } },
    { key: 'n', label: 'Next', run: ctx => { if (isLegacy(ctx.segment.game)) legacy.shortcuts.find(s => s.key === 'n')!.run(legacyContext(ctx)); else play.next(performanceContext(ctx)); } },
    { key: 'r', label: 'Results', run: ctx => { if (isLegacy(ctx.segment.game)) legacy.shortcuts.find(s => s.key === 'r')!.run(legacyContext(ctx)); else play.finishJudging(performanceContext(ctx)); } },
    { key: 't', label: 'Timer', run: ctx => { if (isLegacy(ctx.segment.game)) legacy.shortcuts.find(s => s.key === 't')!.run(legacyContext(ctx)); else ctx.update(s => play.toggleClock(s as Segment)); } },
  ],
};
