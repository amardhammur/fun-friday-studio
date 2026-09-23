import { z } from 'zod';
import type { Person, Rect } from '../types';
import { MAX_PHOTO_SETS } from './photo-sets';

export const MAX_PEOPLE = 500;
export const MAX_FACE_PAIRS = 1000;
export const FACE_PAIR_BUNDLE_VERSION = 2;

export interface FacePairBundlePadding { top: number; right: number; bottom: number; left: number }
export interface FacePairBundleFaceSide { cropPath: string; faceBox: Rect; padding: FacePairBundlePadding }
export interface FacePairBundleImage { path: string; name: string; width: number; height: number; mime: string }
export const SET_IMAGE_FIELDS = ['now', 'then', 'nowPreview', 'thenPreview'] as const;
export type SetImageField = typeof SET_IMAGE_FIELDS[number];
export interface FacePairBundleSet { key: string; name: string; kind: 'group' | 'single'; now: FacePairBundleImage; then: FacePairBundleImage; nowPreview?: FacePairBundleImage; thenPreview?: FacePairBundleImage }
export interface FacePairBundleEntry { number: number; set: string; color: string; name: string; funFact: string; included: boolean; now: FacePairBundleFaceSide; then: FacePairBundleFaceSide }
export interface FacePairsBundleManifest { version: 2; sets: FacePairBundleSet[]; pairs: FacePairBundleEntry[] }

export const setKey = (index: number) => String(index + 1).padStart(2, '0');
const FILE_NAMES: Record<SetImageField, string> = { now: 'now', then: 'then', nowPreview: 'now-preview', thenPreview: 'then-preview' };
export const setImagePath = (key: string, field: SetImageField) => `sets/${key}/${FILE_NAMES[field]}`;
const v1GroupPath = (field: SetImageField) => `groups/${FILE_NAMES[field]}`;
export const pairCropPath = (number: number, side: 'now' | 'then') => `pairs/${String(number).padStart(3, '0')}-${side}.jpg`;
export const bundleSetName = (fileName: string) => fileName.replace(/\.zip$/i, '').trim().slice(0, 80) || 'Imported group';

const paddingValue = z.number().min(0).max(3, { message: 'Crop padding must stay between 0 and 3.' });
const paddingSchema = z.object({ top: paddingValue, right: paddingValue, bottom: paddingValue, left: paddingValue });
const faceBoxSchema = z.object({ x: z.number().min(0).max(1), y: z.number().min(0).max(1), width: z.number().positive().max(1), height: z.number().positive().max(1) })
  .refine(rect => rect.x + rect.width <= 1.00001 && rect.y + rect.height <= 1.00001, { message: 'Face box lies outside the image.' });
const imageSchema = z.object({
  path: z.string(),
  name: z.string().trim().min(1, 'Every group image needs a name.'),
  width: z.number().positive('Group image width must be positive.'),
  height: z.number().positive('Group image height must be positive.'),
  mime: z.string().refine(mime => mime.startsWith('image/'), { message: 'Group image MIME type must be an image.' }),
});
const faceSideSchema = z.object({ cropPath: z.string(), faceBox: faceBoxSchema, padding: paddingSchema });
const pairSchema = z.object({
  number: z.number().int().positive().max(MAX_FACE_PAIRS),
  color: z.string().regex(/^#[0-9a-f]{6}$/i, 'Each pair needs a hex color.'),
  name: z.string().trim().min(1, 'Every person needs a display name.'),
  funFact: z.string().max(240),
  included: z.boolean(),
  now: faceSideSchema,
  then: faceSideSchema,
});
const v1Schema = z.object({
  version: z.literal(1),
  groups: z.object({ now: imageSchema, then: imageSchema, nowPreview: imageSchema.optional(), thenPreview: imageSchema.optional() }),
  pairs: z.array(pairSchema).min(1, 'The bundle manifest must include at least one pair.').max(MAX_FACE_PAIRS),
});
const v2Schema = z.object({
  version: z.literal(2),
  sets: z.array(z.object({ key: z.string(), name: z.string().trim().min(1, 'Every photo set needs a name.').max(80), kind: z.enum(['group', 'single']), now: imageSchema, then: imageSchema, nowPreview: imageSchema.optional(), thenPreview: imageSchema.optional() }))
    .min(1, 'The bundle manifest must include at least one photo set.').max(MAX_PHOTO_SETS),
  pairs: z.array(pairSchema.extend({ set: z.string() })).min(1, 'The bundle manifest must include at least one pair.').max(MAX_FACE_PAIRS),
});

function formatManifestIssue(error: z.ZodError): string {
  const issue = error.issues[0];
  if (!issue) return 'Invalid face pair bundle manifest.';
  const path = issue.path.map(part => String(part)).join('.');
  if (path.startsWith('groups')) return issue.message.includes('group') ? issue.message : `Invalid group metadata: ${issue.message}`;
  if (path.startsWith('sets')) return issue.message.includes('set') ? issue.message : `Invalid photo set metadata: ${issue.message}`;
  if (path.includes('.then') || path.endsWith('then')) return `Missing or invalid then side: ${issue.message}`;
  return issue.message;
}
function parseWith<T>(schema: z.ZodType<T>, raw: unknown): T {
  const parsed = schema.safeParse(raw);
  if (!parsed.success) throw new Error(formatManifestIssue(parsed.error));
  return parsed.data;
}
function assertSafeBundlePath(path: string) {
  if (!path || path.includes('\\') || path.startsWith('/') || path.includes('..') || path.includes('//')) throw new Error('Bundle manifest paths must stay under sets/, groups/ and pairs/.');
}
// Duplicate references are reported before fixed-location mismatches, so a copied path names the real problem.
function checkFiles(manifest: FacePairsBundleManifest, expected: (set: FacePairBundleSet, field: SetImageField) => string, label: (set: FacePairBundleSet) => string) {
  const seen = new Map<string, string>();
  const track = (path: string, what: string) => {
    assertSafeBundlePath(path);
    const previous = seen.get(path);
    if (previous) throw new Error(`Duplicate bundle file reference for ${path} (${previous} and ${what}).`);
    seen.set(path, what);
  };
  for (const set of manifest.sets) for (const field of SET_IMAGE_FIELDS) { const image = set[field]; if (image) track(image.path, `set ${set.key} ${field}`); }
  const numbers = new Set<number>();
  for (const pair of manifest.pairs) {
    if (numbers.has(pair.number)) throw new Error(`Duplicate pair number ${pair.number}.`);
    numbers.add(pair.number);
    track(pair.now.cropPath, `pair ${pair.number} now crop`); track(pair.then.cropPath, `pair ${pair.number} then crop`);
  }
  for (const set of manifest.sets) for (const field of SET_IMAGE_FIELDS) {
    const image = set[field], path = expected(set, field);
    if (image && image.path !== path) throw new Error(`${label(set)} path must be ${path}.`);
  }
  for (const pair of manifest.pairs) for (const side of ['now', 'then'] as const) {
    const path = pairCropPath(pair.number, side);
    if (pair[side].cropPath !== path) throw new Error(`Pair ${pair.number} ${side} crop path must be ${path}.`);
  }
}
function checkSets(manifest: FacePairsBundleManifest) {
  manifest.sets.forEach((set, index) => { if (set.key !== setKey(index)) throw new Error(`Photo set ${index + 1} must use key ${setKey(index)}.`); });
  const keys = new Set(manifest.sets.map(set => set.key));
  for (const pair of manifest.pairs) if (!keys.has(pair.set)) throw new Error(`Pair ${pair.number} names an unknown photo set ${pair.set}.`);
  for (const set of manifest.sets) {
    const count = manifest.pairs.filter(pair => pair.set === set.key).length;
    if (!count) throw new Error(`Photo set ${set.key} has no people.`);
    if (set.kind === 'single' && count !== 1) throw new Error(`Single-photo set ${set.key} must hold exactly one person.`);
  }
}

// Version 1 held one group; it becomes a version 2 manifest with a single set that keeps its groups/ paths.
export function parseFacePairsBundleManifest(raw: unknown, fallbackSetName = 'Imported group'): FacePairsBundleManifest {
  const version = (raw as { version?: unknown } | null)?.version;
  if (version === 1) {
    const v1 = parseWith(v1Schema, raw);
    const manifest: FacePairsBundleManifest = { version: 2, sets: [{ key: '01', name: fallbackSetName, kind: 'group', ...v1.groups }], pairs: v1.pairs.map(pair => ({ ...pair, set: '01' })) };
    checkFiles(manifest, (_set, field) => v1GroupPath(field), () => 'Group image');
    return manifest;
  }
  if (version === 2) {
    const manifest = parseWith(v2Schema, raw) as FacePairsBundleManifest;
    checkSets(manifest);
    checkFiles(manifest, (set, field) => setImagePath(set.key, field), set => `Photo set ${set.key} image`);
    return manifest;
  }
  throw new Error('Unsupported face pair bundle manifest version.');
}
export function bundlePaths(manifest: FacePairsBundleManifest): string[] {
  return [
    ...manifest.sets.flatMap(set => SET_IMAGE_FIELDS.flatMap(field => set[field] ? [set[field]!.path] : [])),
    ...manifest.pairs.flatMap(pair => [pair.now.cropPath, pair.then.cropPath]),
  ];
}

export function hasJpegSignature(bytes: Uint8Array): boolean {
  return bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff;
}
export function assertLibraryCapacity(adding: { pairs: number; sets: number }, current: { people: number; facePairs: number; photoSets: number }) {
  const exceeded: string[] = [];
  if (current.people + adding.pairs > MAX_PEOPLE) exceeded.push(`${MAX_PEOPLE} people`);
  if (current.facePairs + adding.pairs > MAX_FACE_PAIRS) exceeded.push(`${MAX_FACE_PAIRS} face pairs`);
  if (current.photoSets + adding.sets > MAX_PHOTO_SETS) exceeded.push(`${MAX_PHOTO_SETS} photo sets`);
  if (exceeded.length) throw new Error(`Cannot import ${adding.pairs} face pairs: this session would exceed its limit of ${exceeded.join(' and ')}.`);
}
export function maxFacePairNumber(numbers: readonly number[]): number {
  return numbers.reduce((max, number) => Math.max(max, number), 0);
}
export const normalizeName = (name: string) => name.trim().toLocaleLowerCase();
export function duplicateNames(existing: readonly Person[], manifest: FacePairsBundleManifest): string[] {
  const taken = new Set(existing.map(person => normalizeName(person.name)).filter(Boolean));
  return manifest.pairs.filter(pair => taken.has(normalizeName(pair.name))).map(pair => pair.name);
}
export function duplicateSummary(names: readonly string[]): string {
  if (names.length === 1) return `${names[0]} is already in your library.`;
  if (names.length === 2) return `${names[0]} and ${names[1]} are already in your library.`;
  return `${names[0]}, ${names[1]} and ${names.length - 2} more are already in your library.`;
}
