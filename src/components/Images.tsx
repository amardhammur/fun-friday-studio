import { useEffect, useState } from 'react';
import { ImageOff } from 'lucide-react';
import { imageStore } from '../core/storage';
import type { Asset, FaceCrop } from '../core/types';
import { paddedRect } from '../core/images/math';
export function useImageUrl(id?: string) {
  const [state, setState] = useState<{ id?: string; url?: string; error?: string }>({});
  useEffect(() => {
    let active = true, url: string | undefined;
    if (id) imageStore.get(id).then(blob => { if (active) { url = URL.createObjectURL(blob); setState({ id, url }); } }).catch(error => { if (active) setState({ id, error: error.message }); });
    return () => { active = false; if (url) URL.revokeObjectURL(url); };
  }, [id]);
  return state.id === id ? state : {};
}
export function StoredImage({ id, alt, className = '', ...props }: { id?: string; alt: string; className?: string } & Omit<React.ImgHTMLAttributes<HTMLImageElement>, 'id'>) {
  const { url, error } = useImageUrl(id);
  if (error) return <div className={`image-missing ${className}`} role="alert"><ImageOff /><span>{error}</span></div>;
  return url ? <img src={url} alt={alt} className={className} {...props} /> : <div className={`image-loading ${className}`} aria-label="Loading image" />;
}
export function CropPreview({ face, assets, previews, label }: { face?: FaceCrop; assets: Record<string, Asset>; previews: Record<string, string>; label: string }) {
  const source = face && assets[face.sourceImageId];
  const { url } = useImageUrl(face && (previews[face.sourceImageId] || face.sourceImageId));
  if (!face || !source || !url) return <span className="crop-placeholder"><ImageOff size={20} /></span>;
  const r = paddedRect(face);
  return <svg className="crop-preview" viewBox={`${r.x * source.width} ${r.y * source.height} ${r.width * source.width} ${r.height * source.height}`} role="img" aria-label={label}><image href={url} width={source.width} height={source.height} /></svg>;
}
