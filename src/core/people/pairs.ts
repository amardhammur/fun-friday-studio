export interface ImportedPairFiles {
  name: string;
  thenFile: string;
  nowFile: string;
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
