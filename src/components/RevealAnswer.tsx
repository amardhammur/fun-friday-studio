import type { ReactNode } from 'react';

/** The answer treatment shared with Childhood vs Now. Mounted only after reveal. */
export function RevealAnswer({ eyebrow, title, description, children }: { eyebrow: string; title: string; description?: string; children?: ReactNode }) {
  return <div className="reveal-name"><span className="eyebrow">{eyebrow}</span><h1>{title}</h1>{description && <p>{description}</p>}{children}</div>;
}
