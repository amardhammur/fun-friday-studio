import { useEffect, useState } from 'react';
import { ExternalLink, Film, Play, RotateCw } from 'lucide-react';
import { useImageUrl } from '../../src/components/Images';
import { youtubeReference } from './source';
import type { Settings } from './types';

export function ReferenceVideo({ settings }: { settings: Settings }) {
  const [requested, setRequested] = useState(''), [online, setOnline] = useState(navigator.onLine), [playbackError, setPlaybackError] = useState(false);
  const [attempt, setAttempt] = useState(0);
  const { url, error } = useImageUrl(settings.source === 'local' ? settings.videoAssetId : undefined);
  useEffect(() => { setPlaybackError(false); }, [settings.videoAssetId]);
  useEffect(() => {
    const changed = () => setOnline(navigator.onLine);
    window.addEventListener('online', changed); window.addEventListener('offline', changed);
    return () => { window.removeEventListener('online', changed); window.removeEventListener('offline', changed); };
  }, []);
  if (settings.source === 'local') return <div className="cts-video-wrap">
    {error || playbackError ? <div className="cts-video-placeholder" role="alert"><Film size={40}/><p>The local clip could not be played. Restore the session ZIP or choose another video in setup.</p></div> : url ? <video key={settings.videoAssetId} src={url} controls playsInline preload="metadata" aria-label="Reference clip" onError={() => setPlaybackError(true)}/> : <div className="cts-video-placeholder" role="status">Loading your local clip…</div>}
    <span className="cts-source-note">Saved on this laptop · works offline</span>
  </div>;
  const reference = youtubeReference(settings.youtubeUrl);
  const loaded = Boolean(reference?.embedUrl && requested === reference.embedUrl);
  return <div className="cts-video-wrap">
    {reference?.embedUrl && loaded ? <iframe key={attempt} title="YouTube reference clip" src={reference.embedUrl} allow="accelerometer; autoplay; encrypted-media; gyroscope; picture-in-picture; fullscreen" allowFullScreen referrerPolicy="strict-origin-when-cross-origin"/> : <div className="cts-video-placeholder"><Film size={48}/><h2>{settings.clipTitle.trim() || 'Your reference clip'}</h2>{reference?.embedUrl && <button type="button" className="button primary" disabled={!online} onClick={() => setRequested(reference.embedUrl!)}><Play size={18}/> Load YouTube video</button>}{!reference?.embedUrl && <p>Open the selected clip on YouTube.</p>}</div>}
    <div className="cts-source-links"><span className="cts-source-note">{!online ? 'You’re offline. YouTube playback needs internet.' : loaded ? 'Video unavailable? Open it on YouTube, or use a different clip.' : 'YouTube needs internet. Use a local video to play offline.'}</span>{reference && <a className="button subtle small-button" href={reference.url} target="_blank" rel="noopener noreferrer"><ExternalLink size={16}/> Open clip on YouTube</a>}{loaded && <button type="button" className="button subtle small-button" aria-label="Retry YouTube player" disabled={!online} onClick={() => setAttempt(n => n + 1)}><RotateCw size={16}/> Retry player</button>}</div>
  </div>;
}
