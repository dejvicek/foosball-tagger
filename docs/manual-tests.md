# Manual tests

Run against the deployed app (https://dejvicek.github.io/foosball-tagger/) unless noted.
Each section names the build step or requirement it covers.

## Step 1 · Auth and deploy

1. Open the app in a private window. You see the sign-in screen, nothing else.
2. Enter your email and press **Send sign-in link**. The screen says the link was sent and to open it in this browser.
3. Open the email link in the same browser. You land on the app root (not localhost, not a 404) signed in, with your email in the header, and the address bar has no `?code=`.
4. Reload. You stay signed in.
5. Open `#/does-not-exist`. You see "Page not found" with a link back.
6. Press **Sign out**. You are back on the sign-in screen; reload keeps you signed out.
7. Open an old, already used sign-in link. The sign-in screen shows that the link did not work.
8. Repeat 2–3 on `http://localhost:5173` with `npm run dev` and a local `.env`.
9. Toggle the OS dark mode. The app follows it.
10. Sign out, press **Sign in with GitHub**, approve on GitHub. You land on the app root signed in, no `?code=` in the address bar.
11. Repeat 10 on `http://localhost:5173/foosball-tagger/`.
12. Sign in with GitHub and with email (same address) on different days: the header shows the same email and, from step 2 on, the same data.

## Step 2 · Videos (VID-1..4)

1. **Add (VID-1):** paste a `youtu.be/…?t=30` link of a public or unlisted video → the video screen opens with the YouTube title and the player.
2. Paste the same video as a `watch?v=` link → the same video opens with "already in your list"; the list still has one row.
3. Paste `https://vimeo.com/1` and a channel link → a clear message, nothing added.
4. **Private video (VID-4):** set a test video to Private on YouTube, try to add it → refused with "Public or Unlisted … Allow embedding". Add it while unlisted, then switch it to Private and reload its video screen → the player shows the reason and the fix.
5. A live-stream archive (`/live/…`) and a Short both add and play.
6. **List (VID-2):** the list shows title, duration, recorded date ("No date" if blank), 0 matches, 0 games, 0 possessions, newest first.
7. **Edit (VID-3):** change title, recorded date, fps to 60, notes → Save → reload: the values persist; the list shows the new date and order.
8. **Delete (VID-3):** Delete video… → the dialog says what goes (nothing yet besides the video); Cancel and Esc close it; Delete returns to the list with "Deleted …".
9. **Isolation:** in Supabase → Table Editor, the rows have your `user_id`. (RLS is covered by automated tests in `supabase/tests/`.)
10. Offline: turn off Wi-Fi and add a video → "Could not reach YouTube…", nothing added; the list shows a load error with Try again.

## Step 3 · Player, keyboard and games (GAM-1..4)

Use a real practice video. Repeat 1–4 in Chrome, Firefox and Safari.

1. **Controls:** Play/Pause, −5/−1/+1/+5 s, ‹ Frame / Frame ›, speed select all work; the time counts smoothly. Clicking a control does not steal the keyboard (Space still plays/pauses right after).
2. **Keys:** Space, ←/→ (1 s), Shift+←/→ (5 s), `,` / `.` (about one frame; press `.` five times quickly: time moves about 5/fps), `[` / `]` (speed, with a short message). Nothing happens while typing in Opponent or Notes.
3. **Focus:** click on the video picture, then press Space or →: shortcuts still work. If a browser keeps focus in the video, the hint "Click outside the video to use shortcuts" appears.
4. **Seek before first play:** reload, click a game's start time before pressing Play: the video jumps there and stays paused.
5. **Frame rate:** set 60 fps under Details; frame steps get about half as big (both 30 and 60 fps).
6. **First game:** press B without choosing a side → message asks for the side. Choose Left, press B → Game 1 "open"; press E later → Game 1 has an end time.
7. **Next game (GAM-1/2):** with Game 1 open, press B → Game 1 ends and Game 2 starts at the same time, with the same side.
8. **Overlap (GAM-4):** seek inside Game 1 and press B → refused with an explanation. Seek before Game 2's start and use "End here" on Game 1 past Game 2's start → refused. Touching games (end of 1 = start of 2) are fine.
9. **Inline edits (GAM-2):** game rows edit side, scores and notes; the match header edits format, players, Best of and match notes. Reload → all kept. On the match header Doubles shows Teammate, Opponent 1 and Opponent 2; Singles hides them and clears them (ADR-0023, ADR-0040).
10. **GAM-3:** click a game's start time → the player seeks there; "Tag →" opens the tagging placeholder.
11. **Delete a game:** Delete… → confirmation; Esc cancels; confirm removes it.
12. **Matches:** see the "Matches (ADR-0040)" section below.
13. **Offline (SYN-2):** turn Wi-Fi off, press B and E, edit a name → header shows "Unsynced changes: n"; reload while still offline → the games are still there (games list may show a load error: Try again once online); turn Wi-Fi on → the counter disappears within a minute; reload → everything is on the server.
14. **Seek bar (ADR-0018):** on a long video, drag the bar → the video follows while dragging and lands where released; hovering shows the time; games appear as green marks. Right after using the bar, Space and B still work. Tab to the bar: Page Up/Down jump a minute, Home/End go to the ends.

## Step 4 · Tagging (TAG-1..8, SYN-1..4)

Open a game with "Tag →" on the video screen.

1. **Opens at the game (GAM-3):** the player jumps to the game start; the header shows match and game number, range, side, opponent.
   Also on a video uploaded the same day (still processing on YouTube): reload the tagging page a few times → it opens paused at the game start every time, never at 0:00 (ADR-0024).
2. **Keyboard-only possession (ADR-0026 keys):** Shot type shows Pin before anything is pressed (ADR-0027). R → timer runs and status says "Press F…"; A, W; F → timer freezes, status lists what is blank (hole, execution, result); 2, G, Z → "All tagged"; Enter → row appears in the log with the right length and hole Pull short; Setup is back on Middle and Shot type on Pin (TAG-2, TAG-3). R, F, Enter without touching Shot type → the row says Pin.
3. **R after F** saves and starts the next; **V** saves a No shot at once; **Backspace** or **Esc** clears; **⌘Z / Ctrl+Z** deletes the last saved (press twice: the one before); pressing a tag key twice clears it.
4. **Refusals:** F before the ball-set time (seek back) → message, nothing swapped (TAG-4). Seek outside the game, press R → message suggesting to adjust the game (TAG-5).
5. **Focus:** clicking any tag button, then Space/Enter still play/save. Clicking the video picture, then R still works. Nothing happens while a text field has focus; Esc leaves it.
6. **Timeline (TAG-6, ADR-0037):** goal, no goal, no result, no shot look different even in greyscale; hover shows tags; click a segment → 1 s before it, and it opens in the tag panel (ADR-0030); click empty strip → seek there.
7. **Log (TAG-7, ADR-0030):** read-only, no dropdowns; the row under the playhead is highlighted; × → "Delete?" → click again deletes, without opening the row.
8. **Help (TAG-8, ADR-0032):** "How to tag" sits right under the timeline, next to the tag panel (hidden in cinema mode); it opens the key table and definitions; it says frame stepping is approximate.
9. **Reload mid-draft:** press R, tag a field, reload → the running draft is still there.
10. **Offline (SYN):** Wi-Fi off, tag 5 possessions → "Unsynced changes: 5"; reload offline → the draft survives, the tagged rows are safe in the queue (the page may show a load error until online); Wi-Fi on → counter clears; reload → all 5 on the server, none twice.
11. **Speed:** tag a 10-minute game; it should take about 15 minutes (PRD §1.4). Note anything slowing you down.
12. **Unexpected refusals:** if R or F is ever refused when the time looks right, open the browser console (⌥⌘J) and copy the "Tag refused" line.

## Step 5 · Statistics (STA-1..10)

1. **Live game numbers:** on the tagging screen, tag a goal → conversion and the "By shot" row update at once, without reload.
2. **Blank is not a miss (STA-1):** tag a shot with no result → conversion's denominator does not grow; add the result → it does.
3. **Samples (STA-2, STA-3):** every percentage shows (n/d); all carry † until 30 attempts; the footnote explains it.
4. **Hand check:** for one game, count goals and shots-with-result in the log yourself → same as the conversion shown. Same for one "By shot" row.
5. **Scopes (STA-4):** Statistics → Date range "All time" includes every video; "Last 30 days" drops older ones; a video without a recorded date counts on the day it was added. Match scope equals the sum of its games. Video scope matches the sum of its games. Game scope matches the tagging screen.
6. **Filters:** tick Pin → only Pin shots count, "n of m … match the filters"; Format and Opponent narrow further; reload keeps scope and filters (they are in the URL).
7. **Candidates:** unreviewed or rejected possessions never count; confirming one in the log makes it count.
8. Phone width: the statistics page has no sideways scroll; wide tables scroll inside their card.

## Keyboard layout (ADR-0021, ADR-0026)

1. **Mouse + left hand:** tag a whole possession with the left hand on 1–5 / Q–R / A–G / Z–B, seeking with the mouse on the timeline; save with R (next possession) or Enter.
2. **Keyboard only, two hands:** K plays/pauses, J / L step 1 s (Shift 5 s), U / O step frames, Enter saves, Backspace clears the draft, while the left hand tags.
3. **Panel order:** Ball set / Shot / No shot, then Shot type (Q W E), Setup (A S D), Hole (1–5, pull long → push long), Execution (Z X), Result (G B). T and C do nothing.
4. **No undo:** the tag panel has no Undo button and ⌘Z / Ctrl+Z deletes nothing (ADR-0034); delete a possession from the log instead. Inside a text field ⌘Z still undoes typing.
5. **Help:** "How to tag" shows the keyboard map; the buttons show the same keys.
6. On the video screen, J / K / L / U / O work too; B / E still mark games.

## Five holes and derived direction (ADR-0026)

1. After `npx supabase db push`: possessions tagged Middle lane show hole Middle in the log; ones tagged Pull-side / Push-side lane show a blank hole. The log has no Direction column.
2. The five hole buttons fit on one row of the tag panel at full width and in cinema mode.
3. Statistics → By shot: a Pin from a pull-side setup into Pull long reads "Pin · Straight · Pull long"; from a middle setup "Pin · Pull · Pull long"; with no setup the direction is "–". By hole lists the five holes.

## Shot direction and movement (ADR-0028)

1. A new draft shows Shot direction Straight. C → Z, C again → Straight. Clicking the selected button blanks it; V saves a No shot with it blank.
2. Setup Pull side + hole Pull long → "Movement Straight" under Hole; hole Middle → "Movement Push"; no setup → "Movement –".
3. After `npx supabase db push`: old shots show Straight in the log's Shot direction column, No shot rows a blank.
4. Statistics → By shot direction lists Straight and Z with shots, conversion and proper; By shot rows read "type · movement · hole".

## Dragging and keyboard layouts (ADR-0022)

1. **Seek bar drag:** on the video screen, grab the round handle and drag: the handle follows the pointer, the video follows a few times a second, the time shows above the pointer; release lands exactly there. Dragging over the video or past either end still works.
2. **Timeline drag:** on the tagging screen, drag along the timeline strip: same behaviour, limited to the game. A plain click on a possession still jumps 1 s before it (and opens it for editing); a drag that starts on a possession does not.
3. **Czech/Slovak keyboard:** switch the OS keyboard to Czech (QWERTZ). The bottom-left letter key (labelled Y) selects Pin and the Shot type buttons show "Y"; the number row keys (+ ě š č ř) select setup, save and Proper.
4. In Chrome the labels are right from the start; in Firefox/Safari they correct themselves after the first press of a key if the browser language is not Czech/Slovak.

## Cinema mode and players (ADR-0023)

1. **Cinema (ADR-0025):** on the video screen click Cinema → only the player and the games panel are left (no app header, title, details or delete); the video gets as large as the window allows with seek bar and controls still visible. Open a game's tagging screen → still in cinema mode: player, timeline and tag panel only (no game numbers or possession log); keys work as before. A refused or pending change still shows in the top-right corner. Default view brings everything back; reload keeps the choice; the video list is never affected.
2. **Window sizes:** in cinema mode, narrow the window and make it short → no sideways scroll, the video shrinks to fit.
3. **Side:** a new video asks "Which side of the frame do you stand on?"; the game rows say "My side". Check existing games show the side you stand on.
4. **Doubles:** switch a match to Doubles, enter teammate and both opponents → the tagging header shows "with … · vs … & …"; the statistics Opponent filter lists both opponents and either one selects the match's games.

## Timeline colors, fouls, player width (ADR-0029)

1. **Colors:** superseded by ADR-0037 below.
2. **Foul:** tag a possession longer than 15 s (R, wait, F, G, Enter). While it runs, the timer turns red and reads FOUL after 15.0 s, and the running segment gets the orange foul ring (ADR-0037). Saved, the segment keeps its color and pattern inside the ring, the hover text says "foul, 17.3 s", and the log's Length cell reads "17.3 s · foul" in red. A possession of exactly 15.0 s is not a foul. The tags are saved as entered.
3. **Width:** on a wide monitor (e.g. 23", 1920×1080), in default and cinema view, the left and right edges of the video, the seek bar / timeline and the player controls line up on both the video and the tagging screen; the tag panel sits right next to the video. Narrow the window below 960 px: the panel stacks under the player and the edges still line up.

## Editing in the tag panel; Z (ADR-0030)

1. **Open:** click a row in the possession log (or its start time) → the video jumps 1 s before it, the row turns blue and the tag panel shows "Editing possession N" with its tags. Clicking the shot time jumps to the shot instead. Clicking a timeline segment does the same as clicking the row.
2. **Change and save:** press B, C → buttons follow; seek and press R / F → start / shot move to the current time (refused outside the game, or start after shot / shot before start). Enter or Save changes → "Saved the changes to possession N", the log row and segment update, the panel is back on the new-possession draft. Reload → kept.
3. **Cancel:** open a row, change something, Esc (or Cancel) → nothing changes. A possession you had running (R pressed) before opening the row is still running afterwards. Opening another row with unsaved changes says they were discarded.
4. **No shot:** open a shot, V → every tag blank (setup too) and every tag button disabled, times kept; Enter saves it as No shot (ADR-0037).
5. **Delete while editing:** deleting the open row closes the edit.
6. **Z:** after `npx supabase db push`, shots tagged Z/7 show Z in the log, the panel and Statistics → By shot direction.
7. **Windows + Chrome, dark mode:** every dropdown (statistics filters, game fields) shows readable options when open.

## Hole keys follow the side (ADR-0031)

1. In a game where you stand on the **left**: Hole buttons read Pull long … Push long with keys 1–5; 1 selects Pull long.
2. Switch the game to **right** on the video screen, open its tagging screen: Hole buttons read Push long, Push short, Middle, Pull short, Pull long with keys 1–5; 1 selects Push long, 5 Pull long. Setup buttons read Push side, Middle, Pull side with A S D; A selects Push side (ADR-0035). The help's keyboard map shows the same order.
3. Save a shot tagged with 1 on the right → log and statistics say Push long.


## Step 6 · Export (EXP-1..3, ADR-0036)

1. **Copy:** Statistics → Video scope → Copy CSV → "Copied N possessions". Paste into a spreadsheet: one header row, then one row per confirmed possession; `match_index` matches the match number, `game_index` the game number within its match, and `n` the log's #; times have two decimals; blank tags are empty cells.
2. **Download:** Download CSV → a file named like `foosball-<youtube id>.csv`; open it in Excel or Numbers: accented names (Tomáš) read correctly; a video title with a comma stays in one cell.
3. **Scopes and filters:** Game scope exports only that game; a date range only its videos; ticking Pin drops the count to the Pin shots.
4. **Candidates (EXP-3):** with an unreviewed candidate in a game, the count grows by one when "Include unreviewed candidates" is ticked; a rejected one never appears.
5. **Clipboard blocked (EXP-2):** in Safari, or with clipboard permission denied for the site, Copy CSV shows the CSV in a selected text box; ⌘C copies it.
6. **Doubles:** a doubles match exports `opponent` as "A & B".

## Timeline look; No shot and complete-only saving (ADR-0037)

1. **Timeline:** on the dark grey strip, Goal is light green, No goal dark red, no result grey. Proper is solid, Misexecuted striped, a blank execution faded. No shot is a hollow red outline. A possession over 15 s has an orange ring around it with a gap and a small orange tick at the 15 s point; its color and pattern stay visible. Candidates have a yellow dashed outline. The legend shows three groups: Result, Execution, Markers. Tick "greyscale" in the browser's accessibility settings (or a screenshot in greyscale): goal and no goal still differ.
2. **Hover / editing:** hovering a segment shows a yellow ring outside the foul ring; the segment being edited a blue one.
3. **Save only when complete:** R, F → Save is greyed out and the status line lists what is blank. Enter or R says "Can’t save yet. Still blank: …" and keeps the draft. Tag hole, execution and result → Save turns on, Enter saves.
4. **No shot:** V without R first says to press R; after R, V saves at once with setup blank too. In edit mode, V blanks every tag and disables all tag buttons; only Start, Shot, No shot, Save changes and Cancel work, and tag keys say "No shot has no tags". Press F → shot type Pin, setup Middle, shot direction Straight, the rest blank, Save disabled until tagged.
5. **Outlines and legend (ADR-0038):** the running possession is a white outline with no fill; an unreviewed candidate a yellow dashed outline with no fill. On a game with only fully tagged possessions the legend is one line (Result · Execution · Markers) without No result, Not tagged or Unreviewed candidate; open an older game with blank fields and those entries appear.
6. **Current possession (ADR-0039):** press R → the running possession is a white ring outside its span, the playhead above it; past 15 s an orange ring appears inside the white one. Click a saved segment → it gets the same white ring around its fill (no blue). Hovering a segment brightens it. No shot is a red outline with a faint red tint, the same height as the other segments. The legend's Foul and Current possession swatches show the ring around a small grey segment.

## Matches (ADR-0040)

Deploy order (ADR-0041):

1. Open the current app and wait until "Unsynced changes" is gone; close other tabs.
2. Merge `matches` into `main` (GitHub Pages deploys).
3. Run `npx supabase db push` right away.
4. Do not tag between steps 2 and 3: until the push, the new app shows the "apply the migrations" error.
5. If an old unsent game change was still queued, it shows under "1 change refused" with "Saved by an older version…"; Discard refused changes and re-enter it.

1. **Migrated data:** every video that had games shows each game as its own match, "BO1", with the old opponent and format on the match header. Video list shows the match count.
   On migrated videos each old game is its own BO1 match, so to add a game before the existing games press M first (B goes to the current match and would interleave).
2. **First match:** on a new video choose a side, press B → "Started Match 1 · Game 1"; the match header shows Singles and no names.
3. **Next game, same match:** press B later → "Match 1 · Game 2", same side as Game 1; enter scores 5:3 and 3:5 → header shows "1–1".
4. **Best of:** type 3 in Best of → "1–1 · BO3"; add a third game won 5:2 → "2–1 · BO3 · decided"; add a fourth → toast says "BO3 already had 3 games" and the header warns "4 games in a BO3". Clear Best of → no BO shown. Even values (2) are accepted.
5. **New match (M):** with a game open press M → the game ends, "Started Match 2…"; Match 2 copies format, names and best-of, notes empty, and is marked Current. Press B → "Match 2 · Game 1".
6. **No interleaving:** make Match 1 current, seek after Match 2's games, press B → refused, naming both matches; nothing is added.
7. **Empty match:** press M twice → an empty match stays in the list with "No games yet".
8. **Delete match:** Delete match… → dialog states its games and possessions; confirm → match and games gone; reload → still gone.
9. **Tagging header:** "Tag →" on a game → heading "Match 2 · Game 1 · … · vs <names>".
10. **Statistics:** scope Match → choose a match → numbers equal the sum of its games' tagging screens; Opponent filter lists the match names.
11. **CSV:** export a video with two matches → columns `match_index, best_of, game_index`; game numbers restart at 1 in each match.
12. **Offline:** Wi-Fi off, press M and B, edit an opponent → unsynced counter rises; Wi-Fi on → it clears; reload → all there.
