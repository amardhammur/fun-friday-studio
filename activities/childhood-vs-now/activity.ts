import { Images, Users, Check } from 'lucide-react';
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
  card: { label: 'THE NOSTALGIA EDITION', eyebrow: 'A TRIP DOWN MEMORY LANE', tags: [{ icon: Users, text: '1–8 teams' }, { icon: Check, text: 'No repeated photos' }, { text: '2 base points per correct guess' }] },
  setupSteps: [
    { id: 'upload', title: 'Upload photos', View: UploadStep, validate: (s) => s.game.originalImageId && s.game.childhoodImageId ? [] : ['Upload both group photos first.'] },
    { id: 'match', title: 'Match people', View: MatchPeopleStep, validate: (_s, e) => e.facePairs.some(p => p.now && p.then) ? [] : ['Match at least one pair of faces.'] },
    { id: 'names', title: 'Name people', View: NamePeopleStep, validate: (_s, e) => e.people.some(p => p.included) && e.people.filter(p => p.included).every(p => p.name.trim()) ? [] : ['Include and name the people who will appear in the game.'] },
    { id: 'game', title: 'Game setup', View: GameSetupStep, validate: (_s, e) => e.teams.every(t => t.name.trim()) ? [] : ['Every team needs a name.'] },
  ],
  settingsSchema, stateSchema, settingsFields: [{ key: 'shuffle', label: 'Shuffle photos', type: 'boolean' }],
  Stage, Finale, Preview, createDemo: loadDemo,
  preparePeople: (s, e, previews) => {
    const pair = e.facePairs.find(p => p.now && p.then);
    if (!pair) return;
    if (s.game.originalImageId === pair.now!.sourceImageId && s.game.childhoodImageId === pair.then!.sourceImageId) return;
    s.game.originalImageId = pair.now!.sourceImageId;
    s.game.childhoodImageId = pair.then!.sourceImageId;
    s.game.childhoodUploadId = pair.then!.sourceImageId;
    s.game.previews = { ...(previews ?? s.game.previews) };
    s.setupStepId = 'game';
  },
  validateSession: (s, e) => {
    for (const id of [s.game.originalImageId, s.game.childhoodImageId, s.game.childhoodUploadId, ...Object.keys(s.game.previews), ...Object.values(s.game.previews)]) if (id && !e.assets[id]) return ['The session references a missing group photo or preview.'];
    if (s.phase !== 'setup') {
      if (!s.game.rounds.length) return ['The saved game has no rounds.'];
      if (s.game.rounds.some(r => !e.people.some(p => p.id === r.personId) || !e.teams.some(t => t.id === r.teamId))) return ['A round references an unknown person or team.'];
      if (new Set(s.game.rounds.map(r => r.id)).size !== s.game.rounds.length) return ['The game contains duplicate rounds.'];
      if (s.game.rounds.some(r => r.result !== null && !r.revealed)) return ['A round has a result before its reveal.'];
    }
    return [];
  },
  remapImages: (g, ids) => ({ ...g, originalImageId: g.originalImageId ? ids[g.originalImageId] : undefined, childhoodImageId: g.childhoodImageId ? ids[g.childhoodImageId] : undefined, childhoodUploadId: g.childhoodUploadId ? ids[g.childhoodUploadId] : undefined, previews: Object.fromEntries(Object.entries(g.previews).map(([source, preview]) => [ids[source], ids[preview]])) }),
  shortcuts: [
    { key: 'Enter', label: 'Reveal', run: ctx => { if (ctx.segment.phase === 'play') ctx.update(reveal); } },
    { key: ' ', label: 'Reveal', run: ctx => { if (ctx.segment.phase === 'play') ctx.update(reveal); } },
    { key: 'c', label: 'Correct', run: ctx => { if (ctx.segment.phase === 'play') { const event = { ...ctx.event, people: [...ctx.event.people], facePairs: [...ctx.event.facePairs], teams: [...ctx.event.teams], scoreEntries: [...ctx.event.scoreEntries], assets: { ...ctx.event.assets } }; ctx.update(s => markResult(s, event, 'correct')); ctx.updateEvent(e => { e.scoreEntries = event.scoreEntries; }); } } },
    { key: 'm', label: 'Missed', run: ctx => { if (ctx.segment.phase === 'play') { const event = { ...ctx.event, people: [...ctx.event.people], facePairs: [...ctx.event.facePairs], teams: [...ctx.event.teams], scoreEntries: [...ctx.event.scoreEntries], assets: { ...ctx.event.assets } }; ctx.update(s => markResult(s, event, 'missed')); ctx.updateEvent(e => { e.scoreEntries = event.scoreEntries; }); } } },
    { key: 'ArrowLeft', label: 'Previous', run: ctx => { if (ctx.segment.phase === 'play') ctx.update(s => moveRound(s, -1)); } },
    { key: 'ArrowRight', label: 'Next', run: ctx => { if (ctx.segment.phase === 'play') ctx.update(s => moveRound(s, 1)); } },
  ],
  createInitialState: initialState, defaultSettings: () => ({ shuffle: true, matchingTolerance: .12 }), startNewGame,
  migrate: () => { throw new Error('This session version is not supported.'); },
};
