# 12. Glossary — Every Term, Defined Simply

Use this page whenever a word in another file is unfamiliar. It's organized alphabetically.

- **Admin App Check bypass** — see *App Check*.
- **AI model** — a piece of software (hosted by a company like Google or Groq) that reads text and generates a
  reply, one word ("token") at a time. This platform doesn't build its own AI — it calls other companies' models.
- **API (Application Programming Interface)** — the set of URLs the frontend is allowed to call on the backend
  to get or change data, e.g. `POST /api/sessions`. Think of it as the kitchen's order-taking window.
- **App Check** — a Firebase feature that proves a request really came from this app's own frontend (not a
  script someone wrote to hit the API directly). The frontend attaches a special token to every request; the
  backend verifies it.
- **Axios** — a JavaScript library the frontend uses to make HTTP requests (instead of the raw browser `fetch`).
- **Backend** — the server-side code (in `backend/`), built with Node.js and Express. It's the only thing
  allowed to talk to the database directly.
- **Caddy** — a lightweight web server used here purely as a **reverse proxy**: it receives incoming internet
  traffic on a domain name and forwards it to the Node.js process running on a specific port.
- **Circuit breaker / cooldown** — when an AI model fails (e.g. rate-limited), the backend "benches" it for a
  while (seconds to hours depending on the error) instead of retrying it immediately on every request.
- **Collection / document** — Firestore's equivalent of a spreadsheet's "sheet" and "row." A collection (e.g.
  `users`) holds many documents (e.g. one per user), each identified by an ID.
- **CORS (Cross-Origin Resource Sharing)** — a browser security rule that blocks a website from calling an API
  on a different domain unless that API explicitly allows it. The backend has an allow-list of frontend domains.
- **Firebase Auth** — Google's authentication service. It handles passwords, Google sign-in, and issues a
  signed **ID token** proving who a user is — this app never sees or stores passwords itself.
- **Firestore** — Google's NoSQL cloud database used to store everything: user profiles, interview sessions,
  loops, access requests, etc.
- **Frontend** — the code that runs in the user's browser (in `frontend/`), built with React. It's the only
  thing the user directly sees and clicks.
- **Graceful shutdown** — when the server process is told to stop (e.g. during a deploy), it stops accepting
  new requests but waits a grace period for in-flight ones to finish before actually exiting.
- **Helmet** — an Express library that adds a set of security-related HTTP response headers automatically.
- **HTTP method** — the "verb" of a web request: `GET` (read), `POST` (create), `PUT`/`PATCH` (update),
  `DELETE` (remove).
- **ID token** — a short-lived, signed piece of text Firebase Auth gives a signed-in user, proving their
  identity. The frontend sends it on every API call as `Authorization: Bearer <token>`.
- **JWT (JSON Web Token)** — the technical format of the ID token above: a string that encodes who the user is
  and is cryptographically signed so it can't be forged.
- **Middleware** — a function that runs *before* the actual route handler, for something every request needs
  (checking login, logging, rate limiting). Requests pass through a chain of these, like security checkpoints.
- **Prompt / system prompt** — the block of instructions sent to an AI model before the conversation, e.g. "You
  are a Senior Software Engineer interviewer. Ask one question at a time. Here is the problem: ...".
- **Rate limiting** — capping how many requests a user (or IP address) can make in a time window, to stop abuse
  and control cost.
- **React** — a JavaScript library for building the frontend's UI out of reusable "components" (buttons,
  pages, forms) that automatically re-render when their data changes.
- **React Router** — the library that changes which page component is shown based on the URL, without a full
  page reload (a "Single-Page App").
- **Reverse proxy** — a server that sits in front of your application and forwards traffic to it (see *Caddy*).
- **Scorecard** — the AI-generated report card produced after ending an interview: a score, a verdict, and
  written feedback.
- **Session (interview session)** — one practice attempt: the questions, every message exchanged, the code
  written, and (once finished) the scorecard. Stored as one Firestore document.
- **SSE (Server-Sent Events)** — a technique for a server to stream a reply to the browser piece by piece over
  a single open connection, so AI replies appear word-by-word instead of all at once at the end.
- **Vite** — the build tool that turns the frontend's source code into the optimized files a browser can run,
  and powers the fast local dev server.
- **Vitest / Jest** — the automated testing tools for the frontend and backend, respectively.

Ready to see the whole system at once? → [02_big_picture_architecture.md](02_big_picture_architecture.md)
