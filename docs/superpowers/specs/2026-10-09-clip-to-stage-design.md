# Clip to Stage

Add an activity in which all teams watch the same song or performance clip, practise together, then perform once each. The host records the offline judge panel's final points per team. The host selects singing, dance, or both; both is the default while the optional preference question is pending.

The host configures a clip title, a YouTube URL or uploaded MP4/WebM, practice minutes (default 10), and performance seconds (default 180). YouTube watch, Shorts, and shortened links can play in an embedded player after a host action; YouTube clip links open on YouTube. All YouTube playback needs internet. Local clips are saved in IndexedDB, work offline, survive reloads, and are included in session ZIPs. Validate local playback and limit uploads to 100 MB.

Flow: watch → practise → perform each event team in order → judge score entry → results. Start timers only on host actions; expiry never advances a phase. Practice and performance timers support Pause/Resume. The reference clip remains available during practice. There are 2–8 named event teams. Scores are nonnegative whole points, including zero, entered as actual totals without a multiplier. Require all scores before saving, upsert one award per team, preserve unrelated scores and manual adjustments, and support corrections from results. Pausing results must reopen results.

Use the existing Activity registry, event ledger, timer controls, blob store, and session archive. Add an optional activity settings-remapping hook so uploaded media references in settings remain valid after ZIP import. Broaden session archive MIME support only to MP4/WebM in addition to its current image support. Keep all existing activities and uncommitted changes.

Validation covers source URLs, source assets, team order, phase invariants, timers, score totals, and ledger consistency. Browser checks cover actual local video playback offline, refresh, ZIP transfer, all phases, scoring corrections, pause/resume, mobile and projector layouts. No dependency or backend is added. An activity demo is optional and is outside this change.
