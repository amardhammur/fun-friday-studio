import type { Rect, FaceCrop } from '../types';
export const defaultPadding = { top: .4, right: .32, bottom: .7, left: .32 };
export function clampRect(r: Rect): Rect {
  const x = Math.max(0, Math.min(.99, r.x)), y = Math.max(0, Math.min(.99, r.y));
  return { x, y, width: Math.max(.005, Math.min(1 - x, r.width)), height: Math.max(.005, Math.min(1 - y, r.height)) };
}
export function paddedRect(face: FaceCrop): Rect {
  const b = face.faceBox, p = face.padding;
  const x = Math.max(0, b.x - b.width * p.left), y = Math.max(0, b.y - b.height * p.top);
  const right = Math.min(1, b.x + b.width * (1 + p.right)), bottom = Math.min(1, b.y + b.height * (1 + p.bottom));
  return { x, y, width: right - x, height: bottom - y };
}
export function cropPixels(face: FaceCrop, width: number, height: number) {
  const r = paddedRect(face);
  const x = Math.floor(r.x * width), y = Math.floor(r.y * height);
  return { x, y, width: Math.min(width - x, Math.max(1, Math.ceil(r.width * width))), height: Math.min(height - y, Math.max(1, Math.ceil(r.height * height))) };
}
export function outputSize(width: number, height: number, longEdge = 1100) {
  const scale = longEdge / Math.max(width, height);
  return { width: Math.max(1, Math.round(width * scale)), height: Math.max(1, Math.round(height * scale)) };
}
export function intersectionOverUnion(a: Rect, b: Rect) {
  const intersection = Math.max(0, Math.min(a.x + a.width, b.x + b.width) - Math.max(a.x, b.x)) * Math.max(0, Math.min(a.y + a.height, b.y + b.height) - Math.max(a.y, b.y));
  return intersection / (a.width * a.height + b.width * b.height - intersection || 1);
}
