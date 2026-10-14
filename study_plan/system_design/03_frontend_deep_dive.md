# 3. Frontend Deep Dive — The React App

The frontend lives in `frontend/src/`. It's built with **React 19** and a build tool called **Vite**, and it's
a "Single-Page App" (SPA): the browser loads one HTML page once, and React swaps out what's on screen as the
user navigates, without ever reloading the page from the server.

## 3.1 How a page gets on screen: routing

`frontend/src/App.jsx` defines every URL the app understands, using **React Router**. Each route maps a URL
path to a page component:

| URL | Page component | Who can see it |
|-----|-----------------|----------------|
| `/` | `Landing.jsx` | Logged-in users (`ProtectedRoute` + `AccessGate`) |
| `/login` | `Login.jsx` | Logged-out users only (`PublicRoute`) |
| `/interview/:type` | `Interview.jsx` | Logged-in users |
| `/history` | `History.jsx` | Logged-in users |
| `/history/:id` | `HistoryDetail.jsx` | Logged-in users |
| `/scorecard/:id` | `Scorecard.jsx` | Logged-in users |
| `/loop/:id` | `LoopDashboard.jsx` | Logged-in users |
| `/dsa-sheet` (and old `/roadmap`, `/striver-a2z`, which redirect here) | `DsaSheet.jsx` | Logged-in users |
| `/prep-plan` | `PrepPlan.jsx` | Logged-in users |
| `/admin`, `/admin/prompts` | `Admin.jsx` | Admins only (`AdminRoute`) |
| anything else | redirects to `/` | — |

Every page component is **lazy-loaded** (`React.lazy(() => import(...))`), meaning its code is only downloaded
by the browser the first time that page is actually visited, keeping the initial load fast.

### The three "gatekeeper" wrapper components

- **`ProtectedRoute`** — if the user isn't signed in, redirects to `/login`.
- **`AdminRoute`** — additionally checks the loaded profile's `role === 'admin'`; otherwise redirects home.
- **`AccessGate`** — wraps every protected page and decides whether to show it at all, or instead show a
  full-screen blocking message, based on the user's profile:
  - `maintenanceMode` is on → "System Maintenance" screen (admins are exempt).
  - `status === 'BANNED'` → "Account Banned" screen with the reason.
  - `status === 'SUSPENDED'` → "Account Suspended" screen with the reason and until-when.
  - `status === 'PENDING'` and the free trial is used up → shows the page underneath **plus** an `AccessWall`
    overlay (or, once dismissed, a persistent red banner) prompting the user to request full access.

  This means the actual page-blocking decision is made **once, in one place**, rather than repeated in every
  page — see `frontend/src/App.jsx`.

## 3.2 Knowing who's logged in: `AuthContext`

`frontend/src/contexts/AuthContext.jsx` wraps the whole app and is the single source of truth for
"who is the current user." It exposes (via the `useAuth()` hook, defined in `frontend/src/contexts/useAuth.js`
so that Fast Refresh works cleanly):

- `user` — the raw Firebase Auth user object (or `null`).
- `userProfile` — the user's Firestore profile fetched from the backend (`role`, `status`, quotas, etc.).
- `loading` / `profileLoading` — whether either of the above is still being fetched.
- `signInWithGoogle()`, `signInWithEmail()`, `signUpWithEmail()`, `logout()`.
- Computed convenience flags: `isAdmin`, `isPending`, `isApproved`, `isBanned`, `isSuspended`, `isUnlimited`,
  `isMaintenanceMode`, `trialUsed`/`trialLimit`/`trialLeft`, `dailyUsed`/`dailyLimit`/`dailyLeft`.

Internally, it listens to Firebase's `onAuthStateChanged` event; whenever the Firebase user changes, it calls
the backend's `GET /api/users/me` to load (or auto-create) that user's Firestore profile.

`ThemeContext.jsx` (with its own `useTheme.js` hook file, same pattern) is a much simpler sibling: it just
tracks `'dark' | 'light'`, persists the choice to `localStorage`, and sets a `data-theme` attribute on
`<html>` that the CSS reacts to.

## 3.3 Talking to the backend: `services/api.js`

Every network call the frontend makes to its own backend goes through `frontend/src/services/api.js`. It uses
an `axios` instance (`apiClient`) for normal request/response calls, and a hand-written SSE reader
(`postEventStream` / `readEventStream`) for the streaming chat endpoints. Every exported function first calls
`getHeaders()`, which attaches:
- `Authorization: Bearer <Firebase ID token>` (proves who the user is), and
- `X-Firebase-AppCheck: <App Check token>` (proves the request is really from this app).

Grouped by feature, the functions include:

| Area | Functions |
|------|-----------|
| Sessions | `listSessions`, `createSession`, `getSession`, `sendSessionTurn` (streaming), `reviewSessionCode`, `endSession`, `generateSessionNotes`, `updateSession`, `deleteSession` |
| Loops | `getLoops`, `getLoop`, `createLoop`, `deleteLoop` |
| Users / profile | `getMyProfile` |
| DSA Sheet / Prep Plan tracker | `getTrackerItems`, `updateTrackerItem`, `deleteTrackerItem`, `generateTrackerNote` |
| Access requests | `submitAccessRequest`, `getAccessRequestStatus` |
| Admin | `getAdminStats`, `getAdminUsers`, `deleteUserPermanent`, `updateUserStatus`, `updateUserQuota`, `resetUserDailyQuota`, `getAccessRequests`, `approveAccessRequest`, `denyAccessRequest`, `getAdminSettings`, `updateAdminSettings`, `generateAdminPrompt` |
| Misc | `getMeta` (AI models + interview types), `getCompanyList`, `getPublicPlatformStatus` |

There's also `describeError(err, fallback)` in `frontend/src/utils/errors.js` — every page uses this to turn a
failed request into a friendly message, adding a short `(ref: xxxxxxxx)` code (from the backend's request ID)
for server-side (5xx) failures, which support can use to find the exact log line.

## 3.4 Firebase on the client: `services/firebase.js`

This file initializes the Firebase Auth SDK (Google sign-in provider) and **App Check** (using Google's
invisible reCAPTCHA v3). In local development, a debug token bypasses the real reCAPTCHA check entirely.

## 3.5 The pages, in one line each

| Page | Purpose |
|------|---------|
| `Landing.jsx` | Home screen: pick an interview type, see the DSA sheet / prep plan / loop tiles, resume any interview in progress. |
| `Login.jsx` | Sign in / sign up (Google or email). |
| `Interview.jsx` | The live interview screen: chat with the AI, code editor, timer, model switcher. |
| `Scorecard.jsx` | Shows the score, verdict, strengths/weaknesses, and detailed feedback for one finished session. |
| `History.jsx` | Every past session, grouped and filterable, with pin/delete. |
| `HistoryDetail.jsx` | One session's full transcript plus AI-generated revision notes. |
| `DsaSheet.jsx` | The 322-problem DSA practice checklist with filters, notes, and a "practice this" launcher. |
| `PrepPlan.jsx` | A week-by-week study calendar with a daily log and notes. |
| `LoopDashboard.jsx` | One multi-round "interview loop" — shows round status and lets you start the next one. |
| `Admin.jsx` | The admin console: dashboard stats, access requests, user management, platform settings. |
| `AccessWall.jsx` | The "request access" form shown to trial-exhausted users. |

## 3.6 Shared building blocks worth knowing

- **`components/PageHeader.jsx`** — the sticky header (back button, icon, title, subtitle, theme toggle) used
  by most pages, so they look and behave consistently.
- **`components/CodeEditor.jsx`** — wraps the Monaco editor (the same code editor VS Code uses in the browser).
- **`components/MessageBubble.jsx`** + **`components/markdownComponents.jsx`** — render a chat message's
  Markdown (bold text, code blocks, Mermaid diagrams) consistently for both the AI and the user.
- **`components/ModelSelector.jsx`** — the dropdown for picking which AI model answers.
- **`components/NoteEditor.jsx`** — a small floating note-taking panel (used by both the DSA sheet and history)
  that can be minimized, maximized, or generate its content with AI.
- **Hooks** (`hooks/`): `useTracker` (loads/saves DSA-sheet/prep-plan progress), `useCountdown` (the interview
  timer), `useVoiceToText` (speech-to-text input), `useLoopPersist` (loop data fetching/caching).

---
Next: the server side that all of this talks to → [04_backend_deep_dive.md](04_backend_deep_dive.md)
