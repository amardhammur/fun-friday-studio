import { Plus, X } from 'lucide-react';
import type { Team } from '../types';
import { teamColors } from '../session';
export function TeamEditor({ teams, onChange }: { teams: Team[]; onChange: (teams: Team[]) => void }) {
  return <div className="team-editor">{teams.map((team, i) => <div className="team-edit" key={team.id}>
    <span className="team-number" style={{ background: team.color }}>{i + 1}</span>
    <input aria-label={`Team ${i + 1} name`} maxLength={40} value={team.name} onChange={e => onChange(teams.map(t => t.id === team.id ? { ...t, name: e.target.value } : t))}/>
    <input type="color" aria-label={`Team ${i + 1} colour`} value={team.color} onChange={e => onChange(teams.map(t => t.id === team.id ? { ...t, color: e.target.value } : t))}/>
    <button className="icon-button" aria-label={`Remove team ${i + 1}`} disabled={teams.length === 1} onClick={() => onChange(teams.filter(t => t.id !== team.id))}><X size={18}/></button>
  </div>)}<button className="button subtle" disabled={teams.length >= 8} onClick={() => onChange([...teams, { id: crypto.randomUUID(), name: `Team ${teams.length + 1}`, color: teamColors[teams.length] }])}><Plus size={16}/> Add a team <span className="muted">{teams.length}/8</span></button></div>;
}
