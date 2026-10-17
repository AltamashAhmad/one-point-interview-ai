# Security Policy & Responsible Disclosure

At OnePoint AI, we take security, candidate data privacy, and the integrity of our platform seriously. We are committed to maintaining a safe, resilient environment for all our users.

---

## 🔒 Supported Versions

We actively maintain and provide security patches for the following versions:

| Version | Supported |
|---|---|
| `main` branch (latest production) | ✅ Yes |
| `dev` branch (active development) | ✅ Yes |
| Historical tags / forks | ❌ No |

---

## 🚨 Reporting a Vulnerability

If you discover a security vulnerability, we appreciate your help in disclosing it to us responsibly. **Please do not report security vulnerabilities through public GitHub issues, discussions, or social media.**

### How to Report
1. **GitHub Security Advisory (Preferred)**:
   Navigate to [GitHub Security Advisories](https://github.com/AltamashAhmad/one-point-interview-ai/security/advisories/new) and submit a private report.
2. **Email**:
   Send an encrypted or confidential email to **altamashahmadajaz2@gmail.com** with the subject `[SECURITY VULNERABILITY] OnePoint AI`.

### What to Include in Your Report
To help us triage and resolve the issue quickly, please provide:
- A clear, concise summary of the vulnerability.
- Affected component(s) (e.g., API route, frontend component, authentication flow).
- Step-by-step reproduction instructions or a minimal proof of concept (PoC).
- Potential impact and severity assessment.

### Our Commitment & Response SLA
- **Initial Response**: Within 24 hours of report receipt.
- **Triage & Assessment**: Within 48 hours.
- **Fix & Patch Deployment**: Critical issues are prioritized for immediate hotfix deployment within 72 hours.
- **Public Disclosure**: We coordinate disclosure with you once a fix is verified and deployed.

---

## 🛡️ Built-in Security Architecture

OnePoint AI implements multi-layered defense-in-depth protections:

1. **Authentication & Identity**:
   - Firebase Auth JWT ID tokens verified cryptographically on every protected route.
   - Token revocation checks cached with a strict 5-minute TTL to block compromised or deleted accounts.
2. **Firebase App Check (reCAPTCHA v3)**:
   - All client API calls require cryptographic App Check attestations to prevent automated bot scraping, unauthorized curl requests, and abuse.
3. **Multi-Tier Rate Limiting**:
   - Broad network-level IP limits (150 requests per 15 min via `express-rate-limit`).
   - Per-user AI session generation limits (20 sessions / 15 min) and per-user message turn limits (60 turns / 15 min).
4. **Secret Scanning & Zero-Client Secrets**:
   - Strictly enforced `.gitignore` preventing environment configurations from being committed.
   - No private keys or LLM provider credentials ever bundled into frontend artifacts.
5. **CORS & Network Isolation**:
   - Whitelisted origins only (`main.d369q8sr84jlxa.amplifyapp.com`, `localhost`).
   - Reverse-proxy trusted header handling and strict Content Security Policies.
