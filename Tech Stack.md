# Tech Stack - AegisAI (MERN)

Oct 14, 2026 · Shreyaas Gupta

## 1. Summary

AegisAI Stage 2 runs on the MERN stack in TypeScript: MongoDB Atlas for data, an Express 5 API on Node.js, and the existing React 19 + Vite frontend, all in one npm-workspaces monorepo with a shared package for types and validation.

**Key decisions**

1. Keep the frontend stack as it is (React 19, Vite, Tailwind 4, React Router 7, Recharts) and replace the mock-data imports with an API client.
2. Use TypeScript everywhere, with Zod schemas in one shared package so the browser and the API validate the same shapes.
3. Store the audit trail in its own insert-only collection with a hash chain, because the product claims a tamper-evident log.
4. Start with email and password login and role checks; add OIDC or SAML single sign-on in Stage 3.
5. Host on free or low-cost tiers (Vercel or Netlify, Render or Railway, MongoDB Atlas), which is enough for a pilot.

This document expands section 9 of the PRD.

## 2. Stack at a glance

| Layer | Choice | Why |
| --- | --- | --- |
| Database | MongoDB Atlas with the Mongoose ODM | Questionnaire answers differ by framework, which suits flexible documents; Atlas has a free tier for development |
| API | Node.js (current LTS), Express 5, TypeScript | Same language as the frontend; Express is the best-documented option |
| Validation | Zod, shared with the frontend | One schema checks form input in the browser and requests on the server |
| Auth | Email and password (argon2 or bcrypt); short-lived JWT access token plus refresh token in httpOnly cookies; role-check middleware | Covers FR-1; OIDC or SAML follows later (FR-2) |
| API hardening | helmet, CORS allow-list, express-rate-limit | Baseline for an OWASP Top 10 review |
| Frontend | React 19, Vite, Tailwind 4, React Router 7, Recharts, Lucide | Already in the repo; keep |
| Server state and forms | TanStack Query, React Hook Form with the Zod resolver | Replaces direct mock-data imports; gives loading and error states |
| Audit store | Separate auditEvents collection, insert-only database role, SHA-256 hash chain | Covers FR-15 and FR-17 |
| Background jobs | node-cron for the MVP; Agenda later | Overdue-review flags and reminders (FR-7, FR-21) |
| Notifications | Nodemailer for email; Slack incoming webhooks | FR-21 |
| Evidence files | MongoDB GridFS for the MVP; S3-compatible storage later | FR-12 without another service to run |
| Exports | CSV generated on the server; print stylesheet for PDF | FR-16 |
| Logging | pino; Sentry optional | Structured logs for debugging |
| Testing | Vitest, React Testing Library, Supertest, mongodb-memory-server, Playwright | See section 8 |
| Tooling and CI | npm workspaces, Oxlint, GitHub Actions | Oxlint is already in the repo |
| Local development | Docker Compose with the API and MongoDB | One command to start |
| Hosting | Vercel or Netlify (web), Render or Railway (API), MongoDB Atlas (data) | Free or low-cost tiers suit a pilot |

## 3. Repository layout and shared code

Move the current Vite app into a monorepo so the API and the frontend share one source of truth for types and validation.

```
aegisai/
  apps/web            the existing Vite app, moved here
    src/pages         Overview, Tool Registry, Policy Matrix, ...
    src/api           typed API client and TanStack Query hooks
  apps/api            Express + Mongoose
    src/routes        one router per module
    src/models        Mongoose schemas
    src/middleware    auth, roles, validation, errors
    src/services      scoring, policy resolver, audit chain
  packages/shared     Zod schemas, enums, inferred types
  docker-compose.yml
  package.json        npm workspaces
```

**What goes in `packages/shared`**

- Enums already present in the mock data: approval status (Approved, Pending Review, Restricted), risk level (Low, Medium, High), data sensitivity (Internal Only, Confidential, Restricted), audit event types and severities.
- Zod schemas for tool, policy, assessment, request and user payloads. The API validates requests with them; the frontend forms reuse them.
- Pure functions with no framework code, such as the compliance-score formula and the policy resolver, so both sides and the tests can call them.

**Frontend change:** replace `import { mockAiTools } from "../data/mockData"` in each page with a query hook from `src/api`. The dashboard metrics function `getGovernanceMetrics` moves to the API as an aggregation, so the numbers are calculated on the server.

## 4. Data layer: MongoDB collections

Each entity from section 8 of the PRD becomes one collection. Related documents hold ObjectId references, not copies, so a tool renamed once is renamed everywhere.

| Collection | Holds | References | Suggested indexes |
| --- | --- | --- | --- |
| users | name, email, department, role, password hash | none | unique email |
| tools | the AiTool fields from the mock data | ownerDepartment by name | text index on name, vendor, description; compound on approvalStatus and riskLevel |
| policies | tool category, department, sensitivity tier, verdict, conditions, version, effective date | none | compound on category, department, tier; effective date |
| assessments | framework, answers (nested), risk level, score, assessor, status, review date | tool, assessor | toolId; review date |
| requests | use case, data types, status, reviewer, timestamps | tool, requester, reviewer | status; requester |
| auditEvents | event type, severity, details, actor, hash, previous hash, sequence number | tool, actor | unique sequence number; toolId with time; event type |

**Modelling rules**

- Store timestamps as UTC dates. The mock strings such as "12 mins ago" are computed in the UI from the stored date.
- Automated actors (the mock "Automated Scanner") are system users with a role of `system`, not free-text names.
- Keep assessment answers as a nested array so each framework's questionnaire can change without a migration.
- Derived values, such as compliance score and the dashboard counts, are calculated by the shared scoring function or an aggregation, not typed in by hand.
- Turn on Mongoose `strict` mode and validate every write with the shared Zod schema before it reaches the model.

## 5. Authentication, roles and API security

Roles are enforced on the server for every request; hiding a button in the UI is never the control.

**Login flow**

1. The user signs in with email and password; the API checks the argon2 or bcrypt hash.
2. The API sets a short-lived access token and a longer-lived refresh token as httpOnly, secure, SameSite cookies, so scripts in the page cannot read them.
3. Each request passes through auth middleware, which loads the user and attaches the role.
4. A role-check middleware per route allows or rejects the call, and the rejection is written to the audit log for privileged actions.

**Role permissions (proposed)**

| Action | Admin | Compliance | Requester | Employee | Auditor |
| --- | --- | --- | --- | --- | --- |
| View registry and dashboard | Yes | Yes | Yes | No | Yes |
| Create or edit a tool | Yes | Yes | Request only | No | No |
| Approve, restrict or revoke | Yes | Yes | No | No | No |
| Edit policy matrix | Yes | Propose | No | No | No |
| Complete a risk assessment | Yes | Yes | No | No | No |
| Use employee checker | Yes | Yes | Yes | Yes | Yes |
| Read and export audit log | Yes | Yes | Own requests | No | Yes |
| Manage users and settings | Yes | No | No | No | No |

**Baseline hardening**

- `helmet` for security headers; CORS limited to the web app's origin; `express-rate-limit` on login and the checker.
- Zod validation on every body, query and parameter; reject unknown fields.
- Escape or reject MongoDB operator keys such as `$where` in user input, for example with `express-mongo-sanitize` or by validating strictly with Zod.
- Secrets only in environment variables, checked at start-up with a Zod schema; never committed.
- Do not log passwords, tokens or full request bodies.
- Never store employee prompts or file contents; the product records tool metadata and decisions only.

## 6. Tamper-evident audit log

Every state change writes one audit event, and each event carries a hash of the one before it, so editing or deleting an old row breaks every hash after it.

```
h_n = SHA256( n || canonical(event_n) || h_(n-1) )
```

**Append procedure** (one service function, the only code path that writes `auditEvents`)

1. Start a transaction (Atlas runs as a replica set, so transactions are available).
2. Increment a sequence counter with `findOneAndUpdate` to get the next number n.
3. Read the previous event's hash; for the first event use a fixed genesis value.
4. Build the canonical JSON of the event (fixed key order, UTC timestamp), compute the hash, and insert the event with n, the hash and the previous hash.
5. Commit. If any step fails, nothing is written and the original action is rolled back too.

**Making it insert-only**

- Create a MongoDB custom role for the API's database user that can `find` and `insert` on `auditEvents` but has no `update` or `remove` privilege.
- Expose no update or delete route for audit events in the API.

**Verifying**

- An admin or auditor endpoint walks the chain from the first event, recomputes each hash and reports the first mismatch.
- A nightly job runs the same check and raises an escalation event if it fails.

**Limit to state honestly:** someone with full database admin rights could rewrite the whole chain consistently. To cover that, publish the latest hash somewhere outside the database on a schedule (for example, email it to the auditor role), so a rewrite no longer matches the earlier copy.

## 7. API surface

A REST API under `/api/v1`, one router per module, JSON in and out. The route names are a proposal; the roles follow section 5.

| Module | Endpoint | Purpose | Who |
| --- | --- | --- | --- |
| Auth | POST /auth/login, /auth/refresh, /auth/logout | Session handling | Anyone |
| Auth | GET /auth/me | Current user and role | Signed in |
| Registry | GET /tools | List with filters and search | Admin, Compliance, Requester, Auditor |
| Registry | POST /tools, PATCH /tools/:id | Create or edit a tool | Admin, Compliance |
| Registry | POST /tools/:id/decision | Approve, restrict, reject or revoke | Admin, Compliance |
| Requests | POST /requests, GET /requests | Submit and track a tool request | Requester and up |
| Policy | GET /policies, PUT /policies/:id | Read and change matrix cells | Admin (change), others read |
| Assessments | GET /tools/:id/assessments, POST /assessments | Run and store a risk assessment | Admin, Compliance |
| Checker | POST /checker | Verdict for a tool, department and data type | All signed-in roles |
| Audit | GET /audit, GET /audit/export | Filtered log and CSV export | Admin, Compliance, Auditor |
| Audit | GET /audit/verify | Recompute and check the hash chain | Admin, Auditor |
| Dashboard | GET /dashboard | KPIs and chart data, calculated server-side | Admin, Compliance, Auditor |
| Settings | GET /settings, PATCH /settings | Departments, tiers, framework toggles, score weights | Admin |
| Users | GET /users, POST /users, PATCH /users/:id | Manage accounts and roles | Admin |

**Conventions**

- List endpoints take `page`, `limit`, `sort` and filter parameters, and return a total count.
- Errors use one shape: a status code, a short code string and a human-readable message.
- Every write endpoint calls the audit service in the same transaction as the change.
- Document the routes with an OpenAPI file generated from the Zod schemas, so the frontend client types stay in sync.

## 8. Testing, CI and quality gates

Test the parts that would damage trust if wrong first: the scoring formula, the policy resolver, role checks and the audit chain.

| Level | Tools | What to cover first |
| --- | --- | --- |
| Unit (shared) | Vitest | Compliance-score formula, policy resolver, hash-chain function |
| API | Vitest, Supertest, mongodb-memory-server | Every route rejects the wrong role; audit event written for each write; chain verification catches an edited event |
| Frontend | Vitest, React Testing Library | Registry filters, request form validation, employee checker result states |
| End to end | Playwright | A few key flows: sign in, submit a tool, approve it, see it in the audit log |
| Lint and types | Oxlint, TypeScript `tsc --noEmit` | Runs on every pull request |

**GitHub Actions pipeline** (on every pull request and on merge to main)

1. Install with `npm ci`.
2. Run Oxlint and the TypeScript check across all workspaces.
3. Run unit and API tests.
4. Build the web app and the API.
5. On main only: deploy the web app and the API.

**Quality gates**

- A pull request cannot merge if lint, types, tests or the build fail.
- No hard-coded figures in dashboard components; a test renders the dashboard from fixture data and checks the numbers are derived.
- Dependency updates through Dependabot, with `npm audit` in CI so known vulnerable packages are noticed.

## 9. Local development and deployment

**Local development**

- `docker compose up` starts MongoDB (as a single-node replica set, so transactions work) and the API with hot reload; `npm run dev` in `apps/web` starts Vite.
- A seed script loads the six tools and ten audit events from today's mock data, so the dashboard looks the same on day one. Seeded audit events must go through the audit service so the chain is valid.
- A `.env.example` file lists every variable; the API refuses to start if one is missing or malformed.

**Environments and hosting**

| Environment | Web app | API | Database |
| --- | --- | --- | --- |
| Local | Vite dev server | Docker Compose | MongoDB container |
| Staging | Vercel or Netlify preview | Render or Railway | Atlas free cluster |
| Production | Vercel or Netlify | Render or Railway | Atlas paid cluster with backups |

**Environment variables (names only)**

| Variable | Used by | Purpose |
| --- | --- | --- |
| `MONGODB_URI` | API | Database connection |
| `JWT_ACCESS_SECRET`, `JWT_REFRESH_SECRET` | API | Token signing |
| `CLIENT_ORIGIN` | API | CORS allow-list |
| `SMTP_URL`, `SLACK_WEBHOOK_URL` | API | Notifications |
| `VITE_API_URL` | Web | Where the frontend calls the API |

**Operations**

- Production database has automated backups and a database user per environment; the audit-writer user is the insert-only role from section 6.
- Cookies are `secure` in staging and production, so the web app and API should share a parent domain or the API must set `SameSite=None; Secure` deliberately.
- Health endpoint `/health` for the host's uptime checks; pino logs shipped to the host's log viewer.

## 10. Trade-offs and open decisions

**Trade-offs of this stack**

- **MongoDB fits the questionnaires, not the relationships.** Tools, policies, assessments and requests reference each other, which a relational database handles more naturally. The mitigation is ObjectId references, indexes on toolId, and aggregation pipelines for the dashboard.
- **Hash chain needs atomic appends.** That forces transactions, so MongoDB must run as a replica set locally and in production.
- **JWT cookies across two hosts.** A web app and an API on different domains complicate cookie settings; a shared parent domain or a reverse proxy avoids it.
- **TypeScript adds setup time now** but removes a class of bugs between the mock-shaped data and the real API.
- **node-cron is not durable.** Jobs vanish if the process restarts mid-run; acceptable for reminders, and Agenda replaces it if jobs must survive restarts.

**Decisions for the author**

- [x] TypeScript from day one, or convert later? (Recommended: day one.)
- [x] Express 5 as chosen, or Fastify? Express keeps to the classic MERN stack.
- [x] Mongoose, or the official MongoDB driver with Zod only? (Recommended: Mongoose for schemas and middleware.)
- [x] One organization per deployment for the MVP, or multi-tenancy from the start? Multi-tenancy adds an organizationId to every collection and every query.
- [x] Is the web app and API on one parent domain, so cookie auth stays simple?
- [ ] Is self-hosted Docker required by any pilot customer, or are managed hosts acceptable?
