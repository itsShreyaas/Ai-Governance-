# AegisAI — Project Status

_Last updated: 2026-10-23. Update this file in every PR that changes scope._

**Current stage:** Stage 2a (Foundation), in progress
**Rough progress:** ~90% of Stage 2a, ~30–35% of the full PRD (2a + 2b + 3). This is an estimate; adjust it as items below are ticked.

Legend: `[x]` done · `[ ]` not started · `[~]` partly done

---

## Stage 1 — Prototype (done)
- [x] React 19 + Vite frontend, routing, light/dark theme, responsive layout
- [x] Overview dashboard (mock data)
- [~] Tool Registry page (6 mock cards; Register button disabled, no filter or detail view)
- [~] Audit Log page (10 mock events; export is `window.print()`)
- [x] Placeholder pages: Policy Matrix, Risk Assessments, Employee Checker, Settings

## Stage 2a — Foundation (in progress)

### Shared package (`packages/shared`)
- [x] Enums, types, Zod schemas (server-controlled fields omitted from input schemas)
- [x] Schema tests

### Data layer (`apps/api`)
- [x] Mongoose models: Tool, Request, Assessment, Policy, Settings, User, RefreshToken, AuditEvent, Counter
- [x] Connection, index script, seed script, `verify-audit` script
- [x] Hash-chained, insert-only `auditService` with tests

### Server and auth (`apps/api`)
- [x] Express app: helmet, CORS allow-list, JSON body limit, pino logging, `/health`, 404 and error handlers
- [x] `POST /auth/login`, `/auth/refresh`, `/auth/logout`, `GET /auth/me`
- [x] Rate limiting, CSRF header check, `requireAuth`, `requireRole`, `validate` middleware
- [x] Auth route tests
- [ ] Audit events written for login, logout and failed login (FR-15)
- [ ] Account lockout against scripted attacks

### API endpoints (not started)
- [x] Registry: `GET/POST /tools`, `PATCH /tools/:id`, `POST /tools/:id/decision` (FR-3, FR-4, FR-5)
- [x] Requests: `POST/GET /requests`, `PATCH /requests/:id` with reviewer assignment and status flow (FR-6)
- [x] Audit: `GET /audit` with filters, `GET /audit/export` (CSV), `GET /audit/verify` (FR-15, FR-16)
- [x] Dashboard: `GET /dashboard` computed from live data (FR-18)
	- UI contract: response uses `pendingTools`, `statusChartData`, `riskChartData`, `toolsNeedingReview`, and `recentAudits`; recent activity omits mock-only `details`, department, emails, and hashes.
- [x] Settings and Users endpoints (FR-20)
	- Admin-only; Slack/SMTP values are write-only, and user passwords are hashed at creation.
- [x] Pagination (`page`, `limit`, `sort`, total count) on all list endpoints
- [ ] Route-level tests for every endpoint, including a role test table

### Frontend wiring (in progress)
- [x] Login page and auth context (cookie session, refresh)
- [x] API client layer for auth and dashboard (mock data retained for unconverted pages)
- [x] Live Overview KPIs (remove the literal "+2 this month" and "1.4d")
- [ ] Live Tool Registry with search, filters, detail view and Register Tool form
- [ ] Live Audit Log with filters and CSV export
- [ ] Sidebar badges and topbar search wired to real data

### Tooling
- [ ] CI workflow (lint, typecheck, test, build) in `.github/workflows`
- [ ] Secret scanning enabled; no default or seed credentials in production
- [ ] Convert frontend to TypeScript (decision in Tech Stack.md: TypeScript from day one)

## Stage 2b — Governance core (not started)
Build order from the PRD: 
- [ ] Policy Matrix (FR-8, FR-9)
- [ ] Employee Checker and request hand-off (FR-13, FR-14)
- [ ] Risk Assessments with documented scoring formula (FR-10, FR-11, FR-12)
- [ ] Audit export (CSV and PDF) and hash-chain verification UI (FR-16, FR-17)

## Stage 3 — Scale (not started)
- [ ] SSO (SAML/OIDC), discovery, enforcement, alerts, multi-tenancy

## Security checklist
The 24-item checklist in `Security.md` is still entirely unticked. Tick items there as they are verified, and summarise counts here.
- Pre-pilot items done: 0 of 12
- Later items done: 0 of 5

---

## Known documentation drift (fix next)
- [x] `README.md` says the API server and auth routes are not implemented. They are.
- [x] `PRD.md` section 1 ("Status today") and section 5 say there is no Express server, login or HTTP API. Auth, registry, request, audit and dashboard routes now exist.
- [x] `ARCHITECTURE.md` says "Express server, HTTP routes, authentication and role middleware: Not implemented yet". Auth, registry, request, audit and dashboard routes now exist.
- [ ] `PRD.md` open questions (section 14 or equivalent) are all unchecked. Record the answers that are already decided (for example, MERN with TypeScript and Mongoose is chosen in `Tech Stack.md`).

## Open decisions (from PRD.md and Tech Stack.md)
- [ ] Who is the first real customer (large enterprise vs colleges and startups)?
- [ ] Portfolio project, open-source tool, or startup?
- [ ] How do tools enter the registry: manual entry, CSV import, or discovery?
- [ ] Who computes compliance score and risk level, and from what formula?
- [ ] Does AegisAI record decisions only, or enforce them?
- [ ] Self-hosted Docker required by any pilot, or are managed hosts fine?
- [ ] Weekly hours available and the deadline
