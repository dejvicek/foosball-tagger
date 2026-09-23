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
