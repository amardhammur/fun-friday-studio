import { Drama, Users, Check } from 'lucide-react';
import type { Activity } from '../../src/core/types';
import { PromptsStep } from './setup/PromptsStep';
import { GameSetupStep } from './setup/GameSetupStep';
import { Stage } from './stage/Stage';
import { Finale } from './stage/Finale';
import { Preview } from './Preview';
import { categories } from './prompts';
import { loadDemo } from './logic/demo';
import { settingsSchema, stateSchema, initialState, type GameState, type Settings } from './types';
import { currentTurn, eligiblePrompts, endTurn, markGuessed, markSkipped, moveTurn, scoreChange, startNewGame, undoLast } from './logic/turns';
const acting = (ctx: { segment: { phase: string; game: GameState } }) => ctx.segment.phase === 'play' && currentTurn(ctx.segment.game)?.status === 'acting';
export const actItOut: Activity<Settings, GameState> = {
  id: 'act-it-out', version: 1, name: 'Act It Out', description: 'No props, no prep, no talking. One teammate faces away while the rest of the team acts the screen out.', icon: Drama,
  card: { label: 'THE NO-PREP ONE', eyebrow: 'EVERYBODY OUT OF THEIR SEATS', tags: [{ icon: Users, text: '1–8 teams' }, { icon: Check, text: 'Nothing to prepare' }, { text: '2 base points per prompt' }] },
  setupSteps: [
    { id: 'prompts', title: 'Choose prompts', View: PromptsStep, validate: (s, e) => {
      const available = eligiblePrompts(s.settings).length, needed = Math.max(3, e.teams.length * s.settings.roundsPerTeam * 3);
      return available >= needed ? [] : [`You need at least ${needed} prompts for ${e.teams.length} teams and have ${available}. Add a category or write your own.`];
    } },
    // This step MUST keep the id 'game': App.tsx treats it as the only step reachable once an
    // earlier activity has locked the roster.
    { id: 'game', title: 'Game setup', View: GameSetupStep, validate: (_s, e) => e.teams.every(t => t.name.trim()) ? [] : ['Every team needs a name.'] },
  ],
  settingsSchema, stateSchema, settingsFields: [{ key: 'turnSeconds', label: 'Turn length', type: 'number' }, { key: 'roundsPerTeam', label: 'Turns per team', type: 'number' }],
  Stage, Finale, Preview, createDemo: loadDemo, estimatedMinutes: 12, order: 1,
  validateSession: (s, e) => {
    if (s.phase === 'setup') return [];
    if (!s.game.turns.length) return ['The saved game has no turns.'];
    if (s.game.turns.some(t => !e.teams.some(team => team.id === t.teamId))) return ['A turn references a team that is no longer in the event.'];
    return [];
  },
  // This activity owns no images, which is exactly why it is a useful second client of the contract.
  remapImages: game => game,
  shortcuts: [
    { key: ' ', label: 'Got it', run: ctx => { if (acting(ctx)) scoreChange(ctx, (s, e) => markGuessed(s, e)); } },
    { key: 'Enter', label: 'Got it', run: ctx => { if (acting(ctx)) scoreChange(ctx, (s, e) => markGuessed(s, e)); } },
    { key: 's', label: 'Skip', run: ctx => { if (acting(ctx)) scoreChange(ctx, (s, e) => markSkipped(s, e)); } },
    { key: 'z', label: 'Undo', run: ctx => { if (acting(ctx)) scoreChange(ctx, (s, e) => undoLast(s, e)); } },
    { key: 'e', label: 'End turn', run: ctx => { if (acting(ctx)) ctx.update(s => endTurn(s)); } },
    { key: 'ArrowLeft', label: 'Previous', run: ctx => { if (ctx.segment.phase === 'play') ctx.update(s => moveTurn(s, -1)); } },
    { key: 'ArrowRight', label: 'Next', run: ctx => { if (ctx.segment.phase === 'play') ctx.update(s => moveTurn(s, 1)); } },
  ],
  createInitialState: initialState,
  defaultSettings: () => ({ categories: [...categories], customPrompts: [], turnSeconds: 90, roundsPerTeam: 1 }),
  startNewGame,
  migrate: () => { throw new Error('This session version is not supported.'); },
};
