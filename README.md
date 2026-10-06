# RAS Site Safety Forms

Internal-tool style web app for the RAS Junior Developer technical assessment:
framers submit daily safety forms (with photos) and admins review them.

## Features

- **Framer:** log in, fill out the safety form (site, date, checklist, hazards, notes, photos) on a phone or desktop, and see their own submissions.
- **Admin:** today's summary (submissions per site, who has not submitted), a list grouped by site with site/worker/date filters, a detail view with photos, and a "mark as reviewed" action.

## Tech stack

- Frontend: Next.js (App Router, JavaScript) + Tailwind CSS
- Backend: Express (Node.js) with `pg`(PostgreSQL Driver), `bcryptjs`(Password Hashing), `jsonwebtoken`(JWT Authentication), `multer` (File Upload Middleware)
- Database & file storage: Supabase (PostgreSQL + private Storage bucket)
- Auth: JWT (Bearer token) with two roles, `framer` and `admin`

## Project structure

```
frontend/   Next.js app
backend/    Express API (routes, middleware, seed script)
docs/       Database schema (schema.sql) and ERD
```

## Setup

Requires Node 20+ and a Supabase project.

1. In Supabase, run `docs/schema.sql` in the SQL editor and create a **private** Storage bucket (its name goes into `SUPABASE_BUCKET`).
2. Backend:
   ```bash
   cd backend
   cp .env.example .env   # fill in the values
   npm install
   npm run seed           # demo sites, hazards and users
   npm run dev            # http://localhost:4000 (check /health)
   ```
3. Frontend:
   ```bash
   cd frontend
   cp .env.example .env.local   # NEXT_PUBLIC_API_URL=http://localhost:4000
   npm install
   npm run dev                  # http://localhost:3000
   ```

## Test accounts

| Role   | Email            | Password   |
| ------ | ---------------- | ---------- |
| Admin  | admin@ras.test   | Admin123!  |
| Framer | framer1@ras.test | Framer123! |
| Framer | framer2@ras.test | Framer123! |

Demo data only, created by `npm run seed`.
`npm run seed:demo` adds two more framers (`framer3@ras.test`, `framer4@ras.test`, same password).

## Troubleshooting

Most problems come from a wrong value in `backend/.env` or `frontend/.env.local`. After changing an env file, restart the dev server (it does not reload env files). <br> Functions for complex formats include step-by-step code comments with examples (e.g., record.js -> load(), recordList.js -> POST /api/submissions)

| You see | Fix |
| --- | --- |
| Backend exits with `DATABASE_URL is not set` (or `JWT_SECRET`, or `SUPABASE_URL, SUPABASE_SECRET_KEY and SUPABASE_BUCKET must be set`) | `backend/.env` is missing or a value is empty. Copy `.env.example` and fill it in. |
| `/health` returns `"db":"unreachable"` | `DATABASE_URL` is wrong. Use the Supabase **Session pooler** string, replace `[YOUR-PASSWORD]` (brackets included) with the real password, and check that the project is not paused. |
| `relation "..." does not exist` when running `npm run seed` | The tables are missing. Run `docs/schema.sql` in the Supabase SQL editor first. |
| Login shows `Can't reach the server` | The API is not running, or it is waking up (free hosting can take a minute), or `NEXT_PUBLIC_API_URL` is wrong. After changing it, restart or redeploy the frontend. |
| Browser console shows `blocked by CORS policy` | `FRONTEND_URL` in the backend env must be the frontend's address, e.g. `http://localhost:3000`. |
| Login shows `Invalid email or password` | Run `npm run seed`, then use the accounts listed above. |
| Backend log shows `Photo upload failed: Bucket not found` | `SUPABASE_BUCKET` must match the bucket name exactly (case-sensitive). `node scripts/check-storage.js` lists the real names. |
| Photos show `Photo unavailable` (backend log: `Could not create photo links`) | Check `SUPABASE_URL` and `SUPABASE_SECRET_KEY`. |
| Suddenly logged out, or `Invalid or expired token` | The token expired (8 hours) or `JWT_SECRET` was changed. Log in again. |

## Assumptions

- One submission per framer, site and date (unique constraint).
- Submissions cannot be edited once sent (the spec asks to create and view them), so the record stays trustworthy. A framer who needs a correction contacts a supervisor.
- Photos are optional: up to 5 per submission, JPEG/PNG/WebP, 10 MB each. They are checked in the browser and again on the server (by file content), stored in a private bucket and shown through temporary links that expire after 1 hour.
- Status is `submitted` or `reviewed`. An admin marks a submission as reviewed, who reviewed it is not stored.
- "Not submitted today" means active framers with no submission for that date at any site (there are no site assignments). "Today" is the admin's local date.
- Passwords are hashed with bcrypt. The JWT expires after 8 hours and is kept in `localStorage` for simplicity (an httpOnly cookie would be safer against XSS). There are no refresh tokens or token revocation.
- A framer can only open their own submissions; someone else's returns "not found". The admin list shows at most 500 rows (no pagination).
- On free hosting the API may sleep when idle, so the first request after a pause can take up to a minute.

## Database

![ERD](docs/erd.png)

- `users` 1-N `submissions`, `sites` 1-N `submissions`, `submissions` 1-N `photos`
- `submissions` N-M `hazards` through `submissions_hazards`
- Photo files live in the private Storage bucket; `photos` only stores their path.
- Also enforced: one submission per user, site and date; `role` is `framer` or `admin`; `status` is `submitted` or `reviewed`.

The full schema is in `docs/schema.sql`.

## Links

- Live app: https://ras-jd-assessment.vercel.app
