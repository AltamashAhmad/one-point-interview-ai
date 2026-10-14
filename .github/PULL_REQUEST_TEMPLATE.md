## What and why

<!-- One or two sentences: what changes and what problem it solves. -->

## How it was verified

- [ ] `npm run lint`, `npm test`, `npm run build`, `npm run check:size` pass in `frontend/`
- [ ] `npm test` passes in `backend/`
- [ ] Checked in the browser (UI changes), including mobile width and dark theme

## Risk

- [ ] No secrets, `.env` files or logs are included
- [ ] Touches `backend/` (merging to `main` deploys to production)
- [ ] Changes Firestore rules or indexes (deploy those separately)
