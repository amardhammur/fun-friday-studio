import type { ComponentType } from 'react';
import type { z } from 'zod';

export type ID = string;
export interface Point { x: number; y: number }
export interface Rect extends Point { width: number; height: number }
export interface Asset { id: ID; name: string; width: number; height: number; mime: string }
export interface FaceCrop {
  sourceImageId: ID;
  faceBox: Rect;
  padding: { top: number; right: number; bottom: number; left: number };
  cropImageId?: ID;
}
export interface FacePair {
  id: ID; number: number; color: string;
  now?: FaceCrop; then?: FaceCrop;
  matchMethod: 'automatic' | 'manual';
  reviewStatus: 'suggested' | 'confirmed' | 'unmatched';
}
export interface Person { id: ID; name: string; funFact: string; included: boolean; facePairId: ID }
export interface Team { id: ID; name: string; color: string }
export interface ScoreEntry { id: ID; teamId: ID; segmentId?: ID; roundId?: ID; kind: 'round-award' | 'steal-award' | 'manual-adjustment' | 'wager'; points: number; active: boolean }
export interface Session<S = unknown, G = unknown> {
  formatVersion: 1; id: ID; title: string; activityId: string; activityVersion: number;
  segmentId: ID; points: { correct: number; steal: number };
  createdAt: string; updatedAt: string; isDemo: boolean;
  phase: 'setup' | 'play' | 'finale'; setupStepId: string;
  people: Person[]; facePairs: FacePair[]; teams: Team[]; scoreEntries: ScoreEntry[];
  settings: S; game: G; assets: Record<ID, Asset>;
}
// Runtime schemas validate this erased type at the registry/import boundary.
export type AnySession = Session<any, any>;
export interface ActivityContext<S = any, G = any> {
  session: Session<S, G>;
  update: (change: (draft: Session<S, G>) => void) => void;
  notify: (message: string) => void;
  runTask: (label: string, task: () => Promise<void>) => Promise<void>;
  goHome: () => void;
}
export interface SettingsField { key: string; label: string; type: 'boolean' | 'number' | 'select'; options?: { label: string; value: string | number }[] }
export interface Activity<S = any, G = any> {
  id: string; version: number; name: string; description: string; icon: ComponentType<{ size?: number }>;
  setupSteps: { id: string; title: string; View: ComponentType<ActivityContext<S, G>>; validate: (s: Session<S, G>) => string[] }[];
  settingsSchema: z.ZodType<S>; stateSchema: z.ZodType<G>; settingsFields: SettingsField[];
  Stage: ComponentType<ActivityContext<S, G>>; Finale?: ComponentType<ActivityContext<S, G>>;
  estimatedMinutes?: number;
  Preview?: ComponentType<{ session: Session<S, G> }>;
  createDemo?: (session: Session<S, G>) => Promise<Session<S, G>>;
  validateSession?: (session: Session<S, G>) => string[];
  remapImages: (game: G, ids: Record<string, string>) => G;
  shortcuts: { key: string; label: string; run: (ctx: ActivityContext<S, G>) => void }[];
  createInitialState: () => G; defaultSettings: () => S;
  startNewGame: (s: Session<S, G>) => void;
  migrate: (saved: unknown, fromVersion: number) => { settings: S; game: G };
}
export interface Segment {
  id: ID; activityId: string; activityVersion: number; title: string;
  settings: unknown; game: unknown;
  status: 'pending' | 'setup' | 'play' | 'finale' | 'done';
  setupStepId: string; weight: number;
}
export interface EventWager { question: string; answer: string; bets: Record<ID, number> }
export interface EventSession {
  formatVersion: 2; id: ID; title: string; createdAt: string; updatedAt: string; isDemo: boolean;
  segments: Segment[]; currentSegmentIndex: number;
  phase: 'lineup' | 'segment' | 'interstitial' | 'wager' | 'finale';
  wager?: EventWager;
  correctPoints: number; stealPoints: number;
  people: Person[]; facePairs: FacePair[]; teams: Team[]; scoreEntries: ScoreEntry[];
  assets: Record<ID, Asset>;
}
