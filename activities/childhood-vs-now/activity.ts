import { Images, Users, Check } from 'lucide-react';
import type { Activity } from '../../src/core/types';
import { PeopleStep } from './setup/PeopleStep';
import { GameSetupStep } from './setup/GameSetupStep';
import { Stage } from './stage/Stage';
import { Finale } from './stage/Finale';
import { Preview } from './Preview';
import { settingsSchema, stateSchema, initialState, type Settings, type GameState } from './types';
import { markResult, moveRound, reveal, startNewGame } from './logic/rounds';
import { loadDemo } from './logic/preparation';
import { playerIssues } from '../../src/core/people/photo-sets';
import { eventDraft } from '../../src/core/event';
export const childhoodVsNow: Activity<Settings, GameState> = {
  id: 'childhood-vs-now', version: 1, order: 0, name: 'Childhood vs Now', description: 'Tiny faces. Familiar people. Can your team recognise their colleagues before the big reveal?', icon: Images,
  card: { label: 'THE NOSTALGIA EDITION', eyebrow: 'A TRIP DOWN MEMORY LANE', tags: [{ icon: Users, text: '1–8 teams' }, { icon: Check, text: 'No repeated photos' }, { text: '2 base points per correct guess' }] },
  setupSteps: [
    { id: 'people', title: 'People', View: PeopleStep, validate: (_s, e) => playerIssues(e) },
    { id: 'game', title: 'Game setup', View: GameSetupStep, validate: (_s, e) => e.teams.every(t => t.name.trim()) ? [] : ['Every team needs a name.'] },
  ],
  settingsSchema, stateSchema, settingsFields: [{ key: 'shuffle', label: 'Shuffle photos', type: 'boolean' }],
  Stage, Finale, Preview, createDemo: loadDemo,
  preparePeople: (s, e) => { if (e.facePairs.some(p => p.now && p.then)) s.setupStepId = 'game'; },
  validateSession: (s, e) => {
    if (s.phase !== 'setup') {
      if (!s.game.rounds.length) return ['The saved game has no rounds.'];
      if (s.game.rounds.some(r => !e.people.some(p => p.id === r.personId) || !e.teams.some(t => t.id === r.teamId))) return ['A round references an unknown person or team.'];
      if (new Set(s.game.rounds.map(r => r.id)).size !== s.game.rounds.length) return ['The game contains duplicate rounds.'];
      if (s.game.rounds.some(r => r.result !== null && !r.revealed)) return ['A round has a result before its reveal.'];
    }
    return [];
  },
  remapImages: g => g,
  shortcuts: [
    { key: 'Enter', label: 'Reveal', run: ctx => { if (ctx.segment.phase === 'play') ctx.update(reveal); } },
    { key: ' ', label: 'Reveal', run: ctx => { if (ctx.segment.phase === 'play') ctx.update(reveal); } },
    { key: 'c', label: 'Correct', run: ctx => { if (ctx.segment.phase === 'play') { const event = eventDraft(ctx.event); ctx.update(s => markResult(s, event, 'correct')); ctx.updateEvent(e => { e.scoreEntries = event.scoreEntries; }); } } },
    { key: 'm', label: 'Missed', run: ctx => { if (ctx.segment.phase === 'play') { const event = eventDraft(ctx.event); ctx.update(s => markResult(s, event, 'missed')); ctx.updateEvent(e => { e.scoreEntries = event.scoreEntries; }); } } },
    { key: 'ArrowLeft', label: 'Previous', run: ctx => { if (ctx.segment.phase === 'play') ctx.update(s => moveRound(s, -1)); } },
    { key: 'ArrowRight', label: 'Next', run: ctx => { if (ctx.segment.phase === 'play') ctx.update(s => moveRound(s, 1)); } },
  ],
  createInitialState: initialState, defaultSettings: () => ({ shuffle: true, matchingTolerance: .12 }), startNewGame,
  migrate: () => { throw new Error('This session version is not supported.'); },
};
