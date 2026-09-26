import { ArrowRight, ArrowUpRight, Monitor, Sparkles, Trophy, Users } from 'lucide-react';
import type { EventSession } from '../core/types';

export function Home({ event, onResume, onBuildEvent, onLibrary }: { event: EventSession; onResume: () => void; onBuildEvent: () => void; onLibrary: () => void }) {
  const active = !event.isDemo && (event.segments.length > 0 || event.phase !== 'lineup');
  return <main className="home-page welcome-page">
    <div className="welcome-masthead"><span>THE OFF-THE-CLOCK CLUB</span><span>GOOD COMPANY. FRIENDLY COMPETITION.</span></div>
    <section className="welcome-hero">
      <div className="welcome-copy">
        <span className="eyebrow"><span className="status-dot"/> {active ? event.title : 'YOUR FRIDAY STARTS HERE'}</span>
        <h1>Good teams make<br/><span>great memories.</span></h1>
        <p>Close the tabs. Gather your people.<br/>Make a little room for a lot of fun.</p>
        <div className="button-row"><button className="button primary large" onClick={active ? onResume : onBuildEvent}>{active ? event.phase === 'finale' ? 'Relive the highlights' : 'Let’s get together' : 'Build your Friday'} <ArrowRight size={19}/></button><button className="button subtle" onClick={onLibrary}>Find your next game <ArrowUpRight size={17}/></button></div>
        <div className="hero-details"><span><Monitor size={16}/> One laptop. One big screen.</span><span><Users size={16}/> The whole team.</span></div>
      </div>
      <div className="club-poster" aria-hidden="true">
        <div className="poster-topline"><span>FUN FRIDAY STUDIO</span><ArrowUpRight size={24}/></div>
        <div className="poster-title">ALL PLAY.<br/>NO WORK.</div>
        <div className="poster-art">
          <svg className="club-flower" viewBox="0 0 320 320" fill="none">
            {Array.from({ length: 12 }, (_, i) => <ellipse key={i} cx="160" cy="88" rx="33" ry="79" transform={`rotate(${i * 30} 160 160)`}/>)}
            <circle className="flower-center" cx="160" cy="160" r="53"/>
            <path className="flower-smile" d="M136 168Q160 198 184 168M142 139V148M178 139V148"/>
          </svg>
          <span className="poster-sticker">100%<br/><b>TEAM SPIRIT</b></span>
        </div>
        <div className="poster-ticket"><span>ADMIT EVERYONE<br/><b>Bragging rights included.</b></span><span className="ticket-bars"/></div>
      </div>
    </section>
    <section className="welcome-invitation" aria-labelledby="invitation-title">
      <div className="invitation-heading"><span className="eyebrow">THE PLAN IS SIMPLE</span><h2 id="invitation-title">A Friday worth<br/>talking about.</h2></div>
      <div className="invitation-step"><span className="invitation-icon"><Users size={22}/></span><span className="eyebrow">01 / GATHER</span><h3>Bring your people.</h3><p>One team, or a little friendly rivalry. Everyone’s invited.</p></div>
      <div className="invitation-step"><span className="invitation-icon"><Sparkles size={22}/></span><span className="eyebrow">02 / PLAY</span><h3>Mix things up.</h3><p>Pick your games. Set the lineup. Let the good times happen.</p></div>
      <div className="invitation-step"><span className="invitation-icon"><Trophy size={22}/></span><span className="eyebrow">03 / CELEBRATE</span><h3>Make it memorable.</h3><p>Big wins. Bigger laughs. Stories for Monday morning.</p></div>
    </section>
  </main>;
}
