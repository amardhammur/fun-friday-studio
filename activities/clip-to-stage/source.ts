export const VIDEO_MIMES = new Set(['video/mp4', 'video/webm']);
export const MAX_VIDEO_BYTES = 100 * 1024 * 1024;

export function youtubeReference(raw: string): { url: string; embedUrl?: string } | undefined {
  try {
    const url = new URL(raw.trim());
    if (!['https:', 'http:'].includes(url.protocol) || url.username || url.password || url.port) return;
    const host = url.hostname.toLowerCase(), path = url.pathname.split('/').filter(Boolean);
    let videoId: string | null = null;
    if (host === 'youtu.be' && path.length === 1) videoId = path[0];
    else if (['youtube.com', 'www.youtube.com', 'm.youtube.com'].includes(host)) {
      if (path.length === 1 && path[0] === 'watch') videoId = url.searchParams.get('v');
      else if (path.length === 2 && ['shorts', 'embed', 'live'].includes(path[0])) videoId = path[1];
      else if (path.length === 2 && path[0] === 'clip' && /^[\w-]{8,128}$/.test(path[1])) return { url: `https://www.youtube.com/clip/${path[1]}` };
    }
    if (!videoId || !/^[\w-]{11}$/.test(videoId)) return;
    const timestamp = url.searchParams.get('start') ?? url.searchParams.get('t') ?? '';
    const match = /^(?:(\d+)h)?(?:(\d+)m)?(?:(\d+)s)?$/.exec(timestamp);
    const seconds = /^\d+$/.test(timestamp) ? Number(timestamp) : match ? Number(match[1] ?? 0) * 3600 + Number(match[2] ?? 0) * 60 + Number(match[3] ?? 0) : 0;
    const start = Number.isSafeInteger(seconds) && seconds > 0 ? seconds : 0;
    return { url: `https://www.youtube.com/watch?v=${videoId}${start ? `&t=${start}s` : ''}`, embedUrl: `https://www.youtube.com/embed/${videoId}?playsinline=1${start ? `&start=${start}` : ''}` };
  } catch { return; }
}
