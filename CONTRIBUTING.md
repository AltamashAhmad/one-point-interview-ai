# Contributing to OnePoint Interview AI

Thank you for your interest in contributing to **OnePoint Interview AI**! We hold ourselves to high engineering standards, building production-grade, latency-critical software for engineers preparing for FAANG-level interviews.

This document provides guidelines and commands to help you contribute effectively.

---

## 🏛️ Monorepo Structure

```
one-point-interview-ai/
├── frontend/             # React 19 + Vite SPA (Monaco Editor, SSE, KaTeX, Tailwind/CSS variables)
│   ├── src/
│   │   ├── components/   # Modular UI components, layout shell, CodeEditor, chat bubbles
│   │   ├── pages/        # Lazy-loaded route views (Interview, Scorecard, DsaSheet, Loops, Admin)
│   │   ├── services/     # API client (Axios + fetch SSE streaming), Firebase App Check
│   │   └── utils/        # Error handlers, date formatters, language mappers
│   └── tests/            # Vitest + React Testing Library + Axe-core a11y tests
├── backend/              # Node.js + Express 5 API
│   ├── routes/           # REST endpoints (/sessions, /tracker, /loops, /meta, /access, /admin)
│   ├── services/         # AI Model Gateway (Groq, Gemini, OpenRouter), Question Bank, Evaluation
│   ├── middleware/       # Firebase Auth, App Check, Rate Limiting, RBAC, Request Context
│   └── tests/            # Jest + Supertest suites with mocked Firestore
├── audits/               # QA test logs, reproduction transcripts, and audit reports
└── .github/              # GitHub Actions CI/CD workflows, issue templates, dependabot
```

---

## 🚀 Local Development Setup

### Prerequisites
- **Node.js**: v20+ (Node 22 or 24 recommended)
- **npm**: v10+
- **Firebase Project**: With Authentication (Email + Google) and Cloud Firestore enabled
- **AI Provider API Key**: At least one of `GEMINI_API_KEY` (required) or `GROQ_API_KEY` (for fast LPUs)

### 1. Installation
Clone the repository and install dependencies in both packages:

```bash
# Clone repository
git clone https://github.com/AltamashAhmad/one-point-interview-ai.git
cd one-point-interview-ai

# Install backend dependencies
cd backend && npm install

# Install frontend dependencies
cd ../frontend && npm install
```

### 2. Environment Configuration

#### Backend (`backend/.env`)
Copy `backend/.env.example` to `backend/.env` and supply your credentials:

```bash
cp backend/.env.example backend/.env
```

| Variable | Description | Required? |
|---|---|---|
| `PORT` | API server port (default: `8080`) | No |
| `FIREBASE_PROJECT_ID` | Google Firebase Project ID | **Yes** |
| `FIREBASE_CLIENT_EMAIL`| Service account email | **Yes** |
| `FIREBASE_PRIVATE_KEY` | Service account private key (`\n` escaped) | **Yes** |
| `GEMINI_API_KEY` | Google Gemini API key for conversational AI & fallbacks | **Yes** |
| `GROQ_API_KEY` | Groq LPU API key for ultra-low-latency 300ms inference | Optional (Recommended) |
| `OPENROUTER_API_KEY` | OpenRouter API key for free multi-model routing | Optional |
| `OPENAI_API_KEY` | OpenAI API key for structured code review auditor | Optional |
| `ALLOWED_ORIGINS` | Comma-separated CORS origins (`http://localhost:3001,http://localhost:3000`) | Optional |
| `SKIP_APP_CHECK` | Set to `true` for local development without App Check verification | Optional |

#### Frontend (`frontend/.env`)
Copy `frontend/.env.example` to `frontend/.env`:

```bash
cp frontend/.env.example frontend/.env
```

| Variable | Description |
|---|---|
| `REACT_APP_BACKEND_URL` | URL of the backend API (default: `http://localhost:8080`) |
| `REACT_APP_FIREBASE_API_KEY` | Firebase Web API key |
| `REACT_APP_FIREBASE_AUTH_DOMAIN` | Firebase Auth domain |
| `REACT_APP_FIREBASE_PROJECT_ID` | Firebase Project ID |
| `REACT_APP_RECAPTCHA_SITE_KEY` | reCAPTCHA v3 site key for Firebase App Check |

> ⚠️ **Security Reminder**: Never commit any `.env` file or API key into version control. Gitignore rules strictly enforce this.

### 3. Running Dev Servers

In two separate terminals:

```bash
# Terminal 1 — Backend API (runs on http://localhost:8080)
cd backend && npm start

# Terminal 2 — Frontend App (runs on http://localhost:3001)
cd frontend && npm run dev -- --port 3001 --strictPort
```

---

## 🧪 Quality Gates & Testing

Before submitting any Pull Request, all automated quality gates **must pass locally**.

### Backend Quality Check
```bash
cd backend
npm test
```
- Tests all routes, authentication middleware, access quotas, loop workflows, and AI prompts using Jest and mocked Firestore instances.

### Frontend Quality Check
```bash
cd frontend
# 1. Run full unit and accessibility tests
npm test

# 2. Run static analysis & ESLint rules
npm run lint

# 3. Verify production compilation and asset bundling
npm run build

# 4. Enforce strict gzip size budgets (Startup JS < 150 KB, Chat chunk < 90 KB)
npm run check:size
```

---

## 🌿 Git & Branch Workflow

1. Create a feature branch from `dev`:
   ```bash
   git checkout dev
   git pull origin dev
   git checkout -b feat/your-feature-name
   ```

2. Format commits according to the **Conventional Commits** specification:
   - `feat:` A new user-facing feature
   - `fix:` A bug fix
   - `docs:` Documentation changes
   - `style:` Formatting, missing semicolons, etc.
   - `refactor:` Code change that neither fixes a bug nor adds a feature
   - `perf:` Performance improvements
   - `test:` Adding or updating tests
   - `chore:` Tooling, dependency upgrades, or configuration

3. Open a Pull Request against the `dev` branch:
   - Fill out the PR template completely.
   - Confirm all CI checks pass.
   - Link any associated issues.

---

## 🛡️ Security & Responsible Disclosure

If you discover a security vulnerability, please review our [Security Policy](SECURITY.md) and report it privately via GitHub Security Advisories rather than opening a public issue.
