import { MessageCircle, Trophy, Users } from 'lucide-react';
import type { Activity } from '../../src/core/types';
import { Setup } from './Setup';
import { Stage } from './Stage';
import { Finale } from './Finale';
import { Preview } from './Preview';
import { hasProgress, progressLabel, setupIssues, startNewGame, validateSession } from './logic';
import { starterQuestions } from './questions';
import { initialState, settingsSchema, stateSchema, type GameState, type Settings } from './types';
import './style.css';

export const sharmilaAwards: Activity<Settings, GameState> = {
  id: 'sharmila-awards', version: 2, name: 'Sharmila Awards',
  description: 'Wrong answers. Full confidence. Give funny, deliberately wrong answers to simple engineering questions.', icon: Trophy,
  order: 5, estimatedMinutes: 10,
  card: { label: 'SHARMILA AWARDS', eyebrow: 'WRONG ANSWERS. FULL CONFIDENCE.', tags: [{ icon: Users, text: '1 round · every team' }, { icon: MessageCircle, text: 'Simple engineering questions' }, { text: 'Thumbs up +1 · thumbs down 0' }] },
  setupSteps: [{ id: 'game', title: 'Game setup', View: Setup, validate: (s, e) => setupIssues(s.settings, e) }],
  settingsSchema, stateSchema, settingsFields: [], Stage, Finale, Preview, hasProgress, progressLabel, validateSession,
  remapImages: game => game, shortcuts: [],
  createInitialState: initialState,
  defaultSettings: () => ({ questionText: starterQuestions.join('\n') }),
  startNewGame,
  createDemo: async (segment, event) => {
    event.title = 'Sharmila Awards · demo';
    return { segment, event };
  },
  migrate: (saved, fromVersion) => {
    const raw = saved as { settings: unknown; game: unknown };
    const game = structuredClone(raw.game) as GameState;
    if (fromVersion === 1) {
      if (game.turns.some(t => t.round === 2 && t.draw)) game.legacyTwoRounds = true;
      else {
        // Pending second-round turns have no awards. Removing them keeps all confirmed results intact.
        game.turns = game.turns.filter(t => t.round === 1);
        game.currentTurnIndex = Math.min(game.currentTurnIndex, Math.max(0, game.turns.length - 1));
      }
    }
    return { settings: settingsSchema.parse(raw.settings), game: stateSchema.parse(game) };
  },
};
