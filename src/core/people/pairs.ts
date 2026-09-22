export interface ImportedPairFiles {
  name: string;
  thenFile: string;
  nowFile: string;
}

export const MAX_PEOPLE = 500;
export const MAX_FACE_PAIRS = 1000;

export function hasJpegSignature(bytes: Uint8Array): boolean {
  return bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff;
}

export function assertFacePairImportCapacity(pairCount: number, current: { people: number; facePairs: number }) {
  const peopleTotal = current.people + pairCount;
  const facePairsTotal = current.facePairs + pairCount;
  const exceeded: string[] = [];
  if (peopleTotal > MAX_PEOPLE) exceeded.push(`${MAX_PEOPLE} people`);
  if (facePairsTotal > MAX_FACE_PAIRS) exceeded.push(`${MAX_FACE_PAIRS} face pairs`);
  if (exceeded.length) {
    throw new Error(`Cannot import ${pairCount} face pairs: this session would exceed its limit of ${exceeded.join(' and ')}.`);
  }
}

export function maxFacePairNumber(numbers: readonly number[]): number {
  return numbers.reduce((max, number) => Math.max(max, number), 0);
}

export function parseFacePairFiles(fileNames: string[]): ImportedPairFiles[] {
  const groups = new Map<string, { name: string; thenFile?: string; nowFile?: string }>();
  for (const file of fileNames) {
    if (file.endsWith('/')) continue;
    if (file.includes('/') || file.includes('\\')) throw new Error('Face pair ZIP entries must be flat files.');
    const match = /^(.*?)\s+-\s+(then|now)\.jpe?g$/i.exec(file);
    if (!match) throw new Error('Face pair files must end with " - then.jpg" or " - now.jpg" as JPEGs.');
    const name = match[1].trim();
    if (!name) throw new Error('Every face pair file needs a person name.');
    const key = name.toLocaleLowerCase();
    const group = groups.get(key) ?? { name };
    const side = match[2].toLocaleLowerCase() as 'then' | 'now';
    if (side === 'then') {
      if (group.thenFile) throw new Error(`Duplicate then file for ${group.name}.`);
      group.thenFile = file;
    } else {
      if (group.nowFile) throw new Error(`Duplicate now file for ${group.name}.`);
      group.nowFile = file;
    }
    groups.set(key, group);
  }
  if (!groups.size) throw new Error('The ZIP contains no face pairs.');
  return [...groups.values()].map(group => {
    if (!group.thenFile || !group.nowFile) throw new Error(`Missing then or now image for ${group.name}.`);
    return { name: group.name, thenFile: group.thenFile, nowFile: group.nowFile };
  });
}
