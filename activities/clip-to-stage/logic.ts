import { eventDraft } from '../../src/core/event';
import type { ActivityEvent, EventUpdate } from '../../src/core/types';
import { pauseTimer, startTimer } from '../../src/core/play/timer';
import { setRoundAward } from '../../src/core/scoring';
import { VIDEO_MIMES, youtubeReference } from './source';
import { initialState, settingsSchema, type Context, type Game, type Segment, type Settings } from './types';

export const hasProgress = (g: Game) => g.teamIds.length > 0;
export const timed = (g: Game) => ['practise', 'perform'].includes(g.step);
export const completeScores = (g: Game) => g.teamIds.length > 0 && g.teamIds.every(id => typeof g.scores[id] === 'number' && Number.isSafeInteger(g.scores[id]) && g.scores[id]! >= 0);
export const progressLabel = (g: Game) => g.step === 'watch' ? 'Ready to watch the reference clip.' : g.step === 'practise' ? 'Teams are practising together.' : `${g.performedCount} of ${g.teamIds.length} team performances completed.`;
export const performancePrompt = (mode: Settings['performance']) => mode === 'sing' ? 'Sing the song together.' : mode === 'dance' ? 'Recreate the dance or performance.' : 'Sing, dance, or combine both as a team.';

export function setupIssues(settings: Settings, event: Pick<ActivityEvent, 'teams' | 'assets'>) {
  const issues: string[] = [];
  if (event.teams.length < 2 || event.teams.length > 8 || event.teams.some(t => !t.name.trim())) issues.push('Use 2–8 named event teams.');
  if (settings.source === 'youtube' && !youtubeReference(settings.youtubeUrl)) issues.push('Add a valid YouTube video, Shorts or clip link.');
  if (settings.source === 'local' && (!settings.videoAssetId || !VIDEO_MIMES.has(event.assets[settings.videoAssetId]?.mime))) issues.push('Upload an MP4 or WebM clip for offline playback.');
  return issues;
}
export function startNewGame(s: Segment, event?: EventUpdate) {
  s.settings = settingsSchema.parse(s.settings);
  if (!event) throw new Error('This activity needs the event teams.');
  const issues = setupIssues(s.settings, event);
  if (issues.length) throw new Error(issues[0]);
  s.game = { ...initialState(), teamIds: event.teams.map(t => t.id), scores: Object.fromEntries(event.teams.map(t => [t.id, null])), timer: { durationMs: s.settings.practiceMinutes * 60000 } };
  s.phase = 'play';
  event.scoreEntries = event.scoreEntries.filter(e => e.segmentId !== s.segmentId);
}
export function start(ctx: Context) {
  let started = false;
  ctx.update(s => { startNewGame(s, eventDraft(ctx.event)); started = true; });
  if (started) ctx.updateEvent(e => { e.scoreEntries = e.scoreEntries.filter(entry => entry.segmentId !== ctx.segment.segmentId); });
}
function begin(s: Segment, step: 'practise' | 'perform', durationMs: number, now: number) {
  s.game.step = step; s.game.timer = startTimer({ durationMs }, now); delete s.game.clockHeld;
}
export function advance(s: Segment, now = Date.now()) {
  if (s.phase !== 'play' || !hasProgress(s.game)) return;
  const g = s.game;
  if (g.step === 'watch') begin(s, 'practise', s.settings.practiceMinutes * 60000, now);
  else if (g.step === 'practise') begin(s, 'perform', s.settings.performanceSeconds * 1000, now);
  else if (g.step === 'perform') {
    g.performedCount = g.performanceIndex + 1;
    if (g.performedCount < g.teamIds.length) { g.performanceIndex++; begin(s, 'perform', s.settings.performanceSeconds * 1000, now); }
    else { g.step = 'judging'; g.timer = pauseTimer(g.timer, now); delete g.clockHeld; }
  } else if (g.step === 'results') s.phase = 'finale';
}
export function next(ctx: Context) {
  if (ctx.segment.game.step === 'judging') saveScores(ctx);
  else ctx.update(s => advance(s));
}
export function setScore(s: Segment, teamId: string, points: number | null) {
  if (s.phase !== 'play' || s.game.step !== 'judging' || !s.game.teamIds.includes(teamId)) return;
  if (points !== null && (!Number.isSafeInteger(points) || points < 0)) return;
  s.game.scores[teamId] = points;
}
export function saveScores(ctx: Context) {
  const s = ctx.segment;
  if (s.phase !== 'play' || s.game.step !== 'judging' || !completeScores(s.game)) return;
  ctx.updateEvent(e => {
    for (const id of s.game.teamIds) e.scoreEntries = setRoundAward(e.scoreEntries, s.segmentId, `judge:${id}`, id, true, s.game.scores[id]!);
  });
  ctx.update(d => { d.game.step = 'results'; d.phase = 'finale'; });
}
export function editScores(ctx: Context) {
  if (ctx.segment.phase === 'finale' && ctx.segment.game.step === 'results') ctx.update(s => { s.phase = 'play'; s.game.step = 'judging'; });
}
export function holdClock(s: Segment, now = Date.now()) {
  if (timed(s.game) && s.game.timer.deadlineAt !== undefined) { s.game.timer = pauseTimer(s.game.timer, now); s.game.clockHeld = true; }
}
export function releaseClock(s: Segment, now = Date.now()) {
  if (s.game.clockHeld) { s.game.timer = startTimer(s.game.timer, now); delete s.game.clockHeld; }
}
export function toggleClock(s: Segment, now = Date.now()) {
  if (s.phase === 'play' && timed(s.game)) s.game.timer = s.game.timer.deadlineAt === undefined ? startTimer(s.game.timer, now) : pauseTimer(s.game.timer, now);
}
export function validateSession(s: Segment, event: ActivityEvent) {
  if (s.settings.source === 'local' && s.settings.videoAssetId && !VIDEO_MIMES.has(event.assets[s.settings.videoAssetId]?.mime)) return ['The saved reference video is missing. Upload it again or restore the session ZIP.'];
  const awards = event.scoreEntries.filter(e => e.segmentId === s.segmentId && ['round-award', 'steal-award'].includes(e.kind));
  if (!hasProgress(s.game)) return s.phase === 'setup' && !awards.length ? [] : ['The saved activity has no performances.'];
  const issues = setupIssues(s.settings, event);
  if (issues.length) return issues;
  if (s.game.teamIds.length !== event.teams.length || s.game.teamIds.some((id, i) => id !== event.teams[i].id)) return ['The saved performance order must match the event teams.'];
  if (['watch', 'practise', 'perform'].includes(s.game.step) && awards.length) return ['Scores cannot be awarded before judging.'];
  if (s.game.step === 'results' && (awards.length !== s.game.teamIds.length || s.game.teamIds.some(id => {
    const entry = awards.find(e => e.id === `${s.segmentId}:award-judge:${id}`);
    return !entry || entry.kind !== 'round-award' || !entry.active || entry.teamId !== id || entry.roundId !== `judge:${id}` || entry.points !== s.game.scores[id];
  }))) return ['Saved judge totals do not match the activity scores.'];
  if (s.phase === 'finale' && s.game.step !== 'results') return ['Save all judge scores before viewing results.'];
  return [];
}
