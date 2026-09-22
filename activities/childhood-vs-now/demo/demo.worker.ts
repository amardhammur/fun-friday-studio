/// <reference lib="webworker" />
import { generateDemo } from './generateGroupPhotos';
const worker = self as unknown as DedicatedWorkerGlobalScope;
worker.onmessage = async ({ data }) => {
  try { worker.postMessage({ id: data.id, result: await generateDemo() }); }
  catch (error) { worker.postMessage({ id: data.id, error: error instanceof Error ? error.message : 'Could not draw the demo photos.' }); }
};
