import { Images } from 'lucide-react';
import type { Activity } from '../../src/core/types';
import { UploadStep } from './setup/UploadStep';
import { MatchPeopleStep } from './setup/MatchPeopleStep';
import { NamePeopleStep } from './setup/NamePeopleStep';
import { GameSetupStep } from './setup/GameSetupStep';
import { Stage } from './stage/Stage';
import { Finale } from './stage/Finale';
import { Preview } from './Preview';
import { settingsSchema, stateSchema, initialState, type Settings, type GameState } from './types';
import { markResult, moveRound, reveal, startNewGame } from './logic/rounds';
import { loadDemo } from './logic/preparation';
export const childhoodVsNow: Activity<Settings, GameState> = {
  id: 'childhood-vs-now', version: 1, name: 'Childhood vs Now', description: 'Tiny faces. Familiar people. Can your team recognise their colleagues before the big reveal?', icon: Images,
  setupSteps: [
    { id: 'upload', title: 'Upload photos', View: UploadStep, validate: s => s.game.originalImageId && s.game.childhoodImageId ? [] : ['Upload both group photos first.'] },
    { id: 'match', title: 'Match people', View: MatchPeopleStep, validate: s => s.facePairs.some(p => p.now && p.then) ? [] : ['Match at least one pair of faces.'] },
    { id: 'names', title: 'Name people', View: NamePeopleStep, validate: s => s.people.some(p => p.included) && s.people.filter(p => p.included).every(p => p.name.trim()) ? [] : ['Include and name the people who will appear in the game.'] },
    { id: 'game', title: 'Game setup', View: GameSetupStep, validate: s => s.teams.every(t => t.name.trim()) ? [] : ['Every team needs a name.'] },
  ],
  settingsSchema, stateSchema, settingsFields: [{ key: 'shuffle', label: 'Shuffle photos', type: 'boolean' }],
  Stage, Finale, Preview, createDemo: loadDemo,
  validateSession: s => {
    for (const id of [s.game.originalImageId, s.game.childhoodImageId, s.game.childhoodUploadId, ...Object.keys(s.game.previews), ...Object.values(s.game.previews)]) if (id && !s.assets[id]) return ['The session references a missing group photo or preview.'];
    if (s.phase !== 'setup') {
      if (!s.game.rounds.length) return ['The saved game has no rounds.'];
      if (s.game.rounds.some(r => !s.people.some(p => p.id === r.personId) || !s.teams.some(t => t.id === r.teamId))) return ['A round references an unknown person or team.'];
      if (new Set(s.game.rounds.map(r => r.id)).size !== s.game.rounds.length) return ['The game contains duplicate rounds.'];
      if (s.game.rounds.some(r => r.result !== null && !r.revealed)) return ['A round has a result before its reveal.'];
    }
    return [];
  },
  remapImages: (g, ids) => ({ ...g, originalImageId: g.originalImageId ? ids[g.originalImageId] : undefined, childhoodImageId: g.childhoodImageId ? ids[g.childhoodImageId] : undefined, childhoodUploadId: g.childhoodUploadId ? ids[g.childhoodUploadId] : undefined, previews: Object.fromEntries(Object.entries(g.previews).map(([source, preview]) => [ids[source], ids[preview]])) }),
  shortcuts: [
    { key: 'Enter', label: 'Reveal', run: ctx => { if (ctx.session.phase === 'play') ctx.update(reveal); } },
    { key: ' ', label: 'Reveal', run: ctx => { if (ctx.session.phase === 'play') ctx.update(reveal); } },
    { key: 'c', label: 'Correct +1', run: ctx => { if (ctx.session.phase === 'play') ctx.update(s => markResult(s, 'correct')); } },
    { key: 'm', label: 'Missed', run: ctx => { if (ctx.session.phase === 'play') ctx.update(s => markResult(s, 'missed')); } },
    { key: 'ArrowLeft', label: 'Previous', run: ctx => { if (ctx.session.phase === 'play') ctx.update(s => moveRound(s, -1)); } },
    { key: 'ArrowRight', label: 'Next', run: ctx => { if (ctx.session.phase === 'play') ctx.update(s => moveRound(s, 1)); } },
  ],
  createInitialState: initialState, defaultSettings: () => ({ shuffle: true, matchingTolerance: .12 }), startNewGame,
  migrate: () => { throw new Error('This session version is not supported.'); },
};
