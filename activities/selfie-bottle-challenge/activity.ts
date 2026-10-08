import { BottleWine, Clock, Users } from 'lucide-react';
import type { Activity } from '../../src/core/types';
import { newTeams } from '../../src/core/event';
import { Setup } from './Setup';
import { Stage } from './Stage';
import { Finale } from './Finale';
import { Preview } from './Preview';
import { canVisitTurn, hasProgress, holdClock, progressLabel, releaseClock, setupIssues, startNewGame, validateSession, visitTurn } from './logic';
import { initialState, settingsSchema, stateSchema, type GameState, type Settings } from './types';
import './style.css';

export const selfieBottleChallenge: Activity<Settings, GameState> = {
  id: 'selfie-bottle-challenge', version: 1, name: 'Selfie Bottle Challenge',
  description: 'Face away from a bottle and use your phone’s selfie preview to drop toothpicks into it. Your team can talk you into the perfect aim.', icon: BottleWine,
  order: 4, estimatedMinutes: 20,
  card: { label: 'THE SELFIE CHALLENGE', eyebrow: 'STEADY HANDS, LOUD TEAMMATES', tags: [{ icon: Users, text: '1–3 players per team' }, { icon: Clock, text: '45 or 60 seconds each' }, { text: '1 base point per toothpick' }] },
  // The shell reserves 'game' as the setup step reachable when a prior activity locks the roster.
  setupSteps: [{ id: 'game', title: 'Game setup', View: Setup, validate: (s, e) => setupIssues(s.settings, e) }],
  settingsSchema, stateSchema, settingsFields: [
    { key: 'playersPerTeam', label: 'Players per team', type: 'select', options: [1, 2, 3].map(value => ({ label: String(value), value })) },
    { key: 'turnSeconds', label: 'Seconds per player', type: 'select', options: [60, 45].map(value => ({ label: String(value), value })) },
  ],
  Stage, Finale, Preview, hasProgress, progressLabel, validateSession,
  onPause: s => holdClock(s), onResume: s => releaseClock(s),
  remapImages: game => game,
  shortcuts: [
    { key: 'ArrowLeft', label: 'Previous player', run: ctx => { if (ctx.segment.phase === 'play') ctx.update(s => visitTurn(s, s.game.currentTurnIndex - 1)); } },
    { key: 'ArrowRight', label: 'Next player', run: ctx => { if (ctx.segment.phase === 'play' && canVisitTurn(ctx.segment.game, ctx.segment.game.currentTurnIndex + 1)) ctx.update(s => visitTurn(s, s.game.currentTurnIndex + 1)); } },
  ],
  createInitialState: initialState,
  defaultSettings: () => ({ playersPerTeam: 3, turnSeconds: 60, turnOrder: 'team-by-team', selections: {} }),
  startNewGame,
  createDemo: async (segment, event) => {
    event.teams = newTeams();
    const names = ['Asha', 'Rohan', 'Meera', 'Kabir', 'Leela', 'Dev', 'Anya', 'Ishan', 'Tara', 'Arjun', 'Nila', 'Vikram', 'Sana', 'Omar', 'Diya'];
    event.players = event.teams.flatMap((team, i) => Array.from({ length: 3 }, (_, slot) => ({ id: `bottle-demo-${i}-${slot}`, name: names[i * 3 + slot] })));
    event.teams = event.teams.map((team, i) => ({ ...team, memberIds: event.players.slice(i * 3, i * 3 + 3).map(p => p.id), pinnedIds: [] }));
    event.playersInitialized = true; event.title = 'Selfie Bottle Challenge · demo';
    return { segment, event };
  },
  migrate: saved => {
    const raw = saved as { settings: unknown; game: unknown };
    return { settings: settingsSchema.parse(raw.settings), game: stateSchema.parse(raw.game) };
  },
};
