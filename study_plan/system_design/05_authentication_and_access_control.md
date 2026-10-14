# 5. Authentication & Access Control — Who Can Do What

There are actually **three separate layers** of checks on every request, each answering a different question.
Understanding the difference between them is the key to this whole file.

| Layer | Question it answers | Where it lives |
|---|---|---|
| 1. App Check | "Is this really our frontend calling, not a script?" | `middleware/appCheck.js` |
| 2. Firebase Auth (`verifyToken`) | "Who is this person?" | `middleware/auth.js` |
| 3. Access control (`checkUserAccess` / `enforceGlobalStatus`) | "Is this person *allowed* to do this right now?" | `middleware/checkUserAccess.js` |

## 5.1 Layer 1 — App Check: "is this really the app?"

Every `/api/...` request (except health checks) must include an `X-Firebase-AppCheck` header. The frontend
gets this token from Google's invisible reCAPTCHA v3 (`services/firebase.js`) and attaches it automatically.
The backend calls `admin.appCheck().verifyToken(...)` to verify it. If it's missing or invalid, the request is
rejected with 401, before any of the user-specific logic below even runs. In local development, setting
`SKIP_APP_CHECK=true` bypasses this entirely (never done in production).

## 5.2 Layer 2 — Firebase Auth: "who is this?"

The frontend sends `Authorization: Bearer <ID token>` on every call. `verifyToken` (in `middleware/auth.js`):

1. Verifies the token's signature **locally** (fast, no network call) — this alone proves the token was really
   issued by Firebase and hasn't been tampered with, and hasn't simply expired.
2. Separately, it checks whether the token has been **revoked** (e.g. the user was force-logged-out) — this
   *does* require a network call to Firebase, so to keep things fast it's only actually re-checked once every
   **5 minutes per user** (tracked in an in-memory map), not on every single request.
3. On success, it sets `req.user = { uid, email, name }` for every later step to use.
4. If an admin deletes a user, `forgetVerifiedUser(uid)` clears that user's cached revocation timestamp so the
   very next request re-checks properly instead of trusting a stale check.

## 5.3 Layer 3 — Access control: "are they allowed to do this?"

This is the interesting part, implemented in `middleware/checkUserAccess.js`. There are actually **two**
different-strength checks, used in different places:

### `enforceGlobalStatus` — the lightweight check (used almost everywhere)

Applied to nearly every route file (`sessions.js`, `loops.js`, `tracker.js`, `access.js`, …) via
`router.use(verifyToken, enforceGlobalStatus)`. It only asks three yes/no questions and does **not** touch any
quota:

1. Is `maintenanceMode` on (from the cached platform settings) and the user isn't an admin? → 503.
2. Is the user's status `BANNED`? → 403.
3. Is the user's status `SUSPENDED`? If the suspension's end date has already passed, it's **auto-lifted**
   right here (status flips back to `APPROVED`); otherwise → 403.

### `checkUserAccess` — the heavyweight check (used only where a session is "spent")

Applied to exactly one place that matters most: `POST /api/sessions` (starting a brand-new mock interview),
plus the admin prompt-generation tool. In addition to everything `enforceGlobalStatus` does, it:

4. **Auto-creates the user's Firestore profile** the very first time they're ever seen (see
   `createUserProfile`), with `status: 'PENDING'`, `role: 'user'`, a free trial limit, and a daily limit pulled
   from the platform's current settings — unless new signups have been switched off by an admin, in which case
   it deletes the just-created Firebase Auth account and rejects with `SIGNUPS_DISABLED`.
5. If `isUnlimited` is true on the profile (a trusted/VIP flag an admin can set), **every quota check below is
   skipped entirely**.
6. If `status === 'PENDING'`: enforces the **free trial** — a small number of total sessions (`freeTrialLimit`,
   default 3). Once used up, further attempts get `403 FREE_TRIAL_EXHAUSTED`.
7. If `status === 'APPROVED'`: enforces a **daily quota** (`dailyLimit`, default 20), which resets automatically
   at UTC midnight. Once used up, further attempts get `429 DAILY_QUOTA_EXCEEDED` (with a `resetsAt` timestamp
   so the frontend can show "try again in X hours").
8. Any other status is denied outright (`403 ACCESS_DENIED`) as a safety net.
9. On success, it atomically increments the relevant usage counter in Firestore, so quota tracking can never
   be "raced" by two simultaneous requests.

A subtlety worth remembering: the profile itself is cached in memory for 60 seconds
(`getCached`/`setCache`/`evictCache`) so that a single active user chatting back and forth doesn't hit
Firestore on every message just to re-check their own status — any admin action against that user (ban,
approve, change quota) explicitly calls `evictCache(uid)` so the change is felt on the user's *next* request,
not up to a minute later.

> 🧠 **In plain English:** `enforceGlobalStatus` is the doorman checking "are you banned from the building
> today?" on every visit. `checkUserAccess` is the cashier who *also* checks "have you used up your free
> coffees / today's coffee limit?" — but only when you're actually ordering a fresh coffee (creating a new
> session), not every time you take a sip of one you already bought.

## 5.4 Admin-only routes: `requireAdmin`

Everything under `/api/admin` additionally requires `middleware/requireAdmin.js`, which independently reads
the user's own Firestore document and checks `role === 'admin'` — it doesn't trust any client-sent claim of
being an admin. On the frontend, `AdminRoute` in `App.jsx` does the same check against the loaded profile
purely as a UX nicety (to redirect non-admins away instantly); the *real* enforcement always happens on the
server, since a user could otherwise just edit their browser's JavaScript.

## 5.5 Rate limiting (separate from quotas)

Two more layers exist purely to control load and abuse, unrelated to trial/quota business logic:

- A **global** limiter (`app.js`): 150 requests per 15 minutes per IP address across the whole API (skipped
  for `localhost`).
- **Per-feature AI limiters** (`middleware/rateLimits.js`'s `aiLimiter(...)`), keyed by **user ID** (not IP), on
  the specific endpoints that call an AI model: creating a session (20 / 15 min), sending a chat turn / code
  review / ending / notes (60 / 15 min combined), and DSA-sheet AI note generation (30 / 15 min). Admins and
  `isUnlimited` accounts, plus requests from `localhost`, are exempt.

## 5.6 What the frontend does with all of this

`AuthContext` loads the profile once via `GET /api/users/me` and exposes simple booleans (`isBanned`,
`isPending`, `trialLeft`, etc.) that `App.jsx`'s `AccessGate` uses to decide whether to show a full-screen
block, an access-request wall, or the real page — see
[03_frontend_deep_dive.md](03_frontend_deep_dive.md#31-how-a-page-gets-on-screen-routing). This is purely a
*convenience* for the user (so they see a nice message instead of a raw error); the backend enforces every one
of these rules again, independently, on every request — the frontend check can never be the only line of
defense.

---
Next: where all this data actually lives → [06_database_and_data_model.md](06_database_and_data_model.md)
