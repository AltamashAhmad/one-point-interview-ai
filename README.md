<div align="center">

# 🎯 OnePoint Interview AI
### The Enterprise Mock Interview Platform for FAANG+ Engineering Candidates

[![Live Production](https://img.shields.io/badge/Live%20Platform-Visit%20App-6366f1?style=for-the-badge&logo=aws&logoColor=white)](https://main.d369q8sr84jlxa.amplifyapp.com/)
[![CI Status](https://img.shields.io/github/actions/workflow/status/AltamashAhmad/one-point-interview-ai/ci.yml?branch=main&style=for-the-badge&label=CI%20Build)](https://github.com/AltamashAhmad/one-point-interview-ai/actions)
[![React 19](https://img.shields.io/badge/React-19.1-61DAFB?style=for-the-badge&logo=react&logoColor=black)](https://react.dev)
[![Node.js](https://img.shields.io/badge/Node.js-Express%205-339933?style=for-the-badge&logo=node.js&logoColor=white)](https://nodejs.org)
[![Firebase](https://img.shields.io/badge/Firebase-Auth%20%26%20Firestore-FFCA28?style=for-the-badge&logo=firebase&logoColor=black)](https://firebase.google.com)
[![Groq LPU](https://img.shields.io/badge/Inference-Groq%20300ms%20LPU-f55036?style=for-the-badge&logo=fastapi&logoColor=white)](https://groq.com)
[![Gemini 2.5](https://img.shields.io/badge/LLM-Google%20DeepMind%20Gemini-8b5cf6?style=for-the-badge&logo=google&logoColor=white)](https://deepmind.google/technologies/gemini/)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg?style=for-the-badge)](LICENSE)

<br/>

**OnePoint AI** transforms technical interview preparation from isolated problem-solving into a realistic, high-pressure conversational simulation. It replicates genuine senior and staff-level FAANG technical rounds across **Data Structures & Algorithms**, **High-Level System Design**, **Low-Level Object-Oriented Design**, and **Behavioral Leadership**.

[Explore Live Demo](https://main.d369q8sr84jlxa.amplifyapp.com/) · [Documentation](#-system-architecture) · [Getting Started](#-quickstart--local-development) · [Contributing](CONTRIBUTING.md)

<br/>

![OnePoint AI Dashboard](assets/0_new_hero.png)

</div>

---

## 🌟 The Philosophy: Beyond LeetCode Grinding

Standard interview preparation platforms focus exclusively on whether code compiles and passes tests. In real-world FAANG interviews, candidates are judged on:
1. **Clarifying Ambiguity**: Probing requirements and identifying hidden constraints before writing code.
2. **Communication & Thought Process**: Articulating brute-force trade-offs before pivoting to optimal algorithms.
3. **Edge Case Anticipation**: Identifying integer overflows, null references, concurrency hazards, and boundary values.
4. **Resilience & Feedback Adaptation**: Incorporating interviewer guidance rather than expecting pre-baked solutions.

OnePoint AI acts as a **strict, adaptive Principal/Staff Engineer**. It evaluates your live dialogue, challenges unstated assumptions, audits code line-by-line for asymptotic complexity, and delivers a rigorous, rubric-driven scorecard upon completion.

---

## 🚀 Key Platform Capabilities

```
┌───────────────────────────────────────────────────────────────────────────┐
│                           ONEPOINT AI PLATFORM                            │
├─────────────────┬───────────────────┬───────────────────┬─────────────────┤
│  DSA Technical  │   System Design   │  Low-Level Design │   Behavioral    │
│  8,177 Problems │   High-Level HLD  │   OOP & Patterns  │   STAR Method   │
├─────────────────┼───────────────────┼───────────────────┼─────────────────┤
│  Monaco Editor  │   Audio Dictation │  AI Scorecards    │   Full Loops    │
│  10 Languages   │   Web Speech API  │  Pass / No Hire   │   4-Round Onsite│
└─────────────────┴───────────────────┴───────────────────┴─────────────────┘
```

### 1. ⚡ Ultra-Low Latency Conversational Engine
- **300ms Time-to-First-Token**: Driven by Groq LPUs (`qwen/qwen3.8-27b` and `openai/gpt-oss-120b`) with streaming Server-Sent Events (SSE).
- **Multi-Provider Fallback Gateway**: Automatic resilience across Groq, Google DeepMind Gemini 2.5 Flash, and OpenRouter with automatic cooldown management for rate limits.
- **Strict Anti-Spoiler Guardrails**: The interviewer prompts, hints, and probes; it never hallucinates, acts as the candidate, or prematurely spoils optimal solutions.

### 2. 💻 Integrated Monaco IDE & Live Code Review
- **Full In-Browser Editor**: Powered by the same engine as VS Code, with syntax highlighting and formatting for **10 languages**: Python, JavaScript, TypeScript, Java, C++, C#, Go, Rust, Kotlin, and Swift.
- **Two-Way Synchronization**: Code autosaves locally in `localStorage` and continuously syncs to Firestore so candidates can switch devices seamlessly.
- **Line-by-Line Code Auditor**: Reviews submitted solutions for time and space complexity ($O(N)$, $O(\log N)$), syntax errors, logical bugs, and unhandled edge cases.

### 3. 🎙️ Natural Voice Input (Web Speech API)
- Real-time speech-to-text dictation allows candidates to speak aloud and explain their thought process naturally, mimicking a genuine Zoom/Google Meet technical phone screen.

### 4. 🗺️ Curated DSA Master Sheet & Tracker
- 281 top interview problems organized by algorithmic patterns (Sliding Window, Two Pointers, Monotonic Stack, Backtracking, Dynamic Programming, Graphs).
- Instant 1-click practice launch, problem bookmarking, solution state tracking, and personal Markdown study notes.

### 5. 🏢 Full 4-Round Company Interview Loops
- Replicates an authentic 4-stage onsite interview day:
  - **Round 1**: Algorithmic Problem Solving (DSA Medium)
  - **Round 2**: Advanced Data Structures (DSA Hard)
  - **Round 3**: Scalable System Architecture (System Design)
  - **Round 4**: Engineering Leadership & Cultural Fit (Managerial)
- Tracks round progression, cumulative scoring, and conditional progression.

### 6. 📊 Calibrated Evaluation Scorecards
- Evaluates candidate performance against strict industry rubrics with a 70% passing threshold (`PASS_SCORE = 70`).
- Generates detailed feedback on problem-solving speed, technical depth, communication clarity, strengths, areas for improvement, and a final verdict (**Strong Hire**, **Hire**, **Lean Hire**, or **No Hire**).

---

## 🏗️ System Architecture

```mermaid
flowchart TD
    subgraph Client ["Frontend (React 19 + Vite)"]
        UI["UI Layer / React SPA"]
        Monaco["Monaco Code Editor"]
        Speech["Web Speech Audio API"]
        SSEClient["SSE EventSource Stream"]
    end

    subgraph Edge ["Network & Reverse Proxy"]
        Amplify["AWS Amplify CDN"]
        Caddy["Caddy Reverse Proxy"]
    end

    subgraph Security ["API Security & Middleware Layer"]
        AppCheck["Firebase App Check (reCAPTCHA v3)"]
        AuthCheck["Firebase Auth (JWT + Revocation Cache)"]
        RateLimiter["Per-IP & Per-User Rate Limiters"]
        CORS["CORS Origin Filter"]
    end

    subgraph Backend ["Backend API (Express 5 + Node.js)"]
        Router["Express API Router"]
        Gateway["AI Model Gateway & Fallback Registry"]
        QBank["In-Memory Question Bank (8,177 Problems)"]
        Evaluation["Scorecard Evaluator"]
    end

    subgraph Providers ["AI Providers & Data"]
        Groq["Groq LPU (Qwen / GPT-OSS)"]
        Gemini["Google Gemini 2.5 Flash"]
        OpenRouter["OpenRouter Multi-Model"]
        Firestore[("Cloud Firestore DB")]
    end

    UI --> Amplify
    Amplify --> Caddy
    Caddy --> CORS
    CORS --> Security
    Security --> AppCheck
    AppCheck --> AuthCheck
    AuthCheck --> RateLimiter
    RateLimiter --> Router
    Router --> Gateway
    Router --> QBank
    Router --> Evaluation
    Gateway --> Groq
    Gateway -.->|Fallback on 429| Gemini
    Gateway -.->|Fallback on Quota| OpenRouter
    Router --> Firestore
    Gateway --> SSEClient
```

---

## 📸 Platform Walkthrough

<div align="center">

| Setup & Model Selection | Live Coding Interview |
|---|---|
| ![Setup](assets/3_configure_session.png) | ![Active Interview](assets/5_active_interview.png) |

| Interactive Code Review & Chat | Comprehensive AI Scorecard |
|---|---|
| ![Chat Interface](assets/6_active_chat.png) | ![Scorecard](assets/8_scorecard.png) |

| Curated DSA Master Sheet | Session History & Review |
|---|---|
| ![DSA Roadmap](assets/10_neetcode_roadmap.png) | ![Interview History](assets/9_interview_history.png) |

</div>

---

## 🛠️ Technology Stack

| Layer | Technologies | Purpose |
|---|---|---|
| **Frontend Framework** | React 19, Vite 8 | Ultra-fast HMR and optimized component lifecycle |
| **Code Editor** | Monaco Editor (`@monaco-editor/react`) | Native VS Code editing experience with multi-language AST support |
| **Styling & Design** | CSS Design Tokens, JetBrains Mono, Inter | Modern Glassmorphic dark/light UI with zero layout shifts |
| **Formatting & Math** | Remark GFM, KaTeX, PrismJS | Mathematical notation, asymptotic complexity notation, syntax highlighting |
| **Diagrams** | Mermaid.js (Lazy-loaded) | Dynamic rendering of state diagrams, recursion trees, and dry runs |
| **Backend Framework** | Node.js 20+, Express 5 | Scalable REST API with non-blocking event streams |
| **Database** | Google Cloud Firestore | High-performance distributed NoSQL storage for sessions and transcripts |
| **Authentication** | Firebase Authentication | Cryptographically verified JWT sessions with token revocation |
| **API Defense** | Firebase App Check (reCAPTCHA v3) | Cryptographic origin attestation preventing unauthorized API abuse |
| **AI Inference** | Groq LPUs, Google Gemini 2.5, OpenRouter | Streaming conversational reasoning and code analysis |
| **Testing & CI** | Jest, Supertest, Vitest, Testing Library, ESLint | 100% test passing suites with automated GitHub Actions CI |

---

## ⚡ Quickstart & Local Development

### Prerequisites
- **Node.js**: v20 or higher
- **npm**: v10 or higher
- **Firebase Project**: With Authentication and Cloud Firestore enabled
- **AI API Key**: `GEMINI_API_KEY` (required) and/or `GROQ_API_KEY` (recommended)

### 1. Clone Repository
```bash
git clone https://github.com/AltamashAhmad/one-point-interview-ai.git
cd one-point-interview-ai
```

### 2. Configure Backend
```bash
cd backend
npm install

# Create environment configuration
cp .env.example .env
```

Edit `backend/.env` with your credentials:
```env
PORT=8080
FIREBASE_PROJECT_ID=your-project-id
FIREBASE_CLIENT_EMAIL=firebase-adminsdk@your-project.iam.gserviceaccount.com
FIREBASE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----\n"
GEMINI_API_KEY=your-gemini-api-key
GROQ_API_KEY=your-groq-api-key
ALLOWED_ORIGINS=http://localhost:3001,http://localhost:3000
SKIP_APP_CHECK=true
```

### 3. Configure Frontend
```bash
cd ../frontend
npm install

# Create environment configuration
cp .env.example .env
```

Edit `frontend/.env`:
```env
REACT_APP_BACKEND_URL=http://localhost:8080
REACT_APP_FIREBASE_API_KEY=your-firebase-web-api-key
REACT_APP_FIREBASE_AUTH_DOMAIN=your-project-id.firebaseapp.com
REACT_APP_FIREBASE_PROJECT_ID=your-project-id
REACT_APP_FIREBASE_STORAGE_BUCKET=your-project-id.appspot.com
REACT_APP_FIREBASE_MESSAGING_SENDER_ID=your-sender-id
REACT_APP_FIREBASE_APP_ID=your-app-id
REACT_APP_RECAPTCHA_SITE_KEY=your-recaptcha-site-key
```

### 4. Launch Development Servers
```bash
# Terminal 1 — Backend (API on http://localhost:8080)
cd backend && npm start

# Terminal 2 — Frontend (App on http://localhost:3001)
cd frontend && npm run dev -- --port 3001 --strictPort
```

Open **`http://localhost:3001`** in your browser.

---

## 🧪 Automated Testing & Quality Verification

All PRs and commits are validated against strict automated quality pipelines:

```bash
# ── Backend Tests (Jest) ───────────────────────────────────
cd backend && npm test
# Output: 14 test suites passed, 166 tests passed (100%)

# ── Frontend Tests (Vitest) ────────────────────────────────
cd frontend && npm test
# Output: 33 test files passed, 179 tests passed (100%)

# ── Frontend Linter (ESLint) ───────────────────────────────
cd frontend && npm run lint
# Output: 0 errors, 0 warnings

# ── Production Build & Gzip Size Budget Check ──────────────
cd frontend && npm run build && npm run check:size
# Output: startup JavaScript: 130.6 KB gzip (< 150 KB budget)
```

---

## 📡 API Reference Overview

| Method | Endpoint | Description | Auth Required |
|---|---|---|:---:|
| `GET` | `/api/health` | Service liveness probe | No |
| `GET` | `/api/health/ready` | Service readiness probe (verifies Firestore) | No |
| `GET` | `/api/meta` | Live model catalogue, availability, and RPM/RPD | No |
| `GET` | `/api/public/status` | Public platform settings (signup status) | No |
| `GET` | `/api/questions/companies` | List of 200+ companies for autocomplete | Yes |
| `GET` | `/api/sessions` | List candidate sessions with filters | Yes |
| `POST` | `/api/sessions` | Create a new interview or tutor session | Yes |
| `GET` | `/api/sessions/:id` | Fetch full session transcript and state | Yes |
| `POST` | `/api/sessions/:id/turns` | Send message and receive SSE response stream | Yes |
| `POST` | `/api/sessions/:id/code-review` | Submit code for line-by-line review | Yes |
| `POST` | `/api/sessions/:id/end` | Conclude session and generate AI scorecard | Yes |
| `POST` | `/api/sessions/:id/notes` | Generate personalized Markdown revision notes | Yes |
| `GET` | `/api/tracker/:sheetId` | Fetch user progress on DSA sheets | Yes |
| `PUT` | `/api/tracker/:sheetId` | Update problem done/starred/notes status | Yes |
| `GET` | `/api/loops` | List 4-round company interview loops | Yes |
| `POST` | `/api/loops` | Initialize a new 4-round onsite loop | Yes |

---

## 🔒 Security & Responsible Disclosure

We enforce responsible security practices. Read our full policy in [SECURITY.md](SECURITY.md).
- To report a vulnerability, please use [GitHub Security Advisories](https://github.com/AltamashAhmad/one-point-interview-ai/security/advisories/new) or contact **altamashahmadajaz2@gmail.com**.
- Production builds contain zero API keys or secrets (`check-secrets` pipeline verified).

---

## 🤝 Contributing

We welcome contributions from engineers worldwide! Please review our [Contributing Guide](CONTRIBUTING.md) and [Code of Conduct](CODE_OF_CONDUCT.md) before opening a pull request.

---

## 📄 License

OnePoint Interview AI is open-source software licensed under the [MIT License](LICENSE).

<div align="center">
<sub>Crafted with precision for engineers striving for excellence in technical interviews.</sub>
</div>
