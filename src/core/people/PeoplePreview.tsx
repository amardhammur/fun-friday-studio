import { CropPreview, StoredImage } from '../../components/Images';
import { orderedSets, peopleInSet } from './photo-sets';
import type { LibraryEvent } from './editor/context';

type Props = {
  event: LibraryEvent;
  selectedOnly?: boolean;
  onRename?: (setId: string, name: string) => void;
};

export function PeoplePreview({ event, selectedOnly = false, onRename }: Props) {
  return <div className="people-preview">{orderedSets(event).map(set => {
    const allPeople = peopleInSet(event, set.id);
    const people = selectedOnly ? allPeople.filter(person => person.included) : allPeople;
    if (selectedOnly && !people.length) return null;
    const needsPhotos = set.kind === 'group' && (!set.nowImageId || !set.thenImageId);
    return <section className="people-preview-group" key={set.id} aria-label={set.name}>
      <header>
        {onRename && set.kind === 'group' ? <label className="preview-group-name"><span className="eyebrow">GROUP NAME</span><input key={set.name} aria-label={`Group name for ${set.name}`} defaultValue={set.name} maxLength={80} onBlur={e => {
          const name = e.target.value.trim();
          if (name && name !== set.name) onRename(set.id, name);
          else e.target.value = set.name;
        }}/></label> : <h3>{set.name}</h3>}
        <p className={needsPhotos ? 'warning-text' : 'muted'}>{needsPhotos ? 'Incomplete · Add photos' : `${allPeople.filter(person => person.included).length} of ${allPeople.length} playing`}</p>
      </header>
      <div className="people-preview-grid">{people.map(person => {
        const face = event.facePairs.find(pair => pair.id === person.facePairId)?.now;
        const name = person.name.trim() || 'Unnamed person';
        return <figure className={`people-preview-person${person.included ? '' : ' excluded'}`} key={person.id}>
          <div className="people-preview-photo">{face?.cropImageId ? <StoredImage id={face.cropImageId} alt={`${name} now`}/> : <CropPreview face={face} assets={event.assets} previews={set.previews} label={`${name} now`}/>}</div>
          <figcaption><strong>{name}</strong>{!selectedOnly && <span>{person.included ? 'In the game' : 'Sitting this one out'}</span>}</figcaption>
        </figure>;
      })}</div>
      {!people.length && <p className="muted">No people yet. Resume setup in the People library.</p>}
    </section>;
  })}</div>;
}
