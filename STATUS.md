# AegisAI — Project Status

_Last updated: 2026-10-24. Update this file in every PR that changes scope._

**Current stage:** Stage 2a (Foundation), complete
**Rough progress:** 28 of 28 tracked Stage 2a items are complete (100%); ~38% of the full roadmap is complete. The roadmap estimate is weighted by the remaining governance-core and scale work, not just checklist counts.

Legend: `[x]` done · `[ ]` not started · `[~]` partly done

---

## Stage 1 — Prototype (done)
- [x] React 19 + Vite frontend, routing, light/dark theme, responsive layout
- [x] Overview dashboard connected to live dashboard data (2026-10-24)
- [x] Tool Registry page connected to the API with search, filters, detail view and registration (2026-10-24)
- [x] Audit Log page connected to the API with filters, CSV export and hash-chain verification (2026-10-24)
- [x] Placeholder pages: Policy Matrix, Risk Assessments, Employee Checker, Settings

## Stage 2a — Foundation (complete)

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
- [x] Audit events for successful/failed login, unknown and locked-account attempts, and logout (FR-15) (2026-10-24)
- [x] Account lockout after five failures for 15 minutes, with expiry and success reset tests (2026-10-24)

### API endpoints
- [x] Registry: `GET/POST /tools`, `PATCH /tools/:id`, `POST /tools/:id/decision` (FR-3, FR-4, FR-5)
- [x] Requests: `POST/GET /requests`, `PATCH /requests/:id` with reviewer assignment and status flow (FR-6)
- [x] Audit: `GET /audit` with filters, `GET /audit/export` (CSV), `GET /audit/verify` (FR-15, FR-16)
- [x] Dashboard: `GET /dashboard` computed from live data (FR-18)
	- UI contract: response uses `pendingTools`, `statusChartData`, `riskChartData`, `toolsNeedingReview`, and `recentAudits`; recent activity omits mock-only `details`, department, emails, and hashes.
- [x] Settings and Users endpoints (FR-20)
	- Admin-only; Slack/SMTP values are write-only, and user passwords are hashed at creation.
- [x] Pagination (`page`, `limit`, `sort`, total count) on all list endpoints
- [x] Route-level tests for every endpoint, including a role test table (2026-10-24)

### Frontend wiring (complete for Stage 2a)
- [x] Login page and auth context (cookie session, refresh)
- [x] API client layer for auth and dashboard (mock data retained for unconverted pages)
- [x] Live Overview KPIs (remove the literal "+2 this month" and "1.4d") (2026-10-24)
- [x] Live Tool Registry with search, filters, detail view and Register Tool form (2026-10-24)
- [x] Live Audit Log with filters and CSV export (2026-10-24)
- [x] Sidebar badges and topbar search wired to real data (2026-10-24)
- [x] Frontend converted to strict TypeScript; frontend and Vite config are included in typecheck (2026-10-24)

### Tooling
- [x] CI workflow runs lint, typecheck, test and build; Gitleaks scans pushes and pull requests (2026-10-24)
- [x] Seed script refuses production and requires `SEED_ADMIN_PASSWORD`; no seed password is hardcoded (2026-10-24)
- [x] Route pages lazy-loaded; lint and production build complete without the prior effect/chunk-size warnings (2026-10-24)

### Documentation
- [x] Update implementation status, security checklist counts and decided PRD open questions (2026-10-24)

## Stage 2b — Governance core (not started)
Build order from the PRD: 
- [ ] Policy Matrix (FR-8, FR-9)
- [ ] Employee Checker and request hand-off (FR-13, FR-14)
- [ ] Risk Assessments with documented scoring formula (FR-10, FR-11, FR-12)
- [~] CSV export and hash-chain verification UI are complete in Stage 2a; PDF export remains (2026-10-24)

## Stage 3 — Scale (not started)
- [ ] SSO (SAML/OIDC), discovery, enforcement, alerts, multi-tenancy

## Security checklist
`Security.md` tracks 12 pre-pilot (P0) controls and 5 wider-release (P1) controls; its separate 7 open questions are not checklist items.
- Pre-pilot items done: 6 of 12
- Later items done: 0 of 5

---

## Documentation drift resolved
- [x] `README.md` accurately describes the implemented API and auth routes.
- [x] `README.md` describes the strict TypeScript frontend and live Stage 2a pages (2026-10-24).
- [x] `PRD.md` sections 1 and 5 reflect the implemented API and live Overview, Tool Registry, Audit Log, sidebar and search (2026-10-24).
- [x] `ARCHITECTURE.md` documents the implemented server, routes, authentication and role middleware.
- [x] PRD section 15 records decisions already made in `Tech Stack.md` and leaves undecided questions open (2026-10-24).

## Open decisions (from PRD.md and Tech Stack.md)
- [ ] Who is the first real customer (large enterprise vs colleges and startups)?
- [ ] Portfolio project, open-source tool, or startup?
- [ ] How do tools enter the registry: manual entry, CSV import, or discovery?
- [ ] Who computes compliance score and risk level, and from what formula?
- [ ] Does AegisAI record decisions only, or enforce them?
- [ ] Self-hosted Docker required by any pilot, or are managed hosts fine?
- [ ] Weekly hours available and the deadline
