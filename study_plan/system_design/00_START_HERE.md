# Start Here — How to Read This System Design Guide

Welcome! This folder explains, from the ground up, **how the OnePoint AI interview platform actually works** —
every screen, every server file, every database record. It is written so that someone with **zero prior
knowledge** of this codebase (or even of web development in general) can follow it end to end.

You do not need to already know React, Express, Firestore, or how AI APIs work. Every term is explained the
first time it is used, and a full [Glossary](12_glossary.md) is there if you forget one later.

## How this folder is organized

Read the files **in this order** — each one builds on the last:

| # | File | What you'll learn |
|---|------|--------------------|
| 1 | [01_what_is_this_platform.md](01_what_is_this_platform.md) | What the product actually *does*, from a user's point of view — no code yet. |
| 2 | [02_big_picture_architecture.md](02_big_picture_architecture.md) | The three big pieces (browser, server, database) and how they talk to each other. |
| 3 | [03_frontend_deep_dive.md](03_frontend_deep_dive.md) | The React app: pages, routing, login state, the API client. |
| 4 | [04_backend_deep_dive.md](04_backend_deep_dive.md) | The Express server: how a request travels through it, every route file. |
| 5 | [05_authentication_and_access_control.md](05_authentication_and_access_control.md) | How login works, and how the platform decides who is allowed to do what. |
| 6 | [06_database_and_data_model.md](06_database_and_data_model.md) | Every place data is stored, and exactly what's in each record. |
| 7 | [07_ai_integration_explained.md](07_ai_integration_explained.md) | How the app talks to Groq / Gemini / OpenRouter, and how it writes the AI's instructions. |
| 8 | [08_interview_session_lifecycle.md](08_interview_session_lifecycle.md) | A single mock interview, traced click-by-click from start to scorecard. |
| 9 | [09_feature_tours.md](09_feature_tours.md) | The DSA sheet, Interview Loops, Prep Plan, History, and Admin panel. |
| 10 | [10_infrastructure_and_deployment.md](10_infrastructure_and_deployment.md) | Where the code actually *runs* — servers, domains, CI. |
| 11 | [11_security_and_reliability.md](11_security_and_reliability.md) | How the platform protects itself and stays up. |
| 12 | [12_glossary.md](12_glossary.md) | Every technical term used in this guide, defined simply. |

## A quick mental model before you dive in

Think of the platform like a restaurant:

- The **frontend** (React app in your browser) is the **dining room** — what the customer sees and interacts with.
- The **backend** (Express server) is the **kitchen** — it takes orders, does the real work, and decides what's allowed.
- **Firestore** (the database) is the **pantry and filing cabinet** — where every order, recipe, and customer record is stored.
- The **AI providers** (Groq, Gemini, OpenRouter) are **guest chefs** the kitchen calls in to actually cook the "interview" and "feedback" dishes — the kitchen just tells them what to make and serves the result.
- **Firebase Auth** is the **doorman** — it checks ID before anyone is let in, but doesn't decide what they can order once inside (that's still the kitchen's job).

Every later file zooms into one of these pieces in detail. Let's start with what the product does:
→ [01_what_is_this_platform.md](01_what_is_this_platform.md)
