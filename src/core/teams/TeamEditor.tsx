import { useEffect, useState } from 'react';
import { Minus, Pin, Plus, Shuffle, Users, X } from 'lucide-react';
import type { EventSession, Player, Team } from '../types';
import { libraryLocked } from '../people/event-library';
import { addPlayers, initializePlayers, movePlayer, parsePlayerNames, pinBalanceIssue, pullPlayers, removePlayer, ROSTER_LOCK_MESSAGE, setTeamCount, shuffleRoster, togglePin } from './roster';

type Props = { event: EventSession; onChange: (change: (draft: EventSession) => void) => void };
export function TeamEditor({ event, onChange }: Props) {
  const [names, setNames] = useState(''), [addTo, setAddTo] = useState('');
  const locked = libraryLocked(event), { teams, players } = event;
  useEffect(() => { if (!event.playersInitialized && !locked) onChange(initializePlayers); }, [event.playersInitialized, locked, onChange]);
  const assigned = new Set(teams.flatMap(t => t.memberIds));
  const unassigned = players.filter(p => !assigned.has(p.id));
  const balanceIssue = pinBalanceIssue(players, teams);
  const newNames = parsePlayerNames(names, players);
  const target = teams.some(t => t.id === addTo) ? addTo : locked ? teams[0]?.id : '';
  const resize = (count: number) => {
    const pinned = teams.slice(count).some(t => t.pinnedIds.length);
    if (pinned && !window.confirm('Remove this team and unpin its players? They will be listed under Not on a team.')) return;
    onChange(s => setTeamCount(s, count, pinned));
  };
  const member = (player: Player, team?: Team) => {
    const pinned = team?.pinnedIds.includes(player.id) ?? false;
    return <li className="member-chip" key={player.id}>
      <span className="member-name">{player.name}</span>
      {team && <button type="button" className="icon-button pin-button" aria-label={`${pinned ? 'Unpin' : 'Pin'} ${player.name}`} aria-pressed={pinned} title={pinned ? 'Stays on this team when shuffling' : 'Keep on this team when shuffling'} disabled={locked} onClick={() => onChange(s => togglePin(s, player.id))}><Pin size={16}/></button>}
      <select aria-label={`Move ${player.name}`} value={team?.id ?? ''} disabled={locked} onChange={e => onChange(s => movePlayer(s, player.id, e.target.value || undefined))}>
        <option value="">Not on a team</option>{teams.map(t => <option key={t.id} value={t.id}>{t.name || 'Unnamed team'}</option>)}
      </select>
    </li>;
  };
  return <div className="team-builder">
    {locked && <p className="muted library-locked">{ROSTER_LOCK_MESSAGE}</p>}
    <div className="roster-heading"><h3><Users size={18}/> Players</h3><span className="pill">{players.length} players</span></div>
    <button className="button secondary roster-pull" disabled={locked || !event.people.some(p => p.included)} onClick={() => onChange(pullPlayers)}>Pull from people library</button>
    <ul className="player-roster" aria-label="Event players">{players.map(player => <li key={player.id}>
      <span>{player.name}</span>{player.personId && <small className="library-badge">From library</small>}
      <button className="icon-button" aria-label={`Remove ${player.name}`} disabled={locked} onClick={() => onChange(s => removePlayer(s, player.id))}><X size={16}/></button>
    </li>)}</ul>
    {!players.length && <p className="muted">Pull in your library, or add people by name. Photos are optional.</p>}
    <form className="add-players" onSubmit={e => { e.preventDefault(); if (!newNames.length) return; onChange(s => addPlayers(s, names, target || undefined)); setNames(''); }}>
      <label htmlFor="player-names">Add player names</label>
      <textarea id="player-names" aria-label="Player names" aria-describedby="player-names-help" rows={2} placeholder="One name, or paste one name per line" value={names} onChange={e => setNames(e.target.value)}/>
      <small id="player-names-help" className="muted">One name per line. Blank lines and duplicate names are skipped.</small>
      <div className="add-player-actions"><label>Add to team<select aria-label="Add to team" value={target} onChange={e => setAddTo(e.target.value)}>{!locked && <option value="">Not on a team</option>}{teams.map(t => <option key={t.id} value={t.id}>{t.name || 'Unnamed team'}</option>)}</select></label><button type="submit" className="button secondary" disabled={!newNames.length}><Plus size={16}/> Add players</button></div>
      {names.trim() && !newNames.length && <p className="muted" role="status">Those names are already in the roster.</p>}
    </form>
    <div className="team-builder-controls"><div className="team-stepper"><button className="icon-button" aria-label="Fewer teams" disabled={locked || teams.length <= 2} onClick={() => resize(teams.length - 1)}><Minus size={18}/></button><span role="status" aria-label="Team count">{teams.length} teams</span><button className="icon-button" aria-label="More teams" disabled={locked || teams.length >= 8} onClick={() => resize(teams.length + 1)}><Plus size={18}/></button></div>
      <button className="button primary" disabled={locked || !players.length || !!balanceIssue} onClick={() => onChange(s => shuffleRoster(s))}><Shuffle size={18}/>{assigned.size ? 'Shuffle again' : 'Shuffle'}</button>
    </div>
    <p className="muted small">Pin a player to keep them on their team when you shuffle again.</p>
    {balanceIssue && <p className="warning-text" role="status">{balanceIssue}</p>}
    <div className="team-cards">{teams.map((team, i) => <section className="team-card" key={team.id} aria-label={`${team.name || `Team ${i + 1}`} members`}>
      <div className="team-card-heading"><input className="team-colour" type="color" aria-label={`Team ${i + 1} colour`} value={team.color} disabled={locked} onChange={e => onChange(s => { s.teams.find(t => t.id === team.id)!.color = e.target.value; })}/>
        <input aria-label={`Team ${i + 1} name`} maxLength={40} value={team.name} disabled={locked} onChange={e => onChange(s => { s.teams.find(t => t.id === team.id)!.name = e.target.value; })}/><span className="member-count" aria-label={`${team.memberIds.length} members`}>{team.memberIds.length}</span>
        {i === teams.length - 1 && <button className="icon-button" aria-label={`Remove team ${i + 1}`} disabled={locked || teams.length <= 2} onClick={() => resize(teams.length - 1)}><X size={16}/></button>}
      </div>
      <ul className="team-members">{team.memberIds.map(id => players.find(p => p.id === id)).filter((p): p is Player => !!p).map(p => member(p, team))}</ul>
      {!team.memberIds.length && <p className="team-empty muted">No players yet</p>}
    </section>)}</div>
    <section className="unassigned-tray" aria-label="Not on a team"><h3>Not on a team <span className="pill">{unassigned.length}</span></h3>{unassigned.length ? <ul className="team-members">{unassigned.map(p => member(p))}</ul> : <p className="muted">{players.length ? 'Everyone has a team.' : 'Players will appear here until assigned.'}</p>}</section>
  </div>;
}
