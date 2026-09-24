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
6. **List (VID-2):** the list shows title, duration, recorded date ("No date" if blank), 0 games, 0 possessions, newest first.
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
7. **Next game (GAM-1/2):** with Game 1 open, press B → Game 1 ends and Game 2 starts at the same time, with the same side and format.
8. **Overlap (GAM-4):** seek inside Game 1 and press B → refused with an explanation. Seek before Game 2's start and use "End here" on Game 1 past Game 2's start → refused. Touching games (end of 1 = start of 2) are fine.
9. **Inline edits (GAM-2):** change side, format, opponent, scores, notes; reload → all kept.
10. **GAM-3:** click a game's start time → the player seeks there; "Tag →" opens the tagging placeholder.
11. **Delete a game:** Delete… → confirmation; Esc cancels; confirm removes it.
12. **Offline (SYN-2):** turn Wi-Fi off, press B and E, edit a name → header shows "Unsynced changes: n"; reload while still offline → the games are still there (games list may show a load error: Try again once online); turn Wi-Fi on → the counter disappears within a minute; reload → everything is on the server.
13. **Seek bar (ADR-0018):** on a long video, drag the bar → the video follows while dragging and lands where released; hovering shows the time; games appear as green marks. Right after using the bar, Space and B still work. Tab to the bar: Page Up/Down jump a minute, Home/End go to the ends.

## Step 4 · Tagging (TAG-1..8, SYN-1..4)

Open a game with "Tag →" on the video screen.

1. **Opens at the game (GAM-3):** the player jumps to the game start; the header shows game number, range, side, opponent.
2. **Keyboard-only possession:** S → timer runs and status says "Press F…"; Z, 1, Q; F → timer freezes, status lists what is blank; A, G, J → "All tagged"; Enter → row appears in the log with the right length; Setup is back on Middle (TAG-2, TAG-3).
3. **S after F** saves and starts the next; **N** saves a No shot at once; **Esc** clears; **U** deletes the last saved (press twice: the one before); pressing a tag key twice clears it.
4. **Refusals:** F before S's time (seek back) → message, nothing swapped (TAG-4). Seek outside the game, press S → message suggesting to adjust the game (TAG-5).
5. **Focus:** clicking any tag button, then Space/Enter still play/save. Clicking the video picture, then S still works. Nothing happens while a log select is open; Esc leaves it.
6. **Timeline (TAG-6):** goal, no goal, no shot, untagged look different even in greyscale; hover shows tags; click a segment → 1 s before it; click empty strip → seek there.
7. **Log (TAG-7):** change a result → reload → kept; ⌖ sets start/shot to the current time (refused outside the game or with shot before start); the row under the playhead is highlighted; × → "Delete?" → click again deletes.
8. **Help (TAG-8):** "How to tag" opens the key table and definitions; it says frame stepping is approximate.
9. **Reload mid-draft:** press S, tag a field, reload → the running draft is still there.
10. **Offline (SYN):** Wi-Fi off, tag 5 possessions → "Unsynced changes: 5"; reload offline → the draft survives, the tagged rows are safe in the queue (the page may show a load error until online); Wi-Fi on → counter clears; reload → all 5 on the server, none twice.
11. **Speed:** tag a 10-minute game; it should take about 15 minutes (PRD §1.4). Note anything slowing you down.
12. **Unexpected refusals:** if S or F is ever refused when the time looks right, open the browser console (⌥⌘J) and copy the "Tag refused" line.

## Step 5 · Statistics (STA-1..10)

1. **Live game numbers:** on the tagging screen, tag a goal → conversion and the "By shot" row update at once, without reload.
2. **Blank is not a miss (STA-1):** tag a shot with no result → conversion's denominator does not grow; add the result → it does.
3. **Samples (STA-2, STA-3):** every percentage shows (n/d); all carry † until 30 attempts; the footnote explains it.
4. **Hand check:** for one game, count goals and shots-with-result in the log yourself → same as the conversion shown. Same for one "By shot" row.
5. **Scopes (STA-4):** Statistics → Date range "All time" includes every video; "Last 30 days" drops older ones; a video without a recorded date counts on the day it was added. Video scope matches the sum of its games. Game scope matches the tagging screen.
6. **Filters:** tick Pin → only Pin shots count, "n of m … match the filters"; Format and Opponent narrow further; reload keeps scope and filters (they are in the URL).
7. **Candidates:** unreviewed or rejected possessions never count; confirming one in the log makes it count.
8. Phone width: the statistics page has no sideways scroll; wide tables scroll inside their card.
