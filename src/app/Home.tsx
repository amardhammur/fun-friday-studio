import { ArrowRight, Monitor, Sparkles, Trophy, Users } from 'lucide-react';
import type { EventSession } from '../core/types';

export function Home({ event, onResume, onBuildEvent, onLibrary }: { event: EventSession; onResume: () => void; onBuildEvent: () => void; onLibrary: () => void }) {
  const active = !event.isDemo && (event.segments.length > 0 || event.phase !== 'lineup');
  return <main className="home-page welcome-page">
    <section className="welcome-hero">
      <div className="welcome-copy"><span className="eyebrow"><Sparkles size={15}/> {active ? event.title : 'LESS WORK. MORE PLAY.'}</span>
        <h1>Good teams make<br/><span>great memories.</span></h1>
        <p>Your little toolkit for a very good Friday.<br/>Bring the team. We’ll bring the fun.</p>
        <div className="button-row"><button className="button primary large" onClick={active ? onResume : onBuildEvent}>{active ? event.phase === 'finale' ? 'Relive the highlights' : 'Let’s get together' : 'Build your Friday'} <ArrowRight size={19}/></button><button className="button subtle" onClick={onLibrary}>Find your next game</button></div>
        <div className="hero-details"><span><Monitor size={16}/> One laptop. One big screen.</span><span><Users size={16}/> The whole team.</span></div>
      </div>
      <div className="welcome-art" aria-hidden="true"><span className="welcome-star star-one">✦</span><div className="welcome-emblem"><Trophy size={90} strokeWidth={1.25}/><span>GOOD TIMES<br/><b>GREAT COMPANY</b></span></div><span className="welcome-star star-two">✧</span><p className="handwritten">Bragging rights included.</p></div>
    </section>
    <section className="welcome-invitation"><span className="eyebrow">TODAY’S AGENDA</span><h2>Make a memory. Share a laugh.<br/><span>Give them something to talk about on Monday.</span></h2><p>No deadlines attached.</p></section>
  </main>;
}
