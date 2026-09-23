# Multi-Group People Library Design

## Goal

Let one people library hold more than one group photo. A host can keep one full group, add further groups where only some people play, and add individual people who have no group photo at all. Every player joins the same game, and the whole team reveal shows each group photo that has at least one player.

## Decisions

- Photos vary by group: a group arrives as a then/now group photo pair, or a person arrives with two single photos.
- Photo sets live in the event-level people library, not in the Childhood vs Now game state.
- Who plays is the existing per-person `included` switch, with per-set bulk shortcuts.
- New people can be added in the app (add a group, add a person) and by merging an exported pairs ZIP.
- The reveal shows one slide per group set with at least one player, then one slide for single-photo players.

## Data model

### Photo sets

`EventSession` gains `photoSets: PhotoSet[]`, beside `people` and `facePairs`.

```ts
interface PhotoSet {
  id: ID;
  name: string;              // 1–80 characters, e.g. "Engineering 2019" or "Priya"
  kind: 'group' | 'single';
  nowImageId?: ID;           // group photo today, or the person's current photo
  thenImageId?: ID;          // childhood group photo (aligned to now), or the childhood photo
  previews: Record<ID, ID>;  // source image id → downscaled preview id
  order: number;             // library and reveal order, unique, 0-based and contiguous
}
```

`FacePair` gains `setId: ID`. Each face's `sourceImageId` must equal its set's `nowImageId` (now side) or `thenImageId` (then side).

- A **group** set holds any number of face pairs, produced by face detection and manual matching.
- A **single** set holds exactly one face pair. Each side's face box starts as the largest detected face in that photo, or the whole image when none is detected, and can be adjusted with the existing crop controls.
- Limits: 500 people, 1000 face pairs, 20 photo sets.

`Person` is unchanged; `included` keeps meaning "plays in the game".

### Childhood vs Now game state

`originalImageId`, `childhoodImageId`, `childhoodUploadId` and `previews` are removed from the game state. The activity reads photos from `event.photoSets`.

The finale state becomes `{ wipePosition, slideIndex, spotlightPersonId? }`. `slideIndex` counts reveal slides (see Reveal); changing slides resets `wipePosition` to 0 and clears `spotlightPersonId`.

The activity's `preparePeople` hook no longer copies group photo ids into the game.

### Session format 3 and migration

`formatVersion` moves from 2 to 3. `validateEvent` accepts version 2 and migrates it before validation; the migration is pure data and never touches image storage.

For a version 2 event:

1. If any segment of Childhood vs Now has `originalImageId` and `childhoodImageId`, create one group set named "Group 1" with `nowImageId = originalImageId`, `thenImageId = childhoodImageId`, and that segment's `previews` filtered to those two images. The first such segment wins.
2. Set every face pair's `setId` to that set. Face pairs whose source images belong to neither photo are dropped with their people (a version 2 event cannot contain them, so this only guards corrupt data).
3. If no segment has photos but face pairs exist, derive the set from the first complete face pair's source images, as `preparePeople` does today.
4. Remove the four photo fields from every Childhood vs Now game state and add `slideIndex: 0` to its finale.
5. An asset referenced only by the old `childhoodUploadId` stays in `assets`, unreferenced. It is not exported in pairs ZIPs.

Session ZIP import runs the same migration, so older session ZIPs keep working.

### Validation

In addition to today's checks, `validateEvent` rejects a session when:

- a set references a missing image or preview;
- set ids or set orders are duplicated;
- a face pair's `setId` is unknown, or its face uses an image that is not its set's photo for that side;
- a single set does not have exactly one face pair;
- the limits above are exceeded.

## People library

### Moved code

The upload, face matching and naming screens become People library screens that work on one set at a time. `pairing.ts` and the cropping, photo-storing and childhood-alignment helpers in `preparation.ts` move from `activities/childhood-vs-now/logic/` to `src/core/people/`. `UploadStep`, `MatchPeopleStep` and `NamePeopleStep` become core components taking a `setId`. The demo loader stays in the activity and calls the core helpers.

### Layout

```text
Your people library.                      [Import pairs ▾] [Export pairs]
33 people · 21 in the game                [+ Add a group] [+ Add a person]

▾ Group 1 · Engineering 2019   20 people · 20 playing
    [Everyone in] [Everyone out] [Edit photos & matches] [Rename] [↑] [↓] [Remove]
    (person cards)
▾ Group 2 · Design offsite     13 people · 1 playing
    …
▾ Single photos                 2 people · 2 playing
    (person cards, each with [Replace photos] [Remove])
```

- Sets are listed in `order`; single sets are gathered under one "Single photos" heading, in their own order.
- Person cards keep the name field, fun fact and In the game switch.
- **Everyone in / Everyone out** set `included` for every person in the set whose face pair is complete.

### Add a group

1. Name the group (required).
2. Upload the then and now photos with the existing upload screen. The childhood photo is aligned to the now photo's size as today.
3. Match faces with the existing matching screen, scoped to this set's face pairs. Detection and pairing never compare faces across sets.
4. Name people with the existing naming table, scoped to this set, including CSV import.
5. New people start with `included = false`, except when this is the first set in an empty library, where they start `true` as today.

Pair numbers continue from the highest existing number in the library.

### Add a person

A dialog with name (required), childhood photo, current photo and optional fun fact. On save it creates a single set named after the person, stores both photos and previews, suggests both face crops, and creates the face pair and person with `included = true`. The crop can be adjusted afterwards from the person's card.

### Edit and remove

- **Edit photos & matches** reopens the upload and matching screens for that set. Replacing one of its photos clears only that set's face pairs and people, after confirmation.
- **Rename** edits the set name.
- **Remove** deletes the set, its face pairs and people, and deletes its images from storage (best effort), after confirmation.
- **Replace photos** on a single person replaces both photos and re-suggests the crops.

Library edits follow the existing roster lock: once an activity in the event has started, the only allowed change is a full Replace library import.

### Childhood vs Now setup

The setup steps become:

1. **People** — shows players ready (included, complete pair, named) and flags missing names. **Open People library** goes to the library. When the library is empty, this step shows the Add a group flow inline, so first-time setup still runs upload → match → names in place. Validation: at least one included person, and every included person has a name.
2. **Game setup** — unchanged.

Saved segments whose `setupStepId` is `upload`, `match` or `names` are mapped to `people` on load.

### Demo

The demo creates one group set named "Demo team". Everything else about the demo is unchanged.

## Import and export

### Bundle format, version 2

```text
face-pairs.json
sets/01/now
sets/01/then
sets/01/now-preview      (when a preview exists)
sets/01/then-preview     (when a preview exists)
sets/02/now
sets/02/then
pairs/001-now.jpg
pairs/001-then.jpg
...
```

```json
{
  "version": 2,
  "sets": [
    { "key": "01", "name": "Engineering 2019", "kind": "group",
      "now": { "path": "sets/01/now", "name": "…", "width": 4032, "height": 3024, "mime": "image/jpeg" },
      "then": { "path": "sets/01/then", "name": "…", "width": 4032, "height": 3024, "mime": "image/jpeg" },
      "nowPreview": { … }, "thenPreview": { … } }
  ],
  "pairs": [
    { "number": 1, "set": "01", "color": "#…", "name": "Asha", "funFact": "…", "included": true,
      "now": { "cropPath": "pairs/001-now.jpg", "faceBox": { … }, "padding": { … } },
      "then": { "cropPath": "pairs/001-then.jpg", "faceBox": { … }, "padding": { … } } }
  ]
}
```

- Set keys are two-digit, 1-based, in set order. Set paths are fixed from the key; pair crop paths are fixed from the pair number, as in version 1.
- Every pair's `set` must name a set in the manifest; a single set must have exactly one pair; every set must have at least one pair.
- Validation is as strict as version 1: safe paths, no missing or extra files, JPEG crops, group image dimensions matching the manifest.

**Export pairs** writes every set and every person with a complete face pair. The "same two group photos" restriction is removed.

**Version 1 bundles** still import. They become one group set named after the ZIP file name without its extension, trimmed to 80 characters.

### Import pairs

**Import pairs** opens a menu with two choices.

**Add to library**
- Available only when the roster is not locked.
- Every imported set is appended after the existing sets, in manifest order.
- Pairs are renumbered to continue from the highest existing number; imported colors are kept.
- Scores, rounds and progress are not reset. `isDemo` becomes false; when the current library is the demo, the menu shows "Your demo people will stay — choose Replace library to remove them." under Add to library.
- Capacity (500 people, 1000 face pairs, 20 sets) is checked on the combined totals before anything is stored.

**Replace library**
- Today's behaviour: confirmation, then replaces sets, people, face pairs and their assets, and resets progress, scores and wager bets for the whole event.

### Duplicate names

Before storing anything, Add to library compares imported names with existing names (trimmed, case-insensitive). If any match, a dialog lists them ("Asha, Leo and 3 more are already in your library") with **Add anyway**, **Skip duplicates** and **Cancel**. Skip duplicates leaves those pairs out; a set left with no pairs is not added. Images are not compared.

### Failure safety

As today: images are stored first, and if any step fails, every image stored by this import is deleted and the session is not changed.

## Reveal

The whole team reveal is a sequence of slides built from the library:

1. One slide per **group** set with at least one included person who appears in a round of this game, in set order.
2. If any single-set person is in this game's rounds, one final **Also in the game** slide.

```text
[← Results]   ONE LAST THROWBACK · Engineering 2019 (1 of 3)   [‹] [›]
        [ then ⟷ now wipe of this group ]
  IN THE SPOTLIGHT: [Everyone] [Asha] [Leo] …
```

- A group slide shows that set's then and now photos with the existing wipe control.
- Spotlight buttons list only this slide's players; the spotlight box uses that pair's face box on this set's photos.
- Non-players stay visible in the photo and get no button.
- The Also in the game slide shows a grid of then → now cards (crop images, name) for each single-set player. It has no wipe.
- ‹ and › buttons, and the ← and → keys while the reveal is open, move between slides. With one slide, the counter and arrows are hidden, so a single-group game looks as it does today.
- A slide whose photo is missing from storage shows the existing missing-image message in place of the photo; other slides still work.

Rounds during play are unchanged: each round shows one player's then and now crops, whatever set they came from.

## Error handling

- Validation failures on load show the existing "saved session could not be restored" warning.
- Import errors are reported through the existing task notifications, naming the failing file or rule.
- Migration is pure data and runs inside validation, so it either succeeds completely or the session is not loaded.

## Testing

Unit tests:

- version 2 → 3 migration: photos from the first Childhood vs Now segment, face pairs assigned, game fields removed, finale `slideIndex` added, derivation from face pairs when no segment has photos;
- validation of set references, per-side source images, single-set pair count, and limits;
- version 2 bundle manifest parsing and rejection cases; version 1 bundles mapping to one named set;
- Add to library: set ordering, renumbering, combined capacity checks, duplicate detection and Skip duplicates dropping empty sets;
- reveal slide building: sets with no players skipped, Also in the game slide, per-slide spotlight lists.

Browser tests:

- demo → Add to library with a version 1 pairs ZIP → Everyone out on the new group, switch on two people → play → the reveal steps through both group slides and spotlights only the two players on the second slide;
- Add a person with two single photos → the Also in the game slide shows them;
- Replace library still confirms and resets progress;
- a version 2 session in local storage loads after migration with its people and reveal intact.

Existing unit and browser tests that read `game.originalImageId`, `game.childhoodImageId` or `game.previews` are updated to read the photo set.

## Out of scope

- The two-tab overwrite bug (a stale tab saving over newer data). Tracked separately; recommended before this work.
- Choosing players per activity instead of per library.
- Detecting duplicate people by comparing images.
- Selective export of some sets.
