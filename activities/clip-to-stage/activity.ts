import { Music2, Trophy, Users } from 'lucide-react';
import type { Activity } from '../../src/core/types';
import { Setup } from './Setup';
import { Stage } from './Stage';
import { Finale } from './Finale';
import { Preview } from './Preview';
import * as play from './logic';
import { defaultSettings, initialState, settingsSchema, stateSchema, type Settings, type Game } from './types';
import './style.css';

export const clipToStage: Activity<Settings, Game> = {
  id: 'clip-to-stage', version: 1, order: 6, name: 'Clip to Stage', icon: Music2,
  description: 'Watch a song clip, practise together, then perform as a team. The offline judge panel gives the scores.',
  estimatedMinutes: 30,
  card: { label: 'THE ENCORE', eyebrow: 'WATCH IT. PRACTISE IT. OWN IT.', tags: [{ icon: Users, text: 'Every team performs' }, { icon: Music2, text: 'Song or dance clip' }, { icon: Trophy, text: 'Judge panel' }] },
  settingsSchema, stateSchema, settingsFields: [],
  setupSteps: [{ id: 'game', title: 'Game setup', View: Setup, validate: (s, e) => play.setupIssues(s.settings, e) }],
  Stage, Finale, Preview, defaultSettings, createInitialState: initialState,
  startNewGame: play.startNewGame, hasProgress: play.hasProgress, progressLabel: play.progressLabel,
  onPause: play.holdClock, onResume: play.releaseClock, validateSession: play.validateSession,
  remapImages: game => game,
  remapSettings: (settings, ids) => ({ ...settings, ...(settings.videoAssetId ? { videoAssetId: ids[settings.videoAssetId] ?? settings.videoAssetId } : {}) }),
  migrate: (saved, version) => {
    if (version !== 1) throw new Error('This Clip to Stage session needs a newer version of the app.');
    const s = saved as { settings: unknown; game: unknown };
    return { settings: settingsSchema.parse(s.settings), game: stateSchema.parse(s.game) };
  },
  shortcuts: [{ key: 'n', label: 'Next', run: play.next }, { key: 't', label: 'Timer', run: ctx => ctx.update(s => play.toggleClock(s)) }],
};
