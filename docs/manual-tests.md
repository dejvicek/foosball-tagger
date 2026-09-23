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
