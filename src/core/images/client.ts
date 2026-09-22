import type { Rect, FaceCrop } from '../types';
type Pending = { resolve: (data: any) => void; reject: (error: Error) => void; progress?: (message: string) => void };
export function rpc(create: () => Worker) {
  let worker: Worker | undefined;
  const pending = new Map<string, Pending>();
  return <T>(payload: Record<string, unknown>, progress?: (message: string) => void): Promise<T> => {
    worker ??= create();
    worker.onmessage = ({ data }) => {
      const job = pending.get(data.id); if (!job) return;
      if (data.progress) { job.progress?.(data.progress); return; }
      pending.delete(data.id); data.error ? job.reject(new Error(data.error)) : job.resolve(data.result);
    };
    worker.onerror = () => {
      pending.forEach(job => job.reject(new Error('The local image worker stopped. Try a smaller image or reload the app.')));
      pending.clear(); worker?.terminate(); worker = undefined;
    };
    const id = crypto.randomUUID();
    return new Promise<T>((resolve, reject) => { pending.set(id, { resolve, reject, progress }); worker!.postMessage({ ...payload, id }); });
  };
}
export const imageJob = rpc(() => new Worker(new URL('../../workers/images.worker.ts', import.meta.url), { type: 'module' }));
const detectionJob = rpc(() => new Worker(new URL('../../workers/detection.worker.ts', import.meta.url), { type: 'module' }));
export const detectFaces = (blob: Blob, progress?: (message: string) => void) => detectionJob<Rect[]>({ type: 'detect', blob, assetBase: new URL(import.meta.env.BASE_URL, location.href).href }, progress);
export const inspectImage = (blob: Blob) => imageJob<{ width: number; height: number; preview: Blob }>({ type: 'inspect', blob });
export const scaleImage = (blob: Blob, width: number, height: number) => imageJob<Blob>({ type: 'scale', blob, width, height });
export const cropImage = (blob: Blob, face: FaceCrop) => imageJob<{ blob: Blob; width: number; height: number }>({ type: 'crop', blob, face });
export const cropMany = (blob: Blob, faces: FaceCrop[]) => imageJob<{ blob: Blob; width: number; height: number }[]>({ type: 'cropMany', blob, faces });
