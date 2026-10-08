# Real or Ridiculous?

Two documented inventions and one fictional pitch. Every team investigates, commits to a first vote, sees one extra clue, then sticks or switches before the reveal. Built for 10–40 people around one host laptop/projector; no props, phones or acting.

## Run a session

Open **Activities → Real or Ridiculous?**. Try the demo to play the Tiny Cleaner / Compliment Mug / Designer Stick example. The normal game randomises pairings and A/B/C positions. Choose 5, 6 or 8 rounds; six rounds with the default 60-second first discussion takes roughly 16–20 minutes. Allow around three minutes per round, including the reveal discussion; eight rounds can fill 25–30 minutes.

Use the existing event teams (2–8 teams, ideally 3–5 colleagues each). Keep the brief on screen before starting. Explain that “real” means documented, not necessarily commercially sold or proven successful.

1. **Investigate:** everyone considers the pitches, discusses in pairs, then shares with the team. Rotate the discussion starter each round. Anyone may pass, and all participation can be seated.
2. **First vote:** host counts 3, 2, 1. Teams simultaneously signal 1/2/3 fingers for A/B/C, or say their choice. No individual player devices or answer entry are required.
3. **One more clue:** the host reveals one pitch’s extra detail. Teams have 15 seconds to reconsider. Fictional pitches have authored fictional clues too; a clue is not proof.
4. **Final vote:** another simultaneous vote. Collect every team's final choice before revealing. There is no penalty for switching.
5. **Truth:** our fictional pitch is identified. Short evidence summaries establish the two real inventions; labels distinguish Product, Prototype, Patented design and Announced concept. Use the room discussion question before moving on.
6. **Score:** select each team whose final vote was correct. The award uses the event’s configured correct-answer points, including its activity multiplier. Select again to undo. Wrong votes cost nothing and there is no speed bonus.

The host enters scores, not individual votes. Votes are social and simultaneous rather than privately recorded. The common scoreboard also supports manual +/− corrections. The recap contains fuller explanations and sources for all real inventions in that session.

## Host keys

| Key | Action |
| --- | --- |
| N | Start, call first/final vote, next round, or finish |
| H | Show the extra clue after the first vote |
| R | Reveal after the final vote |
| T | Pause/resume a discussion timer |
| 1–8 | Toggle the current round’s award for that team, after the reveal |

Buttons mirror every action. Shortcuts are ignored while typing or while a dialog is open. Repeated reveal/advance keys cannot bypass required phases. Timer expiry prompts the host to call a vote; it never reveals or advances automatically. App Pause freezes a running discussion; Resume preserves the remaining time. Refresh restores the saved phase, clock, shuffled cards and scores.

## Content and evidence

**inventions.json** contains 24 starter pitches: 16 real and eight fictional. An eight-round session uses every pitch once. Shorter sessions draw a subset without replacement. A new session may revisit inventions; add content for longer-term replayability.

Every card needs a unique `id`, `kind` (`real` or `fiction`), `title`, `pitch`, `clue` and `explanation`. Real cards also need:

- `summary`: a concise reveal sentence, ideally under 25 words.
- `status`: `Product`, `Prototype`, `Patented design` or `Announced concept`.
- `source`: an object with a readable `label` and an HTTPS `url` supporting the claim.

Fictional cards instead need `wonder`, a short room-wide discussion question used after the reveal. Fiction is labelled as writing for this game, not a claim that nobody anywhere has had a similar idea.

Add objects to this JSON file and rebuild/redeploy; no component changes are needed. The bank needs at least two real cards per fictional card to use them all. Keep pitches and clues concise, avoid brand names before the reveal, and make invented pitches comparably plausible. New topics should span daily life, work, travel and food rather than depend on specialist knowledge or personal disclosures.

Real entries were checked against manufacturer announcements, research institutions, original patents and Guinness documentation on 2026-09-30. Summaries are paraphrased. The sources establish the stated historical product, prototype or design; they do not assert current availability. Nissin’s Otohiko is deliberately labelled an announced concept: its release made sales conditional on a preorder threshold.

Cards and source URLs are bundled locally. Playing needs no external network requests; opening a source website requires internet access. Saved games include snapshots of their cards, so later bank changes do not alter an ongoing round.

## Existing saves

This activity replaces the Wait, Why? card in the library and new lineups. The legacy activity remains registered to restore old saved events and ZIP exports; its scores and progress are not converted or deleted. An `archived` activity is omitted from discovery lists but still accessible by its saved ID.

## Validation

Unit tests cover unique dealing, one-fiction-per-round, phase guards, independent/undoable team scoring, clock persistence, restart isolation, invalid saves and evidence URL validation. Browser tests cover all themes, demo content, no early answer leakage, host keys, pause/reload, scoring, full completion, projector layouts and legacy-save restoration.
