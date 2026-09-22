# Self-Contained Face Pair Bundle Design

## Goal

Make **Export pairs** produce a playable people bundle. Importing it must replace the automatically loaded demo data, restore both group photos and face-box geometry, and leave the session ready for game setup and final reveal.

## Bundle format

Each export is a ZIP containing:

```text
face-pairs.json
groups/now
groups/then
groups/now-preview        (when a preview exists)
groups/then-preview       (when a preview exists)
pairs/001-now.jpg
pairs/001-then.jpg
...
```

`face-pairs.json` is version 1 and contains:

- group source and preview paths plus asset names, dimensions, and MIME types;
- each person's display name, fun fact, included state, pair number, and color;
- each pair's crop paths, source-side face boxes, and padding.

The manifest owns the names and relationships. File names are fixed safe paths rather than user-entered names.

This is a pre-ship format. The importer does not accept the previous flat crop-only ZIP format; it reports that the export is missing the required bundle manifest.

## User experience

- Keep **Export pairs** and **Import pairs** in the People library.
- Export requires both the original and childhood group images to be present. If either is missing, show a clear error explaining that a playable bundle needs both group photos.
- Import validates the manifest and all referenced files before storing or changing the session.
- When the current session is the auto-generated demo, replace its demo people, crops, and group assets without confirmation.
- When the current session is not the demo, ask for confirmation before replacing its people, crops, group assets, and progress.
- Preserve the current session's team definitions; the bundle contains people and activity images, not team setup.
- After import, set `isDemo` false, clear rounds/scores, reset the finale state, set both group-image references, and open the setup phase at **Game setup**.
- Success reports the number of imported people. Invalid archives, missing group files, unreadable images, missing pair files, and storage failures produce clear errors.

The header **Import session ZIP** path remains the complete-session restore flow and is unchanged.

## Import pipeline

1. Unzip with the existing archive size and path-safety limits.
2. Require and parse `face-pairs.json` version 1. Reject session manifests, old crop-only archives, unknown files, missing references, duplicate references, and invalid manifest data.
3. Check the current session capacity before decoding or storing: the resulting session must remain within the existing people and face-pair schema limits.
4. Validate JPEG signatures and decode every crop; decode every group source and preview image before storing anything.
5. Store all images durably. If any store operation fails, remove every asset stored by this import and leave the session unchanged.
6. Remap manifest group paths and pair crop paths to fresh asset IDs.
7. Build confirmed face pairs whose source IDs reference the restored group assets and whose crop IDs reference the restored portrait assets. Preserve manifest face boxes and padding.
8. Build people with fresh IDs and manifest names/fun facts/included flags.
9. Return an import result containing assets, people, face pairs, group image IDs, and preview mappings. The UI performs one session update.

## Testing

- Unit-test manifest validation, fixed-path handling, missing/extra-file rejection, group metadata, face-box preservation, and capacity rejection.
- Browser-test export → import from the demo, verify demo replacement, imported group assets, named portraits, and setup state.
- Browser-test the restored group-image references through the final reveal path.
- Preserve the existing full-session import/export and all unrelated app tests.

## Out of scope

- Backward compatibility with the previous crop-only face-pair ZIP.
- Importing team definitions or scores.
- Deduplicating people across bundles.
- Changing the full-session ZIP format.
