import { imageStore } from '../../src/core/storage';
import type { Asset } from '../../src/core/types';
import { MAX_VIDEO_BYTES, VIDEO_MIMES } from './source';

export async function storeVideo(file: File): Promise<Asset> {
  const mime = file.type || (/\.mp4$/i.test(file.name) ? 'video/mp4' : /\.webm$/i.test(file.name) ? 'video/webm' : '');
  if (!VIDEO_MIMES.has(mime)) throw new Error('Choose an MP4 or WebM video.');
  if (!file.size || file.size > MAX_VIDEO_BYTES) throw new Error('Choose a nonempty video smaller than 100 MB.');
  const blob = new Blob([file], { type: mime });
  const size = await new Promise<{ width: number; height: number }>((resolve, reject) => {
    const video = document.createElement('video'), url = URL.createObjectURL(blob);
    const cleanup = () => { clearTimeout(timeout); video.onloadedmetadata = null; video.onerror = null; video.removeAttribute('src'); video.load(); URL.revokeObjectURL(url); };
    const fail = () => { cleanup(); reject(new Error('This video cannot be played in this browser. Try another MP4 or WebM clip.')); };
    const timeout = setTimeout(fail, 15000);
    video.preload = 'metadata';
    video.onloadedmetadata = () => {
      // Recorded WebM clips can report an unknown duration until playback begins.
      if (!video.videoWidth || !video.videoHeight) { fail(); return; }
      const dimensions = { width: video.videoWidth, height: video.videoHeight };
      cleanup(); resolve(dimensions);
    };
    video.onerror = fail; video.src = url;
  });
  let id: string;
  try { id = await imageStore.put(blob, undefined, { durable: true }); }
  catch { throw new Error('The video could not be saved on this laptop. Free some browser storage and try again.'); }
  return { id, name: file.name, mime, ...size };
}
