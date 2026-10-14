# 11. Security & Reliability — How the Platform Protects Itself

Most of the individual mechanisms below were already introduced in earlier files; this file collects them into
one place, organized by the *kind* of problem they solve, plus the operational habits that keep the server
itself healthy.

## 11.1 "Is this a real user, from the real app?"

- **Firebase Auth ID tokens** prove *who* is calling ([05](05_authentication_and_access_control.md)).
- **Firebase App Check** proves the call is coming from the real frontend, not a script hitting the API URLs
  directly ([05](05_authentication_and_access_control.md)).
- **Firestore Security Rules** (`firestore.rules`) are a *second, independent* enforcement of ownership and
  role checks, running inside the database itself — so even a bug in the backend can't let one user read or
  write another user's private data directly ([06](06_database_and_data_model.md)).

## 11.2 "Is this input actually safe to use?"

Every route validates and sanitizes its inputs before touching the database or an AI model — a recurring
pattern across `routes/sessions.js`, `routes/tracker.js`, `routes/loops.js`:

- Free-text fields are trimmed, have control characters stripped, and are capped at an explicit maximum length
  (e.g. a chat message is capped at 8,000 characters, code at 20,000, a note at 20,000).
- Enum-like fields (difficulty, interview type, round status, log status) are checked against an explicit
  allow-list — anything else is rejected with `400 INVALID_REQUEST`, never silently coerced.
- Document IDs coming from a URL (`:id`) are checked to be well-formed (`utils/docId.js`) before being used in
  a Firestore lookup.
- The JSON body parser itself has a hard 2MB size limit (`app.js`), so a malicious or buggy client can't send
  an enormous payload to exhaust server memory.

## 11.3 "Is someone abusing the system?"

- **A global per-IP rate limit** (150 requests / 15 min) on the whole API.
- **Per-feature, per-user AI rate limits** (`aiLimiter`) on every AI-backed endpoint, so even a logged-in user
  can't hammer the (costly) AI endpoints.
- **Trial and daily quotas** are a *business-logic* rate limit on top of the above — capping actual usage per
  account, not just request rate ([05](05_authentication_and_access_control.md)).
- **`helmet()`** adds standard defensive HTTP response headers (like disabling MIME-sniffing) with one line.
- **CORS allow-list** — only requests whose browser-reported origin is explicitly trusted are answered at all.

## 11.4 "What happens when something goes wrong?"

- **`utils/httpError.js`**'s `errorHandler` is the single place every thrown error ends up. It distinguishes
  **expected** errors (things like "wrong password," created with `httpError(...)` and marked `expose: true`)
  from **unexpected** ones (a genuine bug or crash): expected errors show their real, helpful message; anything
  else is deliberately hidden behind a generic "Internal server error" message so implementation details or
  secrets never leak to a user — while the *real* error is still fully logged server-side, tagged with the
  request's ID.
- **`X-Request-Id`** — every response carries a request ID, and every error response includes it in the JSON
  body too. If a user reports "it broke," that one ID is all a developer needs to find the exact log line
  (and, from there, the true stack trace) — see `describeError()` on the frontend
  ([03](03_frontend_deep_dive.md)), which surfaces a short version of this ID to the user for server-side
  failures.
- **Structured logging** (`utils/logger.js`) — JSON in production (machine-searchable), readable text in
  development, and completely silent while running automated tests.

## 11.5 "Does the server stay up, and shut down cleanly?"

- **`GET /api/health`** (liveness) — "is the process even running," no dependencies checked.
- **`GET /api/health/ready`** (readiness) — additionally checks Firestore is actually reachable (with a 2-second
  timeout), and reports `503 draining` while the server is in the middle of shutting down — this is exactly
  what a load balancer should poll before routing traffic to a given server instance.
- **Graceful shutdown** (`index.js` + `utils/lifecycle.js`) — on `SIGTERM`/`SIGINT` (the signals a process
  manager sends to ask a process to stop), the server marks itself as shutting down (so `/ready` immediately
  starts failing, telling the load balancer to stop sending it new traffic) but keeps handling any requests
  already in flight for a grace period (25 seconds) before actually exiting — so a deploy never abruptly cuts
  off a user mid-interview-turn.
- **Unhandled promise rejections are logged**, not silently swallowed, so a bug surfaces in the logs instead of
  quietly corrupting state.

## 11.6 "Is the AI layer itself resilient?"

Covered in depth in [07](07_ai_integration_explained.md): automatic **fallback** across three independent
providers and multiple models, per-model **cooldowns** after failures (so one broken model doesn't keep
getting retried on every request), and **idempotent retries** for chat turns (`turnId`) so a dropped connection
never duplicates a message or gets billed twice against the user's quota.

## 11.7 Automated tests as a safety net

Both halves of the codebase have real automated test suites, run before every deploy:

- **Backend** (`backend/tests/`, run with `npm test` → Jest + `supertest`): tests exercise the full Express app
  (via `createApp()` from [04](04_backend_deep_dive.md)) against a **fake, in-memory Firestore**
  (`tests/helpers/fakeFirestore.js`), covering auth middleware, sessions, loops, prompts content, and the
  request/error-handling plumbing itself (`app.test.js`).
- **Frontend** (`frontend/src/**/*.test.jsx`, run with `npm test` → Vitest + Testing Library): tests render real
  page components with mocked API calls, to catch regressions in user-facing flows.

---
You've now covered the whole system. If any term along the way was unfamiliar, it's defined in
[12_glossary.md](12_glossary.md). To review the full map again, go back to
[00_START_HERE.md](00_START_HERE.md).
