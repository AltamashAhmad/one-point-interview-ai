# OnePoint AI — Full System Design Guide

A complete, beginner-friendly explanation of how this platform is built, written so that someone with **zero
prior knowledge** of the codebase can understand it fully.

👉 **Start here:** [00_START_HERE.md](00_START_HERE.md)

## Contents

1. [What Is This Platform?](01_what_is_this_platform.md) — the product, from a user's point of view.
2. [The Big Picture](02_big_picture_architecture.md) — the four main pieces and how they talk to each other.
3. [Frontend Deep Dive](03_frontend_deep_dive.md) — the React app: routing, auth state, API client, pages.
4. [Backend Deep Dive](04_backend_deep_dive.md) — the Express server: middleware chain, every route file.
5. [Authentication & Access Control](05_authentication_and_access_control.md) — login, roles, quotas, bans.
6. [Database & Data Model](06_database_and_data_model.md) — every Firestore collection and field.
7. [AI Integration Explained](07_ai_integration_explained.md) — models, fallback, prompts, scorecards.
8. [Interview Session Lifecycle](08_interview_session_lifecycle.md) — one mock interview, start to scorecard.
9. [Feature Tours](09_feature_tours.md) — DSA Sheet, Interview Loops, Prep Plan, History, Admin panel.
10. [Infrastructure & Deployment](10_infrastructure_and_deployment.md) — Caddy, Amplify, environment config.
11. [Security & Reliability](11_security_and_reliability.md) — how the platform protects and heals itself.
12. [Glossary](12_glossary.md) — every technical term, defined simply.

Every fact in these files was verified directly against the source code in `backend/` and `frontend/` as of
2026-09-29, not guessed or assumed.
