# 4. Backend Deep Dive — The Express Server

The backend lives in `backend/`. It's built with **Node.js** and the **Express** web framework (version 5).

## 4.1 Two entry files, one purpose split

- **`backend/app.js`** exports one function, `createApp()`, which builds and returns the *entire* Express app
  — every middleware and every route — but does **not** start listening for network connections. This means
  the automated tests (`backend/tests/app.test.js` and friends) can build a full, realistic app in memory and
  send fake requests at it, without needing a real port or a real server running.
- **`backend/index.js`** is what actually runs in production: it loads environment variables, validates them,
  calls `createApp()`, and then calls `.listen(PORT)`. It also wires up **graceful shutdown** (see
  [11_security_and_reliability.md](11_security_and_reliability.md)) and logs any crash-worthy errors.

## 4.2 The middleware chain (every request passes through all of this, in order)

Think of middleware as a row of checkpoints a request must clear before it reaches the code that actually
does the work. `createApp()` wires them up in this exact order:

1. **`app.set('trust proxy', 1')`** — tells Express "there's exactly one reverse proxy (Caddy) in front of me,"
   so it reads the real visitor IP from the `X-Forwarded-For` header correctly.
2. **`app.disable('x-powered-by')`** — stops Express from advertising itself in response headers.
3. **`requestContext`** (`backend/middleware/requestContext.js`) — generates (or reuses a safe incoming) request
   ID, attaches it as `req.id`, sets it on the response as `X-Request-Id`, and logs one line per request
   (method, path, status, duration) once the response finishes.
4. **`helmet()`** — adds a standard bundle of security-related HTTP headers.
5. **`cors(...)`** — only allows requests whose browser-reported *origin* is in an allow-list (local dev URL,
   `ALLOWED_ORIGINS` env var, plus the two hardcoded Amplify domains). Anything else is rejected with a
   `CORS_BLOCKED` error.
6. **`express.json({ limit: '2mb' })`** — parses incoming JSON request bodies (and rejects bodies over 2MB).
7. **Global rate limiter** — at most 150 requests per 15 minutes per IP address across all of `/api/`
   (skipped for requests coming from `localhost`, so local development isn't throttled).
8. **App Check gate** — every `/api/...` path except `/api/health*` must carry a valid Firebase App Check
   token, verified by `verifyAppCheck` (`backend/middleware/appCheck.js`). Health checks are exempt so
   infrastructure monitoring tools can probe the server without needing that token.
9. **The route files themselves** are mounted (see the table below).
10. Two fallback handlers: an unmatched-route 404 JSON responder, and `errorHandler`
    (`backend/utils/httpError.js`) which turns any thrown error into a consistent JSON error response.

## 4.3 Every route file and what it's for

| Mounted at | File | Purpose |
|---|---|---|
| `/api/public` | `routes/public.js` | Unauthenticated: is maintenance mode on, are signups allowed. |
| `/api/health` | `routes/health.js` | Liveness (`/`) and readiness (`/ready`, checks Firestore) probes for infrastructure. |
| `/api/questions` | `routes/questions.js` | The list of companies in the DSA question bank (for autocomplete). |
| `/api/loops` | `routes/loops.js` | Create/list/delete multi-round "Interview Loops." |
| `/api/users` | `routes/users.js` | `GET /me` — load (or auto-create) the current user's profile. |
| `/api/access` | `routes/access.js` | Submit / check the status of an access request. |
| `/api/admin` | `routes/admin.js` | Everything only an admin can do (see [09_feature_tours.md](09_feature_tours.md)). |
| `/api/prompts` | `routes/prompts.js` | Admin tool: generate a raw system prompt for copy/pasting elsewhere. |
| `/api/tracker` | `routes/tracker.js` | DSA-sheet / Prep-Plan per-item progress, notes, and AI note generation. |
| `/api/meta` | `routes/meta.js` | The list of enabled AI models and valid interview types, for the frontend's dropdowns. |
| `/api/sessions` | `routes/sessions.js` | The core interview lifecycle: create, chat turn, code review, end, notes, list, update, delete. |

Most of these route files start with `router.use(verifyToken, enforceGlobalStatus)` — meaning *every* route in
that file first requires a valid login and a global status check (not banned/suspended, not under
maintenance), before its own logic runs. `sessions.js` additionally applies `checkUserAccess` — the heavier
check that also enforces and increments AI usage quotas — but only on the one route that should actually
"cost" a session: `POST /api/sessions` (creating a new one). The full decision tree for both checks is in
[05_authentication_and_access_control.md](05_authentication_and_access_control.md).

## 4.4 Services: where the real logic lives

Route files stay thin — they parse/validate the request and call into `backend/services/`:

- **`services/sessions/store.js`** — all Firestore reads/writes for interview sessions (see
  [06_database_and_data_model.md](06_database_and_data_model.md)).
- **`services/sessions/conversation.js`** — builds the message list and picks the right system prompt for a
  given session.
- **`services/ai/`** — the AI gateway, model registry, and per-provider adapters (see
  [07_ai_integration_explained.md](07_ai_integration_explained.md)).
- **`services/prompts.js`** — the actual text of every system prompt.
- **`services/evaluation.js`** — builds the scorecard-generation prompt, parses the AI's JSON reply, and builds
  the revision-notes prompt.
- **`services/questionBank.js`** — loads the DSA/LLD/System-Design/behavioral question banks from the JSON
  files in `backend/data/` into memory once at startup.
- **`services/loops.js`** — the rules for advancing an Interview Loop from one round to the next.
- **`services/emailService.js`** — sends transactional emails (access request notifications, approval/denial).
- **`services/openaiCodeAudit.js`** — an optional, more structured code-review pass using OpenAI directly.

## 4.5 Utilities

- **`utils/httpError.js`** — a helper to create an error with a specific HTTP status/code (`httpError(400,
  'message', 'CODE')`), and the final `errorHandler` middleware that turns any thrown error into
  `{ error, code, requestId, details? }` JSON — while hiding the *real* internal message for unexpected
  (non-"expected") errors, so nothing sensitive ever leaks to a user.
- **`utils/logger.js`** — a tiny structured logger: JSON lines in production (easy to search in CloudWatch or
  similar), human-readable lines in development, and silent during automated tests.
- **`utils/lifecycle.js`** — a single shared flag (`isShuttingDown`) so the health-check route and the
  shutdown handler in `index.js` agree on server state.
- **`utils/sse.js`** — `openEventStream(res)`, the small helper that turns a normal Express response into a
  Server-Sent-Events stream for the chat endpoints.
- **`utils/docId.js`** — validates that a Firestore document ID coming from a URL parameter is actually
  well-formed, before using it in a database query.

## 4.6 Configuration

- **`config/firebase.js`** — initializes the Firebase Admin SDK once, using service-account credentials from
  environment variables.
- **`config/env.js`** — `validateEnv()`, called at startup, throws immediately if a required environment
  variable is missing (fail fast, rather than fail confusingly later), and warns about optional ones.
- **`config/interviewTypes.js`** — the single source of truth for the 7 valid interview types (`dsa`,
  `systemDesign`, `lld`, `managerial`, `tutorDsa`, `tutorLld`, `tutorSystemDesign`), each with a label, color,
  and its "base type" (a tutor session behaves like its non-tutor counterpart for content purposes).

---
Next: exactly how login and permissions work → [05_authentication_and_access_control.md](05_authentication_and_access_control.md)
