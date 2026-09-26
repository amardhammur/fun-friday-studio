import type { Player, Team } from '../types';
import { elementTeams, teamColors } from '../event';

const BALANCE_MESSAGE = 'Unpin players or reduce the team count to balance these teams.';
export function pinBalanceIssue(players: readonly Player[], teams: readonly Team[]): string | undefined {
  if (!teams.length) return 'Choose between 2 and 8 teams.';
  const floor = Math.floor(players.length / teams.length), extras = players.length % teams.length;
  if (teams.some(t => t.pinnedIds.length > Math.ceil(players.length / teams.length)) || teams.filter(t => t.pinnedIds.length > floor).length > extras) return BALANCE_MESSAGE;
}

/** Pins are placed first; each next player goes to a smallest team, rotating ties. */
export function shuffleTeams(players: readonly Player[], teams: readonly Team[], random = Math.random): Team[] {
  const issue = pinBalanceIssue(players, teams);
  if (issue) throw new Error(issue);
  const pinned = new Set(teams.flatMap(t => t.pinnedIds));
  const pool = players.filter(p => !pinned.has(p.id)).map(p => p.id);
  for (let i = pool.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    [pool[i], pool[j]] = [pool[j], pool[i]];
  }
  const result = teams.map(t => ({ ...t, memberIds: [...t.pinnedIds], pinnedIds: [...t.pinnedIds] }));
  let cursor = 0;
  for (const id of pool) {
    const smallest = Math.min(...result.map(t => t.memberIds.length));
    while (result[cursor].memberIds.length !== smallest) cursor = (cursor + 1) % result.length;
    result[cursor].memberIds.push(id);
    cursor = (cursor + 1) % result.length;
  }
  return result;
}

export function resizeTeams(teams: readonly Team[], count: number, confirmed = false, makeId: () => string = () => crypto.randomUUID()): Team[] {
  if (!Number.isInteger(count) || count < 2 || count > 8) throw new Error('Choose between 2 and 8 teams.');
  if (!confirmed && teams.slice(count).some(t => t.pinnedIds.length)) throw new Error('Confirm removal of teams with pinned players.');
  const result = teams.slice(0, count).map(t => ({ ...t, memberIds: [...t.memberIds], pinnedIds: [...t.pinnedIds] }));
  while (result.length < count) result.push({ id: makeId(), ...nextTeamIdentity(result), memberIds: [], pinnedIds: [] });
  return result;
}

/** A new team takes the next element name nobody is using, in that element's colour when it is free. */
function nextTeamIdentity(teams: readonly Team[]) {
  const names = new Set(teams.map(t => t.name.trim().toLocaleLowerCase())), colors = new Set(teams.map(t => t.color.toLowerCase()));
  const element = elementTeams.find(e => !names.has(e.name.toLocaleLowerCase()));
  const color = element && !colors.has(element.color) ? element.color : teamColors.find(c => !colors.has(c)) ?? teamColors[teams.length % teamColors.length];
  return { name: element?.name ?? `Team ${teams.length + 1}`, color };
}
