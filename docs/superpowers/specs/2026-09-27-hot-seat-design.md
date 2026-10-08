# The Hot Seat: activity design

*A talk-show rapid-fire game for Fun Friday Studio. It's inspired by celebrity chat-show rapid-fire rounds, but the name, look and questions are all original, with no show branding.*

## 1. The idea in one line

Colleagues answer rapid-fire questions **anonymously before the event**. On stage, the room tries to work out **who** gave those answers from clues revealed one at a time. Then the mystery guest takes **the Hot Seat** for a live 45-second rapid-fire round in front of everyone.

## 2. Why it works

| Curiosity driver | How the game uses it |
| --- | --- |
| "Wait, *who* said that?" | Answers appear before the name. Every clue narrows it down, and the room argues out loud. |
| The reveal | The guest's current photo flips in, reusing their people-library photo when they have one. |
| Seeing a colleague put on the spot | The live rapid fire uses short questions, a visible timer and no time to think. |
| Friendly heckling | Other teams can **gong** a dodgy answer ("Too diplomatic!"). |
| Everyone has a stake | Teams score by guessing, and the guest's own team scores from the guest's performance. |

## 3. Format (about 3 minutes per guest, about 12–15 minutes for 4 teams)

Each team puts **one guest** in the Hot Seat. Guests are chosen from team members when they exist (see the team builder spec), or typed in by the host.

### Beat 1: Mystery Guest (about 90 seconds, other teams score)
1. The stage shows **"TONIGHT'S MYSTERY GUEST"** and a blank silhouette.
2. The host reveals the guest's rapid-fire answers **one clue at a time** (`Space`). For example:
   - *Tea or coffee?* **Cutting chai, always.**
   - *Mountains or beaches?* **Mountains.**
   - *One app you'd delete from everyone's phone?* **Teams notifications.**
   - *Your hidden talent?* **Can recite every IPL winner since 2008.**
3. **Any team, including the guest's own**, can shout a guess at any time. Nothing on screen shows which team the guest belongs to, because that would be a giveaway. The host marks each guess:
   - **Correct** (`1`–`8` picks the team): points depend on how many clues had been shown:

     | Clues shown | Points |
     | --- | --- |
     | 1–2 | 5 |
     | 3–4 | 3 |
     | 5 or more | 1 |

   - **Wrong** (`X`): that team is locked out for this guest. The other teams can still guess.
   - If nobody gets it after all the clues, nobody scores. The mystery wins.
   - **Why the guest's own team may guess:** greying them out would reveal the guest's team to the room. Every team has one guest, so it's fair. The Green Room is private, so teammates don't know the answers; they only know the person, which is the point of the game.
   - **Guest order** is shuffled, and the stage never shows the guest's team until the reveal.
4. **Reveal** (`R`): the name and photo flip in, with a "LOOK WHO'S ON THE COUCH" stamp.

### Beat 2: Live Rapid Fire (45 seconds, the guest's team scores)
1. The guest comes to the front. A **45s** timer runs, and one short question at a time appears in huge type.
2. The guest answers out loud, instantly. The host keys each answer:
   - `Space`: answered. **+1 point**.
   - `P`: pass. **0 points**. Each guest gets one free pass; any further passes cost 1 point.
   - `G`: **gong**. The room decides the answer was too diplomatic or dodgy. **0 points**, and a "TOO DIPLOMATIC" stamp slams onto the screen.
3. The round ends when the time runs out or the questions run out. Points are capped at **10**.

### Optional finale beat: Answer of the Night (60 seconds)
After all guests, the stage shows the best live answers the host starred (`S` during Beat 2). The room votes by applause, and the host picks one. That guest's team gets a **+3 bonus**. It's off by default and can be switched on in setup.

## 4. Setup (host desk)

**Step 1: Guests.** Pick one guest per team, either from team members or by typing a name. The app warns if a guest has no answers yet.

**Step 2: The Green Room** (collecting mystery answers, fully offline):
- **Option A, on this laptop:** a private full-screen form. The guest answers 6–8 questions from the bank, and the screen says "Only the host's laptop, and nobody's watching". A "Hide answers" toggle stops the host shoulder-surfing while setting up.
- **Option B, CSV import:** export questions as a CSV template, collect answers through any form tool, then import. Headers map by name, the same approach as the N02 fix.

**Step 3: Questions.**
- The clue questions (Beat 1) and the live questions (Beat 2) come from **separate banks**, so a live question never repeats a clue.
- The bank has categories the host can switch on or off: *This or That*, *Office Life*, *Food*, *Superpowers & Hypotheticals*, *Pop Culture*, *Fill the Blank*. The host can add and edit custom questions.
- **Guardrails built into the default bank:** no questions about relationships, salary, politics, religion, health, looks or age. A banner in setup reminds the host that the Hot Seat is **opt-in** and any guest can pass.

**Step 4: Game setup.** Set the live timer (30, 45 or 60 seconds), switch the Answer of the Night on or off, and use the shared event teams.

## 5. Stage screens (show mode, host rail)

| Screen | What the room sees | Host rail |
| --- | --- | --- |
| Mystery card | Silhouette, the clues stacking up as big cards, the current points value ("Worth 5"), and teams that guessed wrong greyed out (the guest's team is never marked) | `SPACE` next clue · `1–8` correct · `X` wrong · `R` reveal |
| Reveal | Name, photo polaroid, stamp, and who scored | `ENTER` to the Hot Seat |
| Live rapid fire | Giant question, countdown ring, running total "7 answers", the GONG and TOO DIPLOMATIC stamps | `SPACE` answered · `P` pass · `G` gong · `S` star · `U` undo |
| Guest wrap | "That's a wrap on the couch" and the guest's points | `ENTER` next guest |
| Answer of the Night (optional) | The starred answers, then a winner stamp | `1–8` pick |

It follows the Ink & Paper design language: slabs, polaroids, Caveat asides and mono labels. It must also work in After Hours and Game Show.

## 6. How it fits the app

- **It's a new activity folder, `activities/hot-seat/`,** following the existing plugin contract. Registration is discovered automatically.
- **It reuses what already exists:**
  - the event teams and the players roster, from the team-builder spec
  - library photos for the reveal (`personId`, then the current crop)
  - the timer (`src/core/play/timer.ts`), with pause and resume through `onPause`/`onResume`
  - the scoring ledger with segment-scoped deterministic IDs
  - the points multiplier
  - show mode and the host rail
- **Needs one new scoring helper.** Beat 1 needs team-qualified awards, because multiple teams can be locked out or correct per guest. The architecture review already flagged this: `setRoundAward` has one ID per round, so use a `hs-${guestId}-${teamId}` ID.
- **Privacy.** Green-room answers stay in the event document and the session ZIP only. There's no network, the same as everywhere else.
- **Demo.** Four fictional guests with ready-made answers, so the host can try it without any colleagues.

## 7. Edge cases

- A guest has no answers yet: skip Beat 1 for them, or run Beat 2 only.
- Two teams shout at once: the host decides. The app only records who the host credits.
- Undo: `U` reverts the last answer, gong, correct or wrong. The ledger IDs must stay deterministic.
- A reload mid-live-round keeps the deadline, answers and gongs (the F02-style timer guarantees).
- Pausing mid-round holds the clock (`holdClock`).
- Nothing on stage may reveal the guest's team before the reveal: no greyed-out team, no team colour on the silhouette, and no team-ordered guest sequence.

## 8. Out of scope for v1

- Audience phones or voting apps.
- Audio. Gong and stamp sounds are nice-to-have follow-ups (local files only).
- Multiple guests per team per game.
