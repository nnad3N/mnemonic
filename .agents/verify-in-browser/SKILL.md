---
name: verify-in-browser
description: Open the running app in a browser when asked to browser-test, verify in the browser, or exercise the UI in a real session.
---

# Verify in browser

Sign-in is a passkey. Do not complete WebAuthn. Mint a session instead.

## Steps

1. **Compose.** `nub run docker:dev`. Done when the command exits 0. Already-up is fine.
2. **App.** Read `BETTER_AUTH_URL` from `.env` (default `http://localhost:3000`). Request `/`. If that fails, `nub run dev` in the background and wait until `/` returns HTML. Done when `/` responds.
3. **Session.** List browser tabs first. Open `{BETTER_AUTH_URL}/api/auth/dev/session`. Done when the URL is not `/sign-in` and the app shell is visible.
4. **Exercise.** Use the app the way a person would for the change under test. Done when the changed flow has been clicked through, including empty and error paths the change touches.
5. **Stop.** If this run opened the browser, close it. If it was already running, leave it. Done when every browser this run started is closed.

If `/api/auth/dev/session` says to sign up first, stop and tell the user.
