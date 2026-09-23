import type { FacePair, Person, PhotoSet } from '../../../src/core/types';
import { orderedSets } from '../../../src/core/people/photo-sets';

export interface RevealPlayer { person: Person; pair: FacePair }
export type RevealSlide = { kind: 'group'; set: PhotoSet; players: RevealPlayer[] } | { kind: 'singles'; players: RevealPlayer[] };
type Library = { readonly photoSets: readonly PhotoSet[]; readonly facePairs: readonly FacePair[]; readonly people: readonly Person[] };

// Only people who had a photo in this game are revealed; a group nobody played from is skipped.
export function buildRevealSlides(event: Library, rounds: readonly { personId: string }[]): RevealSlide[] {
  const inGame = new Set(rounds.map(round => round.personId));
  const players = event.people.filter(person => inGame.has(person.id)).flatMap(person => { const pair = event.facePairs.find(p => p.id === person.facePairId); return pair ? [{ person, pair }] : []; });
  const sets = orderedSets(event), slides: RevealSlide[] = [];
  for (const set of sets.filter(s => s.kind === 'group')) {
    const here = players.filter(player => player.pair.setId === set.id);
    if (here.length) slides.push({ kind: 'group', set, players: here });
  }
  const singles = sets.filter(s => s.kind === 'single').flatMap(set => players.filter(player => player.pair.setId === set.id));
  if (singles.length) slides.push({ kind: 'singles', players: singles });
  return slides;
}
export const clampSlide = (index: number, count: number) => Math.min(Math.max(0, index), Math.max(0, count - 1));
