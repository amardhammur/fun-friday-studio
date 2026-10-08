import { strToU8, zipSync } from 'fflate';
import { exportNames } from '../../src/core/people/csv';
import type { Team } from '../../src/core/types';
import type { Round } from './types';

export function briefText(round: Round, teamName: string, seconds: number) {
  return `PRODUCT IN DISGUISE — PRIVATE TEAM BRIEF\n${teamName}\n\nYOUR SECRET PRODUCT: ${round.product.name}\n\nYour task: create a ${seconds}-second funny advertisement.\nProblem → exaggerated solution → tagline.\n\nBOTH REQUIRED CLUES MUST BE COMMUNICATED:\n1. ${round.product.clues[0]}\n2. ${round.product.clues[1]}\n\nSay these clues in your own words or demonstrate them.\nDo not name the product or show the real item.\nOptional inspiration: “${round.product.tagline}”\n\nChoose roles: writer, director, narrator, actor, timekeeper.\nOne volunteer may narrate from their seat.\n\nOnly the other teams guess and score.\nKeep this brief private until your product is revealed.\n`;
}
export function briefsArchive(rounds: Round[], teams: readonly Team[], seconds: number) {
  const names = rounds.map(r => teams.find(t => t.id === r.teamId)?.name ?? 'Team');
  const filenames = exportNames(names);
  return zipSync(Object.fromEntries(rounds.map((r, i) => [`${filenames[i]}.txt`, strToU8(briefText(r, names[i], seconds))])));
}
export function downloadBriefs(rounds: Round[], teams: readonly Team[], seconds: number) {
  const bytes = briefsArchive(rounds, teams, seconds);
  const url = URL.createObjectURL(new Blob([bytes as BlobPart], { type: 'application/zip' }));
  const link = document.createElement('a'); link.href = url; link.download = 'product-in-disguise-briefs.zip';
  document.body.append(link); link.click(); link.remove(); setTimeout(() => URL.revokeObjectURL(url), 1000);
}
