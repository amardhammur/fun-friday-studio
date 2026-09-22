import { z } from 'zod';
import type { Rect } from '../types';

export interface ImportedPairFiles {
  name: string;
  thenFile: string;
  nowFile: string;
}

export const MAX_PEOPLE = 500;
export const MAX_FACE_PAIRS = 1000;
export const FACE_PAIR_BUNDLE_VERSION = 1;

export interface FacePairBundlePadding {
  top: number;
  right: number;
  bottom: number;
  left: number;
}

export interface FacePairBundleFaceSide {
  cropPath: string;
  faceBox: Rect;
  padding: FacePairBundlePadding;
}

export interface FacePairBundleGroupImage {
  path: string;
  name: string;
  width: number;
  height: number;
  mime: string;
}

export interface FacePairBundleEntry {
  number: number;
  color: string;
  name: string;
  funFact: string;
  included: boolean;
  now: FacePairBundleFaceSide;
  then: FacePairBundleFaceSide;
}

export interface FacePairsBundleManifest {
  version: typeof FACE_PAIR_BUNDLE_VERSION;
  groups: {
    now: FacePairBundleGroupImage;
    then: FacePairBundleGroupImage;
    nowPreview?: FacePairBundleGroupImage;
    thenPreview?: FacePairBundleGroupImage;
  };
  pairs: FacePairBundleEntry[];
}

const GROUP_PATHS = {
  now: 'groups/now',
  then: 'groups/then',
  nowPreview: 'groups/now-preview',
  thenPreview: 'groups/then-preview',
} as const;

const paddingSchema = z.object({
  top: z.number().min(0).max(3, { message: 'Crop padding must stay between 0 and 3.' }),
  right: z.number().min(0).max(3, { message: 'Crop padding must stay between 0 and 3.' }),
  bottom: z.number().min(0).max(3, { message: 'Crop padding must stay between 0 and 3.' }),
  left: z.number().min(0).max(3, { message: 'Crop padding must stay between 0 and 3.' }),
});

const faceBoxSchema = z.object({
  x: z.number().min(0).max(1),
  y: z.number().min(0).max(1),
  width: z.number().positive().max(1),
  height: z.number().positive().max(1),
}).refine(rect => rect.x + rect.width <= 1.00001 && rect.y + rect.height <= 1.00001, {
  message: 'Face box lies outside the image.',
});

const groupImageSchema = z.object({
  path: z.string(),
  name: z.string().trim().min(1, 'Every group image needs a name.'),
  width: z.number().positive('Group image width must be positive.'),
  height: z.number().positive('Group image height must be positive.'),
  mime: z.string().refine(mime => mime.startsWith('image/'), {
    message: 'Group image MIME type must be an image.',
  }),
});

const faceSideSchema = z.object({
  cropPath: z.string(),
  faceBox: faceBoxSchema,
  padding: paddingSchema,
});

const pairSchema = z.object({
  number: z.number().int().positive().max(MAX_FACE_PAIRS),
  color: z.string().regex(/^#[0-9a-f]{6}$/i, 'Each pair needs a hex color.'),
  name: z.string().trim().min(1, 'Every person needs a display name.'),
  funFact: z.string().max(240),
  included: z.boolean(),
  now: faceSideSchema,
  then: faceSideSchema,
});

const manifestSchema = z.object({
  version: z.number().refine(value => value === FACE_PAIR_BUNDLE_VERSION, {
    message: 'Unsupported face pair bundle manifest version.',
  }),
  groups: z.object({
    now: groupImageSchema,
    then: groupImageSchema,
    nowPreview: groupImageSchema.optional(),
    thenPreview: groupImageSchema.optional(),
  }),
  pairs: z.array(pairSchema).min(1, 'The bundle manifest must include at least one pair.').max(MAX_FACE_PAIRS),
});

function formatManifestIssue(error: z.ZodError): string {
  const issue = error.issues[0];
  if (!issue) return 'Invalid face pair bundle manifest.';
  const path = issue.path.map(part => String(part)).join('.');
  if (path.startsWith('groups')) return issue.message.includes('group') ? issue.message : `Invalid group metadata: ${issue.message}`;
  if (path.includes('.then') || path.endsWith('then')) return `Missing or invalid then side: ${issue.message}`;
  if (path === 'version') return 'Unsupported face pair bundle manifest version.';
  return issue.message;
}

function pairCropPath(number: number, side: 'now' | 'then') {
  return `pairs/${String(number).padStart(3, '0')}-${side}.jpg`;
}

function assertSafeBundlePath(path: string) {
  if (!path || path.includes('\\') || path.startsWith('/') || path.includes('..') || path.includes('//')) {
    throw new Error('Bundle manifest paths must stay under groups/ and pairs/.');
  }
}

function assertGroupImage(group: FacePairBundleGroupImage, expectedPath: string) {
  assertSafeBundlePath(group.path);
  if (group.path !== expectedPath) {
    throw new Error(`Group image path must be ${expectedPath}.`);
  }
}

function assertPairSide(side: FacePairBundleFaceSide, number: number, label: 'now' | 'then') {
  assertSafeBundlePath(side.cropPath);
  const expected = pairCropPath(number, label);
  if (side.cropPath !== expected) {
    throw new Error(`Pair ${number} ${label} crop path must be ${expected}.`);
  }
}

function validateManifestRelationships(manifest: FacePairsBundleManifest) {
  const seen = new Map<string, string>();
  const track = (path: string, label: string) => {
    assertSafeBundlePath(path);
    const previous = seen.get(path);
    if (previous) throw new Error(`Duplicate bundle file reference for ${path} (${previous} and ${label}).`);
    seen.set(path, label);
  };

  track(manifest.groups.now.path, 'group now');
  track(manifest.groups.then.path, 'group then');
  if (manifest.groups.nowPreview) track(manifest.groups.nowPreview.path, 'group now preview');
  if (manifest.groups.thenPreview) track(manifest.groups.thenPreview.path, 'group then preview');

  const numbers = new Set<number>();
  for (const pair of manifest.pairs) {
    if (numbers.has(pair.number)) throw new Error(`Duplicate pair number ${pair.number}.`);
    numbers.add(pair.number);
    track(pair.now.cropPath, `pair ${pair.number} now crop`);
    track(pair.then.cropPath, `pair ${pair.number} then crop`);
  }

  assertGroupImage(manifest.groups.now, GROUP_PATHS.now);
  assertGroupImage(manifest.groups.then, GROUP_PATHS.then);
  if (manifest.groups.nowPreview) assertGroupImage(manifest.groups.nowPreview, GROUP_PATHS.nowPreview);
  if (manifest.groups.thenPreview) assertGroupImage(manifest.groups.thenPreview, GROUP_PATHS.thenPreview);

  for (const pair of manifest.pairs) {
    assertPairSide(pair.now, pair.number, 'now');
    assertPairSide(pair.then, pair.number, 'then');
  }
}

export function parseFacePairsBundleManifest(raw: unknown): FacePairsBundleManifest {
  const parsed = manifestSchema.safeParse(raw);
  if (!parsed.success) throw new Error(formatManifestIssue(parsed.error));
  const manifest: FacePairsBundleManifest = {
    version: FACE_PAIR_BUNDLE_VERSION,
    groups: parsed.data.groups,
    pairs: parsed.data.pairs,
  };
  validateManifestRelationships(manifest);
  return manifest;
}

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

/** @deprecated Temporary until transfer.ts imports bundle manifests in Task 2. */
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
