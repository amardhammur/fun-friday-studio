/// <reference lib="webworker" />
import { cropPixels, outputSize } from '../core/images/math';
const worker = self as unknown as DedicatedWorkerGlobalScope;
worker.onmessage = async ({ data }) => {
  let bitmap: ImageBitmap | undefined;
  try {
    try { bitmap = await createImageBitmap(data.blob, { imageOrientation: 'from-image' }); }
    catch { throw new Error('This image could not be read. Please use a JPEG, PNG, or WebP file. Convert HEIC/HEIF photos to JPEG first.'); }
    const width = bitmap.width, height = bitmap.height;
    if (data.type === 'inspect') {
      const scale = Math.min(1, 1600 / Math.max(width, height));
      const canvas = new OffscreenCanvas(Math.max(1, Math.round(width * scale)), Math.max(1, Math.round(height * scale)));
      canvas.getContext('2d')!.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
      worker.postMessage({ id: data.id, result: { width, height, preview: await canvas.convertToBlob({ type: 'image/jpeg', quality: .86 }) } });
    } else if (data.type === 'scale') {
      const canvas = new OffscreenCanvas(data.width, data.height);
      canvas.getContext('2d')!.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
      worker.postMessage({ id: data.id, result: await canvas.convertToBlob({ type: 'image/jpeg', quality: .98 }) });
    } else if (data.type === 'crop' || data.type === 'cropMany') {
      const result = [];
      for (const face of data.type === 'cropMany' ? data.faces : [data.face]) {
        const r = cropPixels(face, width, height), size = outputSize(r.width, r.height);
        const canvas = new OffscreenCanvas(size.width, size.height), ctx = canvas.getContext('2d')!;
        ctx.fillStyle = '#eee8d9'; ctx.fillRect(0, 0, size.width, size.height);
        ctx.drawImage(bitmap, r.x, r.y, r.width, r.height, 0, 0, size.width, size.height);
        result.push({ blob: await canvas.convertToBlob({ type: 'image/jpeg', quality: .94 }), ...size });
        canvas.width = 1; canvas.height = 1;
      }
      worker.postMessage({ id: data.id, result: data.type === 'cropMany' ? result : result[0] });
    } else throw new Error('Unknown image operation.');
  } catch (error) { worker.postMessage({ id: data.id, error: error instanceof Error ? error.message : 'Image processing failed.' }); }
  finally { bitmap?.close(); }
};
