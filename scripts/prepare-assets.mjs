import { cp, mkdir, access, writeFile } from 'node:fs/promises';
await mkdir('public/mediapipe', { recursive: true });
await mkdir('public/models', { recursive: true });
await mkdir('public/licenses', { recursive: true });
await cp('node_modules/@mediapipe/tasks-vision/wasm', 'public/mediapipe', { recursive: true });
const path = 'public/models/blaze_face_short_range.tflite';
try { await access(path); }
catch {
  const url = 'https://storage.googleapis.com/mediapipe-models/face_detector/blaze_face_short_range/float16/1/blaze_face_short_range.tflite';
  const response = await fetch(url);
  if (!response.ok) throw new Error(`Model download failed: ${response.status}`);
  await writeFile(path, new Uint8Array(await response.arrayBuffer()));
}
try { await access('public/licenses/MediaPipe-Apache-2.0.txt'); }
catch {
  const response = await fetch('https://raw.githubusercontent.com/google-ai-edge/mediapipe/master/LICENSE');
  if (!response.ok) throw new Error('Could not download the MediaPipe license notice.');
  await writeFile('public/licenses/MediaPipe-Apache-2.0.txt', await response.text());
}
console.log('Local face-detection assets are ready.');
