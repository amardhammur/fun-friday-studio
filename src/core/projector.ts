import { useEffect } from 'react';
import type { Activity, ActivityContext } from './types';
export function useShortcuts(activity: Activity | undefined, context: ActivityContext | undefined, enabled: boolean) {
  useEffect(() => {
    if (!enabled || !activity || !context) return;
    const listener = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement;
      if (event.repeat || event.ctrlKey || event.metaKey || event.altKey || target.closest('input, textarea, select, [contenteditable="true"], [role="dialog"]') || document.querySelector('[aria-modal="true"]')) return;
      if (target.closest('button') && (event.key === 'Enter' || event.key === ' ')) return;
      const shortcut = activity.shortcuts.find(s => s.key.toLowerCase() === event.key.toLowerCase());
      if (shortcut) { event.preventDefault(); shortcut.run(context); }
    };
    window.addEventListener('keydown', listener); return () => window.removeEventListener('keydown', listener);
  }, [activity, context, enabled]);
}
export async function toggleFullscreen() {
  if (document.fullscreenElement) await document.exitFullscreen();
  else if (document.documentElement.requestFullscreen) await document.documentElement.requestFullscreen();
  else throw new Error('Full-screen is not available in this browser. Use your browser’s full-screen option.');
}
