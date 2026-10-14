# 6. Database & Data Model — Firestore Explained

The platform uses **Firestore**, a NoSQL "document database" from Google. If you've used a spreadsheet, the
easiest mental model is: a **collection** is like a sheet/tab, and a **document** is like one row in it —
except each "row" can have nested objects and arrays inside a single cell, and different rows in the same
sheet don't have to have exactly the same columns.

## 6.1 Every collection, what it holds, and who can touch it

### `users/{uid}`
One document per person, keyed by their Firebase Auth user ID. Created automatically on first login by
`createUserProfile` (see [05](05_authentication_and_access_control.md)). Key fields:

| Field | Meaning |
|---|---|
| `email`, `displayName`, `photoURL` | Copied from the Firebase Auth account. |
| `role` | `'user'` or `'admin'`. |
| `status` | `'PENDING'`, `'APPROVED'`, `'SUSPENDED'`, or `'BANNED'`. |
| `isUnlimited` | If true, skips all trial/quota checks. |
| `freeTrialUsed` / `freeTrialLimit` | Trial-session counter, for `PENDING` users. |
| `dailyCallsUsed` / `dailyLimit` / `dailyCallsResetDate` | Daily quota counter, for `APPROVED` users; reset date is compared against "today" in UTC. |
| `totalAiCalls` | Lifetime counter, shown to admins. |
| `banReason` / `suspendedUntil` / `suspendNote` | Set by an admin action. |
| `accessRequestId`, `approvedAt`, `approvedBy` | Link back to the access-request workflow. |

A nested subcollection, **`users/{uid}/tracker/{itemKey}`**, stores the DSA-sheet / Prep-Plan progress (see
§6.5) — Firestore lets a document "own" its own mini-collection like this.

### `sessions/{id}` — every mock interview / tutor lesson (current format)
The single most important collection. One document per attempt. Key fields:

| Field | Meaning |
|---|---|
| `userId` | Owner. |
| `interviewType` | One of the 7 types from `config/interviewTypes.js`. |
| `mode` | `'interview'`, `'tutor'`, `'sheet'` (started from the DSA sheet), or `'loop'` (part of an Interview Loop). |
| `status` | `'active'`, `'completed'`, or `'archived'`. |
| `config` | `{ company, difficulty, language, model, scorecardModel }`. |
| `question` | The public-facing `{ title, link, companyName }` shown to the user. |
| `questionData` | The **full** problem, including reference solutions/answers — **only ever read by the server**, never sent to the client. |
| `source` | `null`, or `{ kind: 'loop', loopId, roundIndex }`, or `{ kind: 'sheet', sheetId, problemId }`. |
| `messages` | The full transcript array: `{ role: 'user'|'assistant', content, turnId?, audit? }`. |
| `messageCount` / `userMessageCount` | Cached counts, so listing sessions doesn't need to load the whole transcript. |
| `timerMinutes` / `timerEndsAt` | The interview clock; starts on the candidate's *first* view of the problem, not on session creation. |
| `scorecard` | `null` until the interview is ended and scored; then `{ score, verdict, strengths[], weaknesses[], problemSolving, communication }`. |
| `notes` / `hasNotes` | AI-generated (or, for legacy sessions, sometimes manual) revision notes. |
| `code` | The candidate's latest saved code-editor contents. |
| `isPinned` | User can pin a session to the top of History. |
| `endReason` | `'abandoned'` or `'timeout'` for sessions closed automatically rather than properly ended. |
| `endingAt` | A short-lived "lock" set while a scorecard is being generated, so a duplicate request can't score the same session twice. |

### Four legacy collections: `interviews`, `tutor_interviews`, `roadmap_interviews`, `loop_interviews`
Before the unified `sessions` collection existed, each of these held one "kind" of session. They still contain
real historical data, so the backend was never allowed to just delete them — instead,
`services/sessions/store.js` treats them as **read-and-update-in-place**: `fromLegacy()` translates their
slightly different field names (`modelUsed`, `questionTitle`, `isArchived`, …) into the same shape the rest of
the app expects, on the fly, every time one is loaded. New sessions are **never** written to these collections
— they only shrink over time as old rows are naturally deleted by users.

> 🧠 **Why keep this complexity instead of migrating the old data?** Because a migration script itself is a
> risk (it can corrupt data), and it wasn't necessary — reading old rows through a small translation function
> is simpler and safer than rewriting history.

### `loops/{id}` — multi-round "Interview Loops"
One document per loop a user started. Fields: `userId`, `company`, `level`, `status`
(`'in-progress'|'passed'|'failed'`), `currentRoundIndex`, and `rounds`: an array of
`{ type, name, status, score, sessionId }`, where each round's `status` is one of `'pending'`, `'in-progress'`,
`'passed'`, `'failed'`, `'locked'`. Passing a round unlocks the next one; failing any round fails the whole
loop (`services/loops.js`'s `applyRoundUpdate`).

### `accessRequests/{id}`
Created when a trial-exhausted (or otherwise blocked) user asks for access. Holds their reason/purpose and a
`status` (`'pending'` by default) that only an admin can change to approved/denied.

### `platformSettings/{'main'}` — a single, special document
Site-wide toggles an admin controls: `allowNewSignups`, `maintenanceMode`, `freeTrialLimit`,
`defaultDailyLimit`. Read very frequently (on every quota check), so the backend caches it in memory for 5
minutes (`getPlatformSettings`/`invalidatePlatformSettings` in `checkUserAccess.js`) instead of re-reading it
from Firestore on every request.

### `users/{uid}/tracker/{itemKey}` — DSA Sheet / Prep Plan progress
One document per tracked item (a single problem, or a whole pattern-section). `itemKey` looks like
`q:<problemId>` or `sec:<sectionId>`. Fields: `sheetId` (`'dsa-master'` or `'prep-plan'`), `done`, `important`,
`note`, `noteSource` (`'manual'` or `'ai'`), plus denormalized context (`title`, `sectionTitle`, `itemType`) so
a note is still meaningful even if the sheet's structure changes later.

## 6.2 Security rules: the database's own bouncer

Even though the backend already checks all of this, **`firestore.rules`** is a second, independent layer that
runs *inside Firestore itself*. It matters because it's the only thing stopping a compromised or buggy backend
(or, in theory, a direct call to Firestore) from doing something it shouldn't. In short:

- `users/{uid}`: a user can read their own profile (or an admin can read any); a user can only *create* their
  own profile on first signup, and only with safe starting values (`status: 'PENDING'`, `role: 'user'`,
  `isUnlimited: false`, and they can't sneak in fields like `approvedAt`); only admins can update or delete.
- `interviews/{docId}` and `loops/{docId}`: a user can read/create/update/delete only documents where
  `userId` matches their own ID; admins can access all.
- `accessRequests/{docId}`: any signed-in user can create their own pending request; only admins can read,
  update, or delete.
- `platformSettings/{docId}`: any signed-in user can read; only admins can write.
- Everything else is denied by default (`match /{document=**} { allow read, write: if false; }`).

Notice that `sessions`, the three other legacy collections, and the `users/{uid}/tracker` subcollection have
**no explicit rule** — they fall through to that final "deny everything" catch-all. This is intentional, not
an oversight: the **frontend never imports Firestore's client SDK at all** (`services/firebase.js` only sets
up Auth and App Check — grep the codebase and you won't find a single `from 'firebase/firestore'` import in
`frontend/src`). Every read/write to those collections goes through the **backend**, which uses the
`firebase-admin` SDK — and the Admin SDK **always bypasses security rules entirely**, by design, because it's
trusted server code. So the "deny all" catch-all for those collections isn't a gap; it's a deliberate second
lock that guarantees nobody could *ever* reach them directly from a browser, even if a future bug added a
client-side Firestore call by mistake.

## 6.3 Indexes

`firestore.indexes.json` currently defines **no composite indexes** — every query the backend makes is simple
enough (a single `where('userId', '==', ...)`, sorted **in application code** afterward rather than in the
query itself) to not need one. This is a deliberate simplicity trade-off: it avoids the operational step of
deploying indexes, at the cost of pulling slightly more data per query than a perfectly indexed query would.

## 6.4 The question-content files (not user data — shared content)

`backend/data/*.json` hold the actual interview content, loaded into memory once at server startup by
`services/questionBank.js` (not stored in Firestore, since it's the same for every user and never changes at
runtime):

- **`dsa.json`** — coding problems, organized by company.
- **`lld.json`** (auto-generated) + **`lld-curated.json`** (hand-written overrides/reference designs) — merged
  at load time into the final LLD problem bank.
- **`system-design.json`** — hand-curated system design problems with functional/non-functional requirements,
  scale numbers, and a reference design.
- **`companies.json`** — the list of companies for autocomplete.
- **`behavioral.json`** — the bank of behavioral/managerial competency questions.

---
Next: how the AI actually generates its replies → [07_ai_integration_explained.md](07_ai_integration_explained.md)
