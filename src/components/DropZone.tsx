import { useRef, useState } from 'react';
import { Upload, RefreshCw } from 'lucide-react';
import { StoredImage } from './Images';
export function DropZone({ title, subtitle, imageId, onFile, label }: { title: string; subtitle: string; imageId?: string; onFile: (file: File) => void; label: string }) {
  const input = useRef<HTMLInputElement>(null), [dragging, setDragging] = useState(false);
  return <div className={`drop-zone ${dragging ? 'dragging' : ''} ${imageId ? 'has-image' : ''}`} onDragOver={e => { e.preventDefault(); setDragging(true); }} onDragLeave={() => setDragging(false)} onDrop={e => { e.preventDefault(); setDragging(false); const file = e.dataTransfer.files[0]; if (file) onFile(file); }}>
    <input ref={input} aria-label={title} type="file" accept="image/*,.heic,.heif" className="visually-hidden" onChange={e => { const file = e.target.files?.[0]; if (file) onFile(file); e.target.value = ''; }} />
    {imageId ? <StoredImage id={imageId} alt={title} /> : <div className="upload-symbol"><Upload size={30}/></div>}
    <span className="eyebrow">{label}</span><h3>{title}</h3><p>{subtitle}</p>
    <button className="button secondary" onClick={() => input.current?.click()}>{imageId ? <RefreshCw size={16}/> : <Upload size={16}/>} {imageId ? 'Replace photo' : 'Choose photo'}</button>
    {!imageId && <small>or drag it right here · JPG, PNG, WebP</small>}
  </div>;
}
