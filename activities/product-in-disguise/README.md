# Commercial Clash

Teams perform funny advertisements for the same everyday product. The audience votes for the performances, then the host reveals three awards. For 15–30 people, use five teams of 3–6; default timings take about 37 minutes. Real games support 3–8 teams.

## Host flow

1. Add **Commercial Clash** to the lineup. Choose preparation time and ad duration in **Game setup**. Teams come from event planning. Press **Start activity** to bring up the audience wheel.
2. **Spin the wheel** draws one of 12 everyday products with equal chances and reveals it after a four-second spin. Every team uses that product. If the audience dislikes it, **Spin again** draws a different product. Keep spinning until everyone is happy; starting preparation locks the choice. Reduced-motion settings use a brief draw instead.
3. **Start preparation** begins the shared timer when the host is ready. Everyone makes a skit with a problem, an exaggerated demonstration and a tagline. Writing, directing, acting and sound effects all count as participation. The product is public; teams may name or show it and choose any format.
4. **Start first ad** begins the first team's performance. **Next team** finishes that ad and starts the next timer. Every team performs once, in event team order.
5. **Start voting** shows the three awards: **Funniest ad**, **Most creative idea**, **Best sales pitch**. Teams can briefly discuss their choices. Teams can prepare their skits in breakout rooms and perform on the main call for hybrid sessions.
6. Press **Record votes**, ask the displayed team for its three choices aloud, and enter them directly on screen. Repeat for each team. **Previous ballot** permits corrections; incomplete ballots cannot advance. A team's own name is omitted from its choices.
7. **Lock votes** requires every ballot to be complete. **Reveal winner** reveals the first award using the shared reveal treatment. **Next award** repeats for the next category; **See results** shows the final activity scores and winning team.

Audience screens use short prompts and large text. The host calls each team and records its votes publicly, so paper ballots and private messages are unnecessary. There are no secret briefs, guessing phases or clue checklists in the new game. The app uses one shared host screen, with no remote player clients.

## Points and corrections

- Every vote awards the chosen team the event's correct-answer points, normally **+2**, including the activity multiplier.
- Every team casts one vote per award. Self-votes are disallowed; the same team may receive all three choices on a ballot.
- Every recipient scores its votes, including teams that do not win an award. Ties share the category award and the overall win.
- Points enter the event ledger only when that category is revealed. The ledger uses a fixed ID for each voter/category, so repeated reveals and reloads never duplicate awards.
- **Edit votes** reopens the saved ballots and clears this activity's vote awards. Host adjustments and other activity scores remain. Correct the choices, lock again and reveal all awards to restore the corrected scores. This is also available on the activity results screen before moving to overall standings.
- **Start over** clears this activity's progress and scores through the app's normal flow.

## Timers, keys and saves

Defaults are 12 minutes of preparation, three minutes per ad and three minutes of voting, plus briefing, vote entry and reveals. Timers never advance automatically. App Pause freezes an active timer; Resume retains its remaining time. A manually stopped timer stays stopped.

**S** spins the wheel, **N** advances the current phase, **R** reveals the current award, **T** pauses or resumes the timer. Shortcuts are ignored while typing or using a dialog. Buttons mirror the shortcuts.

The draw is saved as soon as the spin starts. Reloading resumes the same spin or reveals its product; extra input during the animation is ignored. The host can request another draw from the product reveal screen. Preparation starts only when the host presses its button. The selected product, performance order, ballots, timers and reveal progress are saved locally and included in session ZIPs. Illustrations and product content are local; no network calls are needed. The three-team demo stays separate from the personal event.

The activity keeps its storage ID `product-in-disguise` and is now version 3. Started version-two games keep their chosen product, timer and progress. Version-one games already started retain their original guessing flow, progress, points and keyboard controls. Unstarted setups and **Start over** use the live product wheel. The earlier implementation lives in the sibling files and `legacy.ts`; the new flow lives in `performance/`.
