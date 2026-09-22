import { useRef, useState } from 'react';
import type { FacePair, Rect } from '../core/types';
import { clampRect } from '../core/images/math';
import { useImageUrl } from './Images';
export type EditorMode = 'select' | 'add' | 'pair';
interface Props {
  imageId: string; overlayId?: string; overlayOpacity?: number; aspect: number;
  pairs: FacePair[]; side: 'now' | 'then'; selected?: string; mode: EditorMode;
  onSelect: (pairId: string, side: 'now' | 'then') => void;
  onChange: (pairId: string, rect: Rect) => void;
  onAdd: (rect: Rect) => void;
}
export function PhotoEditor({ imageId, overlayId, overlayOpacity = .5, aspect, pairs, side, selected, mode, onSelect, onChange, onAdd }: Props) {
  const { url } = useImageUrl(imageId), { url: overlay } = useImageUrl(overlayId);
  const svg = useRef<SVGSVGElement>(null);
  const drag = useRef<{ id?: string; start: { x: number; y: number }; rect: Rect; kind: 'move' | 'resize' | 'add' } | null>(null);
  const [preview, setPreview] = useState<{ id?: string; rect: Rect } | null>(null);
  const coords = (e: React.PointerEvent) => { const r = svg.current!.getBoundingClientRect(); return { x: Math.max(0, Math.min(1, (e.clientX - r.left) / r.width)), y: Math.max(0, Math.min(1, (e.clientY - r.top) / r.height)) }; };
  const begin = (e: React.PointerEvent, id?: string, resize = false) => {
    if (e.button !== 0) return;
    if (id) onSelect(id, side);
    if (mode === 'pair' || (mode !== 'add' && !id)) return;
    const start = coords(e), box = id ? pairs.find(p => p.id === id)?.[side]?.faceBox : undefined;
    drag.current = { id: mode === 'add' ? undefined : id, start, rect: mode === 'add' ? { ...start, width: 0, height: 0 } : box!, kind: mode === 'add' ? 'add' : resize ? 'resize' : 'move' };
    svg.current!.setPointerCapture(e.pointerId); e.preventDefault(); e.stopPropagation();
  };
  return <div className={`photo-editor mode-${mode}`} style={{ aspectRatio: aspect }}><svg ref={svg} viewBox={`0 0 1000 ${1000 / aspect}`} role="group" aria-label={`${side === 'now' ? 'Original' : 'Childhood'} photo face editor`} onPointerDown={e => { if (e.target === e.currentTarget || (e.target as SVGElement).tagName === 'image') begin(e); }} onPointerMove={e => {
    const d = drag.current; if (!d) return; const p = coords(e), dx = p.x - d.start.x, dy = p.y - d.start.y;
    let r: Rect;
    if (d.kind === 'add') r = { x: Math.min(d.start.x, p.x), y: Math.min(d.start.y, p.y), width: Math.abs(dx), height: Math.abs(dy) };
    else if (d.kind === 'resize') r = clampRect({ ...d.rect, width: d.rect.width + dx, height: d.rect.height + dy });
    else r = { ...d.rect, x: Math.max(0, Math.min(1 - d.rect.width, d.rect.x + dx)), y: Math.max(0, Math.min(1 - d.rect.height, d.rect.y + dy)) };
    setPreview({ id: d.id, rect: r });
  }} onPointerUp={() => { if (drag.current && preview) { if (drag.current.kind === 'add') { if (preview.rect.width > .01 && preview.rect.height > .01) onAdd(clampRect(preview.rect)); } else if (preview.id) onChange(preview.id, preview.rect); } drag.current = null; setPreview(null); }} onPointerCancel={() => { drag.current = null; setPreview(null); }}>
    {url && <image href={url} width="1000" height={1000 / aspect}/>}{overlay && <image href={overlay} width="1000" height={1000 / aspect} opacity={overlayOpacity}/>}
    {pairs.map(pair => { const face = pair[side]; if (!face) return null; const r = preview?.id === pair.id ? preview.rect : face.faceBox, x = r.x * 1000, y = r.y * 1000 / aspect, w = r.width * 1000, h = r.height * 1000 / aspect;
      return <g key={pair.id} className={`face-marker ${selected === pair.id ? 'selected' : ''}`} tabIndex={0} role="button" aria-label={`${side} face ${pair.number}`} onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onSelect(pair.id, side); } }} onPointerDown={e => begin(e, pair.id)} style={{ color: pair.color }}>
        <rect x={x} y={y} width={w} height={h} rx={4} fill={selected === pair.id ? 'currentColor' : 'transparent'} fillOpacity={selected === pair.id ? .15 : 0} stroke="currentColor" strokeWidth={selected === pair.id ? 5 : 3} vectorEffect="non-scaling-stroke"/>
        <rect x={x - 2} y={Math.max(0, y - 32)} width={38} height={32} rx={5} fill="currentColor"/><text x={x + 17} y={Math.max(0, y - 32) + 23} textAnchor="middle" fill="#173b32" fontSize={23} fontWeight="bold">{pair.number}</text>
        {selected === pair.id && mode === 'select' && <rect className="resize-handle" x={x + w - 10} y={y + h - 10} width={20} height={20} fill="currentColor" stroke="#fff" strokeWidth={2} onPointerDown={e => { e.stopPropagation(); begin(e, pair.id, true); }}/ >}
      </g>;
    })}
    {preview && !preview.id && <rect x={preview.rect.x * 1000} y={preview.rect.y * 1000 / aspect} width={preview.rect.width * 1000} height={preview.rect.height * 1000 / aspect} fill="#f7d87333" stroke="#f7d873" strokeWidth={3}/>}
  </svg></div>;
}
