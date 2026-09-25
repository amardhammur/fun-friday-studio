// The look is a per-laptop preference, not part of the event, so it lives outside the session.
export const THEMES = [
  { id: 'festival', name: 'Festival' },
  { id: 'gameshow', name: 'Game Show' },
] as const;
export type ThemeId = typeof THEMES[number]['id'];
const KEY = 'studio-theme';

export function readTheme(): ThemeId {
  try { const saved = localStorage.getItem(KEY); return THEMES.some(t => t.id === saved) ? saved as ThemeId : 'festival'; }
  catch { return 'festival'; }
}

export function applyTheme(theme: ThemeId) {
  if (theme === 'festival') delete document.documentElement.dataset.theme;
  else document.documentElement.dataset.theme = theme;
  try { localStorage.setItem(KEY, theme); } catch { /* the choice still applies for this visit */ }
}

export function nextTheme(theme: ThemeId): ThemeId {
  return THEMES[(THEMES.findIndex(t => t.id === theme) + 1) % THEMES.length].id;
}

export const themeName = (theme: ThemeId) => THEMES.find(t => t.id === theme)!.name;
