import type { EventSession } from '../types';
import { libraryLocked } from '../people/event-library';
import { pinBalanceIssue, resizeTeams, shuffleTeams } from './shuffle';

export const ROSTER_LOCK_MESSAGE = 'The roster is locked after an activity starts. Use Import pairs → Replace library to start over.';
const assertEditable = (event: EventSession) => { if (libraryLocked(event)) throw new Error(ROSTER_LOCK_MESSAGE); };
const cleanName = (name: string) => name.trim().toLocaleLowerCase();

/** Reconcile existing links only. Explicit removals stay removed until the next pull. */
export function syncPlayers(event: EventSession) {
  const included = new Map(event.people.filter(p => p.included).map(p => [p.id, p]));
  event.players = event.players.filter(player => player.personId === undefined || included.has(player.personId)).map(player => {
    const person = player.personId === undefined ? undefined : included.get(player.personId);
    return person?.name.trim() ? { ...player, name: person.name.trim() } : player;
  });
  const ids = new Set(event.players.map(p => p.id));
  for (const team of event.teams) {
    team.memberIds = team.memberIds.filter(id => ids.has(id));
    team.pinnedIds = team.pinnedIds.filter(id => team.memberIds.includes(id));
  }
}
export function pullPlayers(event: EventSession) {
  assertEditable(event);
  syncPlayers(event);
  const linked = new Set(event.players.map(p => p.personId));
  event.people.forEach((person, i) => {
    if (person.included && !linked.has(person.id)) {
      event.players.push({ id: crypto.randomUUID(), name: person.name.trim() || `Person ${i + 1}`, personId: person.id });
      linked.add(person.id);
    }
  });
  event.playersInitialized = true;
}
export function initializePlayers(event: EventSession) {
  if (!event.playersInitialized && !libraryLocked(event)) pullPlayers(event);
}
export function parsePlayerNames(text: string, existing: readonly { name: string }[]): string[] {
  const seen = new Set(existing.map(p => cleanName(p.name))), names: string[] = [];
  for (const line of text.split(/\r\n?|\n/)) {
    const name = line.trim(), key = cleanName(name);
    if (name && !seen.has(key)) { names.push(name); seen.add(key); }
  }
  return names;
}
export function addPlayers(event: EventSession, text: string, teamId?: string) {
  const team = teamId ? event.teams.find(t => t.id === teamId) : undefined;
  if (teamId && !team) throw new Error('Choose an existing team.');
  if (libraryLocked(event) && !team) throw new Error('Choose a team for the late arrival.');
  for (const name of parsePlayerNames(text, event.players)) {
    const player = { id: crypto.randomUUID(), name };
    event.players.push(player); team?.memberIds.push(player.id);
  }
  event.playersInitialized = true;
}
export function removePlayer(event: EventSession, id: string) {
  assertEditable(event);
  event.players = event.players.filter(p => p.id !== id);
  syncPlayers(event);
  event.playersInitialized = true;
}
export function movePlayer(event: EventSession, id: string, teamId?: string) {
  assertEditable(event);
  if (!event.players.some(p => p.id === id)) throw new Error('This player is no longer in the roster.');
  const target = teamId ? event.teams.find(t => t.id === teamId) : undefined;
  if (teamId && !target) throw new Error('Choose an existing team.');
  const pinned = event.teams.some(t => t.pinnedIds.includes(id));
  for (const team of event.teams) { team.memberIds = team.memberIds.filter(p => p !== id); team.pinnedIds = team.pinnedIds.filter(p => p !== id); }
  if (target) { target.memberIds.push(id); if (pinned) target.pinnedIds.push(id); }
}
export function togglePin(event: EventSession, id: string) {
  assertEditable(event);
  const team = event.teams.find(t => t.memberIds.includes(id));
  if (!team) throw new Error('Assign this player to a team before pinning them.');
  team.pinnedIds = team.pinnedIds.includes(id) ? team.pinnedIds.filter(p => p !== id) : [...team.pinnedIds, id];
}
export function setTeamCount(event: EventSession, count: number, confirmed = false) {
  assertEditable(event); event.teams = resizeTeams(event.teams, count, confirmed);
}
export function shuffleRoster(event: EventSession, random = Math.random) {
  assertEditable(event); event.teams = shuffleTeams(event.players, event.teams, random);
}
export { pinBalanceIssue };
