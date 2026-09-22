# Import Face Pairs Design

## Goal

Allow a ZIP exported from the People library's **Export pairs** action to be imported back into the People library as reusable people, without confusing it with a full Fun Friday session export.

## Current format

The pair export is a flat ZIP containing JPEG files named:

```text
<person name> - then.jpg
<person name> - now.jpg
```

The export contains cropped faces only. It does not contain a session manifest, original group photos, face-detection boxes, or fun facts.

## User experience

- Add an **Import pairs** file control and button beside **Export pairs** in the People library.
- Accept a pair ZIP and show an import progress state through the existing task overlay.
- On success, add the imported people to the current session and remain on the People library.
- Existing people are never overwritten. Imported records always receive fresh IDs.
- Names come from the shared filename prefix. Fun facts start empty and imported people are included by default.
- Show a success notification with the number of imported people.
- Show a clear notification for invalid archives, missing `then`/`now` counterparts, unsupported files, unreadable images, or archives with no pairs.

The existing header **Import session ZIP** control remains dedicated to complete session exports. Pair ZIPs are imported only through the People library control.

## Import pipeline

1. Read and safely unzip the selected file using the existing archive worker limits and path validation.
2. Ignore directory entries. Treat every other file as a candidate and require a `.jpg`/`.jpeg` extension.
3. Parse the final ` - then` or ` - now` suffix case-insensitively, preserving the filename prefix as the person name.
4. Require exactly one `then` and one `now` image for every imported name. Reject the complete archive if any candidate is malformed, duplicated, or unmatched so the operation is atomic from the user's perspective.
5. Decode each image with the existing image inspection utility and store it as a local image asset.
6. Create a confirmed `FacePair` for each name. Each side uses its imported asset as both `sourceImageId` and `cropImageId`, with a full-image face box (`x: 0, y: 0, width: 1, height: 1`) and zero padding. This preserves the existing session schema while avoiding a second crop operation.
7. Create a `Person` for each pair and assign a rotating team color to the pair marker. IDs are generated at import time.
8. Merge the returned assets, face pairs, and people into the current session in one update.

## Validation and limits

- Keep the archive worker's existing 512 MB compressed / 800 MB expanded / 2,000-file safety limits.
- Require a `.zip` input at the UI boundary.
- Require at least one complete pair.
- Reject unsupported non-JPEG files and malformed names rather than silently importing partial data.
- Keep imported face crops available to the People library and future activities, but do not claim that the original group photos can be reconstructed.

## Testing

- Add pure unit coverage for filename parsing and pair validation, including case-insensitive suffixes, duplicate sides, missing sides, malformed names, and successful multi-person archives.
- Add browser coverage that exports pairs, imports the generated ZIP through the People library, and verifies the imported people appear with both portraits.
- Preserve the existing full-session export/import behavior and browser coverage.

## Out of scope

- Importing fun facts from pair exports.
- Reconstructing original group photos or face-detection geometry.
- Deduplicating against existing people by name or image content.
- Changing the full-session ZIP format.
