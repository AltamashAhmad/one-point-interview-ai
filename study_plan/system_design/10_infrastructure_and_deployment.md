# 10. Infrastructure & Deployment — Where the Code Actually Runs

This file is about the *physical/operational* side: which machine runs what, and how a code change goes live.

## 10.1 The frontend: AWS Amplify Hosting

`amplify.yml` (at the repo root) tells AWS Amplify how to build the frontend automatically whenever code is
pushed:

```yaml
version: 1
applications:
  - appRoot: frontend
    frontend:
      phases:
        preBuild:
          commands:
            - npm ci
        build:
          commands:
            - npm run build
      artifacts:
        baseDirectory: build
        files:
          - '**/*'
      cache:
        paths:
          - node_modules/**/*
```

In plain terms: install exact dependencies (`npm ci`), run the Vite production build (`npm run build`, which
outputs into `frontend/build/`), and serve every file in there as a static website — no server-side rendering,
it's a pure static single-page app. `backend/app.js` explicitly allows two Amplify preview domains in its CORS
allow-list (in addition to whatever's in the `ALLOWED_ORIGINS` environment variable), since Amplify gives each
deployment its own subdomain.

## 10.2 The backend: a plain Node.js process behind Caddy

The backend is **not** serverless — it's a normal, long-running Node.js process (`node index.js`) on a server,
kept alive by a process manager (referenced in earlier project notes as PM2), listening on a port like
`8080`. In front of it sits **Caddy**, a lightweight web server used purely as a **reverse proxy** — the actual
`Caddyfile` at the repo root is short:

```caddyfile
13-53-197-160.nip.io {
    reverse_proxy localhost:8080
}

dev-13-53-197-160.nip.io {
    reverse_proxy localhost:8081
}
```

- `13-53-197-160.nip.io` is the **production** domain — Caddy receives public internet traffic here (handling
  HTTPS/TLS automatically, one of Caddy's signature features) and forwards it, unencrypted, to the Node
  process on `localhost:8080`.
- The second block is a **separate development domain** pointing at a *second* Node process on port `8081` —
  meaning production and a work-in-progress deployment can run side by side on the same machine, on different
  ports, without interfering with each other.
- `.nip.io` is a free service that turns any IP address into a wildcard DNS name (e.g. `13-53-197-160.nip.io`
  always resolves to `13.53.197.160`) — a convenient way to get a real domain name for TLS without owning one.

Inside `backend/app.js`, `app.set('trust proxy', 1)` tells Express "trust the `X-Forwarded-For` header from
exactly one upstream proxy" — this is what lets the rate limiter and logging see the visitor's *real* IP
address rather than Caddy's own.

## 10.3 Configuration: environment variables

The backend loads configuration entirely from environment variables (via a `.env` file locally, real
environment variables in production), validated at startup by `config/env.js`. Required (the server refuses to
start without these): `FIREBASE_PROJECT_ID`, `FIREBASE_CLIENT_EMAIL`, `FIREBASE_PRIVATE_KEY`,
`GEMINI_API_KEY`. Optional, with a startup warning if missing (a whole *provider* or feature is simply
unavailable, not a crash): `GROQ_API_KEY`, `OPENROUTER_API_KEY`, `OPENAI_API_KEY` (used for the more
structured code-review pass), `ALLOWED_ORIGINS`.

## 10.4 Dependencies at a glance

| | Backend | Frontend |
|---|---|---|
| Language runtime | Node.js | Browser (JavaScript) |
| Framework | Express 5 | React 19 |
| Key libraries | `firebase-admin` (Firestore + Auth admin access), `groq-sdk`, `@google/generative-ai`, `openai`, `helmet`, `cors`, `express-rate-limit`, `nodemailer` | `react-router-dom` 7, `axios`, `firebase` (client SDK), `@monaco-editor/react`, `react-markdown`, `mermaid`, `react-resizable-panels` |
| Build tool | plain Node (no build step) | **Vite** |
| Test runner | **Jest** + `supertest` | **Vitest** + Testing Library |
| Run commands | `npm start` → `node index.js`; `npm test` → `jest` | `npm run dev` (local server), `npm run build` (production files), `npm test` → `vitest run`, `npm run lint` → `eslint src` |

## 10.5 A code change, from laptop to production (typical flow)

1. A developer edits code locally, running the frontend with `npx vite --port 3000` and the backend with
   `node index.js` (restarted manually after backend edits — there's no hot-reload on the server side).
2. Before shipping, `npm test`/`npm run lint`/`npm run build` are run on both sides to catch regressions.
3. Pushing to the repository triggers **Amplify** to rebuild and redeploy the frontend automatically (per
   `amplify.yml`).
4. The **backend** is deployed by updating the code on the server and restarting the Node process — the
   in-process **graceful shutdown** logic (see [11](11_security_and_reliability.md)) ensures in-flight requests
   finish first, and the `/api/health/ready` endpoint lets a load balancer or process manager know exactly
   when the *new* process is actually ready to receive traffic again.

---
Next: how the platform protects itself and stays reliable →
[11_security_and_reliability.md](11_security_and_reliability.md)
