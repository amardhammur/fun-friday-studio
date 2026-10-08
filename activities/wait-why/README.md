# Wait, Why?

A host-operated, simultaneous team reasoning activity for 10–40 colleagues, using one laptop and projector. No phones, acting, personal disclosures or specialist trivia.

## Concepts considered

| Name and hook | Round | Curiosity | Replayability |
| --- | --- | --- | --- |
| **Wait, Why?** — Predict together, uncover the explanation. | Quiet thinking, team discussion, simultaneous A/B/C choices, reveal and score. | First instincts meet an explanation everyone can reason through. | Shuffled puzzles, rotating discussion starters and expandable content. |
| **Order of Magnitude** — Get close without knowing the answer. | Teams estimate an everyday quantity, announce estimates, then compare with an explained range. | Familiar things reveal unfamiliar scales. | Fresh estimates and question packs. |
| **Clue Cascade** — Discover a principle one clue at a time. | Reveal clues progressively; teams lock in answers, trading confidence against points. | Clues connect into a surprising whole. | New mysteries and clue sequences. |

**Recommendation:** Wait, Why? gives every team something to do every round, with all necessary information on screen. It balances the existing photo and acting games with discussion, reasoning and shared discovery, without requiring specialist knowledge.

## Hosting

Choose **Activities → Wait, Why? → Create event with this**, or add it to the event lineup. A separate demo is available. Aim for teams of 3–5; use the existing event team editor.

Choose 8, 10 or 12 rounds and 45, 60 or 90 seconds of thinking/discussion. Allow another 30–60 seconds per round for simultaneous choices, scoring and discussing the explanation. Eight rounds at 60 seconds is approximately 16–19 minutes; twelve at 90 seconds is approximately 30 minutes before extra discussion.

1. Give everyone ten quiet seconds before discussion.
2. Invite everyone to share an idea. Rotate who starts each round.
3. Count down and have all teams signal together: 1 finger for A, 2 for B, 3 for C. Spoken choices are equally welcome; everyone may stay seated.
4. Reveal only after all teams commit. Select each correct team to award the event’s configured correct-answer points. Select again to undo.
5. Read the explanation, explore the “wonder” question, then advance. Wrong answers never lose points; there is no speed bonus.

| Key | Action |
| --- | --- |
| N | Start first round / next round / results |
| R | Reveal the answer and stop the timer |
| T | Pause/resume discussion timer |
| 1–8 | Toggle this round’s award for the corresponding team |

The shared scoreboard also provides manual +/− corrections. Its totals carry across activities. The host controls timer expiry: zero prompts simultaneous voting, but never automatically reveals the answer. App Pause freezes the clock; Resume continues with the remaining time. A browser refresh preserves the deadline or paused time.

## Adding content

Edit **puzzles.json**: append an object with a unique `id`, `category`, `question`, exactly three `options`, zero-based `answer` (0=A, 1=B, 2=C), `explanation`, and `wonder`. No TypeScript or component changes are needed; rebuild/redeploy the app to distribute the updated bank.

Keep the question self-contained, state assumptions explicitly, and keep copy short enough for a projector. Prefer puzzles everyone can discuss over recalled facts. Explain the reasoning and include an open follow-up. Avoid personal judgments, identity-based questions and embarrassment. If someone knows a puzzle, invite them to let teammates reason first.

Each game snapshots its shuffled selection into saved state, so editing the bank will not change a game already in progress. Repeated games can repeat familiar puzzles; grow the bank for frequent sessions.
