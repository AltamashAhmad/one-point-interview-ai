# 9. Feature Tours — DSA Sheet, Loops, Prep Plan, History, Admin

Each of these features is a thinner layer built on top of the same building blocks already explained: sessions
([08](08_interview_session_lifecycle.md)), the tracker collection, or loops
([06](06_database_and_data_model.md)).

## 9.1 The DSA Master Sheet (`pages/DsaSheet.jsx` + `routes/tracker.js`)

A checklist of 322 curated LeetCode problems, grouped into 10 parts (e.g. "Arrays, Hashing & Strings") and
further into patterns (e.g. "1.1 Hashing"). For each problem the user can:

- **Tick it done** (✅), mark it **important**/for revision (⭐), or write a **note** (📝) — each of these is one
  `PUT /api/tracker/dsa-master/items/:itemKey` call, upserting one document in `users/{uid}/tracker/`.
- Click **🤖 Practice** to launch a real mock interview (or tutor lesson) on *that exact problem* — this passes
  `source: { kind: 'sheet', sheetId, problemId }` and `questionTitle` into `POST /api/sessions`, so
  `getQuestion()` is bypassed in favor of the seeded title (see the `seed` field in
  `validateCreate`/`store.create` in [08](08_interview_session_lifecycle.md)).
- Each **pattern section** can also have its own "pattern notes" (a Java template / how to recognize it),
  stored the same way with `itemType: 'section'` and an `itemKey` like `sec:<sectionId>`.
- **Filters** (`⚓ Anchors only`, `⬜ Unsolved`, `✅ Solved`, `⭐ Important`, `📝 With notes`) and a difficulty
  filter/search narrow which problems are shown; matching sections auto-expand when a filter is applied.
- **AI-generated notes**: clicking "Generate with AI" calls `POST
  /api/tracker/:sheetId/items/:itemKey/notes/generate`, which builds a note-writing prompt
  (`services/studyNotes.js`) from the problem/pattern's title and asks the AI gateway directly (not tied to
  any interview session).

The **Prep Plan** page (`pages/PrepPlan.jsx`) reuses the *exact same* tracker API with `sheetId: 'prep-plan'`,
just with a different, calendar-shaped UI (phases → weeks → a daily log of what was studied).

## 9.2 Interview Loops (`pages/LoopDashboard.jsx` + `routes/loops.js` + `services/loops.js`)

Simulates a real "onsite loop" — several interview rounds back to back (e.g. one DSA, one System Design, one
Behavioral). Creating a loop (`POST /api/loops`) stores a `company`, `level`, and an ordered `rounds` array,
each starting `'pending'` except the first, which starts `'in-progress'`.

Starting a round's interview passes `source: { kind: 'loop', loopId, roundIndex }` into `POST /api/sessions`;
`validateCreate` (see [08](08_interview_session_lifecycle.md)) makes sure that round is real, is the *right*
type, and is actually the loop's current open round before allowing it — you can't skip ahead. When that
session is later scored, `applyRoundUpdate` in `services/loops.js` marks the round `passed` or `failed` based
on the score, and **passing** automatically unlocks (`'locked' → 'pending'`) the next round; **failing any
round fails the whole loop**. If the candidate abandons the interview without finishing, the round quietly
reopens (`reopenLoopRound`) so it can be retried.

## 9.3 History & scorecards (`pages/History.jsx`, `HistoryDetail.jsx`, `Scorecard.jsx`)

`History.jsx` calls `listSessions()` (no filters) once, then **groups the results client-side** by interview
type (with pinned sessions always shown first), so the whole feature needs only one backend round trip.
Clicking a card that already has a scorecard opens `Scorecard.jsx` (`GET /api/sessions/:id`, rendering the
`scorecard` fields); clicking one that's still in progress resumes the `Interview.jsx` chat instead. A
finished session's full chat transcript plus generate/read AI revision notes live behind tabs on
`HistoryDetail.jsx`.

## 9.4 Access requests (`pages/AccessWall.jsx` + `routes/access.js`)

When a `PENDING` user has used up their free trial, they see a form (`POST /api/access/request`) asking why
they want access; this creates one `accessRequests/{id}` document and (via `services/emailService.js`) emails
the admin so they can act quickly, and links `accessRequestId` back onto the user's own profile so
`GET /api/access/status` can show "your request is pending" instead of the form again.

## 9.5 The Admin panel (`pages/Admin.jsx` + `routes/admin.js`)

Everything here requires both a valid login and `requireAdmin` (see
[05](05_authentication_and_access_control.md)). Four tabs, one Firestore-backed feature each:

| Tab | What it does | Key endpoints |
|---|---|---|
| **Dashboard** | Platform-wide counts (total/pending/approved/banned users, pending requests, total AI calls). | `GET /api/admin/stats` |
| **Requests** | Approve or deny pending access requests (sends the user an email either way, and on approval flips their `status` to `APPROVED`). | `GET /api/admin/requests`, `PUT /:id/approve`, `PUT /:id/deny` |
| **Users** | Search/list every user; promote/demote admin, ban/unban, suspend/lift, grant/revoke `isUnlimited`, manually set or reset a daily quota, or **permanently delete** a user (which also deletes their Firebase Auth account and best-effort cleans up their sessions/loops data). | `GET /api/admin/users`, `PUT /:uid/status`, `PUT /:uid/quota`, `POST /:uid/reset-quota`, `DELETE /:uid` |
| **Settings** | Toggle `allowNewSignups`/`maintenanceMode`, and change the default free-trial/daily limits given to *new* users. | `GET`/`PUT /api/admin/settings` |

Any admin action that changes a specific user's profile also calls `evictCache(uid)` so the change takes
effect on that user's very next request instead of waiting out the 60-second cache window (see
[05](05_authentication_and_access_control.md)); changing platform settings similarly calls
`invalidatePlatformSettings()`.

---
Next: where all of this actually runs → [10_infrastructure_and_deployment.md](10_infrastructure_and_deployment.md)
