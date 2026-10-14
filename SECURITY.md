# Security Policy

## Reporting a vulnerability

Please do not open a public issue. Report privately through
[GitHub security advisories](https://github.com/AltamashAhmad/one-point-interview-ai/security/advisories/new)
or email altamashahmadajaz2@gmail.com.

Include the affected area, steps to reproduce, and the impact you expect.

## Supported versions

Only the latest code on `main` is supported.

## Secrets

Never commit `.env` files, service-account JSON files or API keys. If a secret is
exposed, rotate it immediately; removing it from git history is not enough.
