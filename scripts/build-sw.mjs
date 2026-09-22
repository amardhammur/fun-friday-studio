import { readdir, readFile, writeFile, access } from 'node:fs/promises';
import { createHash } from 'node:crypto';
await access('dist/models/blaze_face_short_range.tflite');
await access('dist/mediapipe/vision_wasm_internal.wasm');
async function files(dir) {
  const result = [];
  for (const item of await readdir(dir, { withFileTypes: true })) {
    const path = `${dir}/${item.name}`;
    if (item.isDirectory()) result.push(...await files(path));
    else if (item.name !== 'sw.js') result.push(path);
  }
  return result;
}
const paths = await files('dist'), hash = createHash('sha256');
for (const path of paths) hash.update(await readFile(path));
const version = hash.digest('hex').slice(0, 16);
const urls = paths.map(p => `./${p.slice(5)}`);
await writeFile('dist/sw.js', `
const CACHE = 'fun-friday-${version}';
const ASSETS = ${JSON.stringify(urls)};
self.addEventListener('install', event => {
  event.waitUntil(caches.open(CACHE).then(cache => cache.addAll(ASSETS)));
});
self.addEventListener('activate', event => {
  event.waitUntil(Promise.all([
    caches.keys().then(keys => Promise.all(keys.filter(key => key.startsWith('fun-friday-') && key !== CACHE).map(key => caches.delete(key)))),
    self.clients.claim()
  ]));
});
self.addEventListener('fetch', event => {
  if (event.request.method !== 'GET' || new URL(event.request.url).origin !== self.location.origin) return;
  event.respondWith(caches.open(CACHE).then(async cache => {
    // Static assets are identical across request Origin headers. Preview/static
    // servers may emit Vary: Origin; ignore that for our immutable precache.
    const cached = await cache.match(event.request, { ignoreVary: true });
    if (cached) return cached;
    if (event.request.mode === 'navigate') return cache.match('./index.html');
    return fetch(event.request);
  }));
});
`);
console.log(`Offline cache generated: ${urls.length} assets, version ${version}.`);
