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
export interface PhotoSet {
  id: ID; name: string; kind: 'group' | 'single';
  nowImageId?: ID; thenImageId?: ID;
  previews: Record<ID, ID>;
  order: number;
}
export interface FacePair {
  id: ID; number: number; color: string; setId: ID;
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
export interface ActivitySegment<S = unknown, G = unknown> {
  formatVersion: 1; id: ID; title: string; activityId: string; activityVersion: number;
  segmentId: ID; points: { correct: number; steal: number };
  createdAt: string; updatedAt: string; isDemo: boolean;
  phase: 'setup' | 'play' | 'finale'; setupStepId: string;
  settings: S; game: G;
  /** Deprecated compatibility ledger; activity UI uses the separate event context. */
  scoreEntries: ScoreEntry[];
}
export interface ActivityEvent {
  id: ID; title: string; createdAt: string; updatedAt: string; isDemo: boolean;
  phase: EventSession['phase']; currentSegmentIndex: number;
  wager?: EventWager; correctPoints: number; stealPoints: number;
  readonly people: readonly Person[]; readonly facePairs: readonly FacePair[];
  readonly teams: readonly Team[]; readonly scoreEntries: readonly ScoreEntry[];
  readonly assets: Readonly<Record<ID, Asset>>;
  readonly photoSets: readonly PhotoSet[];
}
export type EventUpdate = Pick<EventSession, 'title' | 'isDemo' | 'phase' | 'wager' | 'correctPoints' | 'stealPoints' | 'people' | 'facePairs' | 'teams' | 'scoreEntries' | 'assets' | 'photoSets'>;
export interface PreparedActivity<S = unknown, G = unknown> { segment: ActivitySegment<S, G>; event: EventUpdate }
export interface ActivityContext<S = any, G = any> {
  rosterLocked?: boolean;
  segment: ActivitySegment<S, G>;
  event: ActivityEvent;
  update: (change: (draft: ActivitySegment<S, G>) => void) => void;
  updateEvent: (change: (draft: EventUpdate) => void) => void;
  notify: (message: string) => void;
  runTask: (label: string, task: () => Promise<void>) => Promise<void>;
  goHome: () => void;
}
export interface SettingsField { key: string; label: string; type: 'boolean' | 'number' | 'select'; options?: { label: string; value: string | number }[] }
export interface Activity<S = any, G = any> {
  id: string; version: number; name: string; description: string; icon: ComponentType<{ size?: number }>;
  setupSteps: { id: string; title: string; View: ComponentType<ActivityContext<S, G>>; validate: (segment: ActivitySegment<S, G>, event: ActivityEvent) => string[] }[];
  settingsSchema: z.ZodType<S>; stateSchema: z.ZodType<G>; settingsFields: SettingsField[];
  Stage: ComponentType<ActivityContext<S, G>>; Finale?: ComponentType<ActivityContext<S, G>>;
  estimatedMinutes?: number;
  /** Running order in the activity cupboard, and which activity greets a first-time visitor.
      Filename order must not decide this: discovery is alphabetical by path. */
  order?: number;
  /** Home-screen card copy. Falls back to the original Childhood vs Now wording when omitted. */
  card?: { label: string; eyebrow: string; tags: { icon?: ComponentType<{ size?: number }>; text: string }[] };
  Preview?: ComponentType<{ session?: Session<S, G> }>;
  createDemo?: (segment: ActivitySegment<S, G>, event: EventUpdate) => Promise<PreparedActivity<S, G>>;
  validateSession?: (segment: ActivitySegment<S, G>, event: ActivityEvent) => string[];
  remapImages: (game: G, ids: Record<string, string>) => G;
  shortcuts: { key: string; label: string; run: (ctx: ActivityContext<S, G>) => void }[];
  createInitialState: () => G; defaultSettings: () => S;
  preparePeople?: (segment: ActivitySegment<S, G>, event: EventUpdate) => void;
  startNewGame: (segment: ActivitySegment<S, G>, event?: EventUpdate) => void;
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
  formatVersion: 3; id: ID; title: string; createdAt: string; updatedAt: string; isDemo: boolean;
  segments: Segment[]; currentSegmentIndex: number;
  phase: 'lineup' | 'segment' | 'interstitial' | 'wager' | 'finale';
  wager?: EventWager;
  correctPoints: number; stealPoints: number;
  people: Person[]; facePairs: FacePair[]; teams: Team[]; scoreEntries: ScoreEntry[];
  assets: Record<ID, Asset>;
  photoSets: PhotoSet[];
}
