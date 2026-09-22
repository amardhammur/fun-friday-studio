/// <reference lib="webworker" />
import { FaceDetector, FilesetResolver } from '@mediapipe/tasks-vision';
import { clampRect, intersectionOverUnion } from '../core/images/math';
import type { Rect } from '../core/types';
const worker = self as unknown as DedicatedWorkerGlobalScope;
// Enforce a local-only boundary, including any telemetry in third-party runtimes.
// Only reads from our own static asset origin can reach the network.
const localFetch = globalThis.fetch.bind(globalThis);
globalThis.fetch = (input, init) => {
  const url = new URL(input instanceof Request ? input.url : String(input), worker.location.href);
  const method = init?.method ?? (input instanceof Request ? input.method : 'GET');
  if (url.origin !== worker.location.origin || method.toUpperCase() !== 'GET') return Promise.reject(new Error('Fun Friday Studio only reads local assets.'));
  return localFetch(input, init);
};
let detector: FaceDetector | undefined;
worker.onmessage = async ({ data }) => {
  let bitmap: ImageBitmap | undefined;
  try {
    detector ??= await FaceDetector.createFromOptions(await FilesetResolver.forVisionTasks(`${data.assetBase}mediapipe`, true), {
      baseOptions: { modelAssetPath: `${data.assetBase}models/blaze_face_short_range.tflite`, delegate: 'CPU' }, runningMode: 'IMAGE', minDetectionConfidence: .45,
    });
    bitmap = await createImageBitmap(data.blob, { imageOrientation: 'from-image' });
    const W = bitmap.width, H = bitmap.height, tile = 640, step = 448;
    const regions = [{ x: 0, y: 0, width: W, height: H }];
    if (Math.max(W, H) > 900) {
      for (let y = 0; y < H; y += step) for (let x = 0; x < W; x += step) {
        const rx = Math.max(0, Math.min(x, W - tile)), ry = Math.max(0, Math.min(y, H - tile));
        if (!regions.some(r => r.x === rx && r.y === ry && r.width === Math.min(tile, W))) regions.push({ x: rx, y: ry, width: Math.min(tile, W), height: Math.min(tile, H) });
      }
    }
    const faces: { box: Rect; confidence: number }[] = [];
    for (let i = 0; i < regions.length; i++) {
      const r = regions[i], scale = Math.min(1, 640 / Math.max(r.width, r.height));
      const canvas = new OffscreenCanvas(Math.round(r.width * scale), Math.round(r.height * scale));
      canvas.getContext('2d')!.drawImage(bitmap, r.x, r.y, r.width, r.height, 0, 0, canvas.width, canvas.height);
      const results = detector.detect(canvas);
      for (const face of results.detections) if (face.boundingBox) {
        const b = face.boundingBox;
        faces.push({ box: clampRect({ x: (r.x + b.originX / scale) / W, y: (r.y + b.originY / scale) / H, width: b.width / scale / W, height: b.height / scale / H }), confidence: face.categories[0]?.score ?? 0 });
      }
      worker.postMessage({ id: data.id, progress: `Finding faces · ${i + 1} / ${regions.length} image tiles` });
    }
    faces.sort((a, b) => b.confidence - a.confidence);
    const unique: Rect[] = [];
    for (const face of faces) if (!unique.some(box => intersectionOverUnion(box, face.box) > .25)) unique.push(face.box);
    worker.postMessage({ id: data.id, result: unique.sort((a, b) => a.x - b.x || a.y - b.y) });
  } catch (error) { worker.postMessage({ id: data.id, error: `Automatic detection is unavailable. You can draw face boxes manually. ${error instanceof Error ? error.message : ''}` }); }
  finally { bitmap?.close(); }
};
