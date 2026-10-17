# AegisAI Architecture

Sources: `prd-aegisai.md` (PRD), `tech-stack-aegisai-mern.md` (TECH_STACK), `security-aegisai.md` (SECURITY). Where this file and those disagree, they win. Everything below the "Status" section is the Stage 2 target, not what exists today.

## 1. Status

| Part | State |
| --- | --- |
| React single-page app at repository root (`src/`; Vite, React 19, Tailwind 4, React Router, Recharts) | Built (Stage 1), runs on mock data |
| `packages/shared` (TypeScript enums, types and Zod schemas) | Implemented; shared package is an npm workspace |
| `apps/api` (TypeScript, Mongoose models, DB scripts, audit service) | Partial foundation implemented; API is an npm workspace |
| Express server, authentication and role middleware | Implemented; auth, Tool Registry, Requests, Audit, Dashboard, Settings and Users routes are available, remaining domain routes are pending |
| Audit persistence service and tests | Implemented; MongoDB-backed append/hash-chain logic is present |
| External integrations | Proposed (Stage 3); not implemented |

The current repository is a root-level Vite frontend plus `apps/api` and `packages/shared`; the frontend has not moved into `apps/web`. The API has Mongoose models, connection and maintenance scripts, an audit service, authentication routes, Tool Registry and Requests routes, audit listing/export/verification, a database-backed Dashboard API, and Admin-only Settings and Users routes. Stage 2 continues with the remaining domain routes and frontend wiring.

## 2. Project structure

Proposed monorepo (npm workspaces); the current Vite app moves into `apps/web`.

```
aegisai/
  apps/web             Vite app (existing)
    src/pages          Overview, Tool Registry, Policy Matrix, Risk Assessments,
                       Employee Checker, Audit Log, Settings
    src/api            typed API client and TanStack Query hooks
  apps/api             Express 5 + Mongoose, TypeScript
    src/routes         one router per module
    src/models         Mongoose schemas
    src/middleware     auth, roles, validation, errors
    src/services       scoring, policy resolver, audit chain
  packages/shared      Zod schemas, enums, inferred types, pure functions
  docker-compose.yml   API + MongoDB for local development
```

`packages/shared` holds the enums already in the mock data (approval status, risk level, data sensitivity, audit event types and severities) and the compliance-score formula and policy resolver, so the browser, the API and the tests use the same code.

## 3. Frontend and backend flow

```
Browser (React SPA)
   |  TanStack Query hooks in src/api  (replace direct mock-data imports)
   v
/api/v1  (Express 5)
   1. auth middleware      loads user and role from the session cookie
   2. role-check           per-route allow or deny (deny by default)
   3. Zod validation       shared schemas; unknown fields rejected
   4. service layer        object-level checks, scoring, policy resolution
   5. Mongoose             reads and writes MongoDB
   6. audit service        every write also appends an audit event,
                           in the same transaction
```

- The frontend never talks to the database. Dashboard KPIs and chart data are calculated on the server (`GET /dashboard`), not hard-coded as in Stage 1.
- Roles are enforced on the server for every request; hiding a button in the UI is not a control.
- Errors use one shape: status code, short code string, human-readable message.

## 4. Database

MongoDB Atlas with Mongoose. One collection per entity; related documents hold ObjectId references.

| Collection | Holds |
| --- | --- |
| users | name, email, department, role, password hash |
| tools | the AiTool fields from the mock data (status, risk level, owner department, data sensitivity, user count, compliance score, last reviewed) |
| policies | tool category, department, sensitivity tier, verdict (Allowed, Conditional, Blocked), conditions, version, effective date |
| assessments | framework, answers (nested), risk level, score, assessor, status, review date |
| requests | use case, data types, status, reviewer, timestamps |
| auditEvents | event type, severity, details, actor, sequence number, hash, previous hash |

**Audit log.** Insert-only and hash-chained: each event's hash covers its sequence number, its canonical content and the previous hash. One service function is the only writer; it runs in a transaction (MongoDB runs as a replica set), increments a sequence counter, computes the hash and inserts. The API's database user has `find` and `insert` on `auditEvents` only. A verify endpoint and a nightly job recompute the chain. The log is tamper-evident, not tamper-proof; publishing the latest hash outside the database is the proposed mitigation.

**Rules.** Timestamps are UTC dates; automated actors are system users with role `system`; derived values (compliance score, dashboard counts) are computed, not stored by hand.

## 5. APIs

REST under `/api/v1`, JSON in and out, one router per module. Route names are a proposal in TECH_STACK.

| Module | Endpoints | Who |
| --- | --- | --- |
| Auth | POST /auth/login, /auth/refresh, /auth/logout; GET /auth/me | Anyone / signed in |
| Registry | GET /tools; POST /tools; PATCH /tools/:id; POST /tools/:id/decision | Admin, Compliance (read also Requester, Auditor) |
| Requests | POST /requests; GET /requests; PATCH /requests/:id | POST: Requester, Admin, Compliance; GET: Requester (own), Admin, Compliance, Auditor; PATCH: Admin, Compliance |
| Policy | GET /policies; PUT /policies/:id | Admin changes; others read |
| Assessments | GET /tools/:id/assessments; POST /assessments | Admin, Compliance |
| Checker | POST /checker | All signed-in roles |
| Audit | GET /audit; GET /audit/export (CSV); GET /audit/verify | Admin, Compliance, Auditor (verify: Admin, Auditor) |
| Dashboard | GET /dashboard | Admin, Compliance, Auditor |
| Settings | GET /settings; PATCH /settings | Admin; secret values are write-only |
| Users | GET /users; POST /users; PATCH /users/:id | Admin; password accepted only at creation |

List endpoints take `page`, `limit`, `sort` and filters and return a total count. A `/health` endpoint exists for host uptime checks. An OpenAPI file generated from the Zod schemas documents the routes.

## 6. Authentication and authorization

- **Login:** email and password (argon2id, or bcrypt). No open self-registration; accounts are created by an Admin.
- **Session:** short-lived access token (about 15 minutes) and refresh token (about 7 days) in httpOnly, `Secure`, `SameSite` cookies. Refresh tokens rotate on use and are stored hashed; reuse revokes the token family.
- **CSRF:** SameSite plus a CSRF token or required custom header on state-changing requests.
- **Limits:** rate limiting and lockout on login; rate limiting on the checker.
- **Roles:** Admin, Compliance, Requester, Employee, Auditor (read-only). Permission matrix is in TECH_STACK section 5. Object-level rules apply (a Requester sees only their own requests).
- **API hardening:** `helmet`, CORS allow-list limited to the web app's origin, Zod validation on every body, query and parameter, NoSQL operator keys rejected.
- **Later:** OIDC or SAML single sign-on (Stage 3, FR-2). MFA for Admin and Compliance is planned; timing (first pilot or wider release) is an open question in SECURITY.

## 7. Integrations

| Integration | Purpose | Stage |
| --- | --- | --- |
| Email (Nodemailer, SMTP) and Slack incoming webhooks | Escalations, overdue reviews, alerts (FR-21) | P1 |
| MongoDB GridFS | Assessment evidence files (FR-12) | P1 |
| node-cron (Agenda later) | Overdue-review flags, reminders, nightly chain verification | MVP |
| Sentry, pino | Error tracking (optional) and structured logs | MVP |
| OIDC or SAML provider | Single sign-on | Stage 3 |
| Discovery of unregistered AI tools (browser-extension or network logs) | FR-22 | Stage 3 |
| Proxy, SSO app catalog or DLP tool (block lists) | FR-23 | Stage 3 |
| S3-compatible storage | Evidence files at scale | Later |

Webhook URLs are admin-configured: allow-list hosts, block private address ranges, set short timeouts.

## 8. Deployment

| Environment | Web app | API | Database |
| --- | --- | --- | --- |
| Local | Vite dev server | Docker Compose | MongoDB container (single-node replica set) |
| Staging | Vercel or Netlify preview | Render or Railway | Atlas free cluster |
| Production | Vercel or Netlify | Render or Railway | Atlas paid cluster with backups |

Secrets come from environment variables validated at start-up; `.env.example` lists names only. CI (GitHub Actions) runs lint, type check, tests and build on every pull request.

## 9. Out of scope for the MVP

Governing models a company builds itself, real-time prompt or network blocking (DLP), repository scanning, and a mobile app. Multi-tenancy is not assumed: one organization per deployment, pending the author's decision.
