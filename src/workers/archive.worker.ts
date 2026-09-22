/// <reference lib="webworker" />
import { zipSync, unzipSync, strToU8, strFromU8 } from 'fflate';
const worker = self as unknown as DedicatedWorkerGlobalScope;
worker.onmessage = ({ data }) => {
  try {
    if (data.type === 'zip') {
      const files: Record<string, Uint8Array> = data.files;
      if (data.manifest) files['session.json'] = strToU8(JSON.stringify(data.manifest));
      const bytes = zipSync(files, { level: 0 });
      worker.postMessage({ id: data.id, result: bytes }, [bytes.buffer]);
    } else {
      let total = 0, count = 0;
      const files = unzipSync(data.bytes, { filter(file) {
        total += file.originalSize; count++;
        if (total > 800 * 1024 * 1024 || count > 2000) throw new Error('This ZIP is too large to load safely.');
        if (file.name.includes('..') || file.name.startsWith('/')) throw new Error('The ZIP contains an invalid path.');
        return true;
      } });
      if (!files['session.json'] && !data.allowMissingManifest) {
        throw new Error('This is not a Fun Friday Studio session ZIP.');
      }
      const manifest = files['session.json']
        ? JSON.parse(strFromU8(files['session.json']))
        : undefined;
      if (files['session.json']) delete files['session.json'];
      worker.postMessage({ id: data.id, result: { manifest, files } }, Object.values(files).map(file => file.buffer));
    }
  } catch (error) { worker.postMessage({ id: data.id, error: error instanceof Error ? error.message : 'Could not read this ZIP.' }); }
};
