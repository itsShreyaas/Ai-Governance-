# PRD - AegisAI Enterprise AI Tool Governance

Oct 14, 2026 · Shreyaas Gupta

## 1. Overview and vision

AegisAI is a web platform that gives a company one place to register, risk-rate, approve and audit every AI tool its employees use. The repo's own tagline calls it an "Enterprise AI Tool Governance, Policy Enforcement, and Risk Assessment Platform."

**Vision:** no employee uses an AI tool the company hasn't seen, assessed and put a policy around, and any auditor can prove it in minutes.

**Status today:** Stage 1 is a frontend-only React prototype. The Overview dashboard, Tool Registry cards and Audit Log table work on hard-coded mock data for a fictional company ("Acme Global"). Four of seven modules are placeholders marked "Stage 2 Scheduled". There is no backend, login or real data yet.

**This PRD** defines what Stage 2 (a working MVP) and Stage 3 must deliver, based on what the repo already shows.

## 2. Problem statement

Employees adopt AI tools faster than security and legal teams can review them, so company data flows into services nobody has assessed.

- **Shadow AI:** staff paste code, customer data or contracts into unapproved chatbots, browser extensions and image generators.
- **No single inventory:** approvals live in email threads and spreadsheets, so nobody can answer "which AI tools do we use, who owns them, and are they approved?"
- **Unclear rules:** employees don't know whether a given tool is allowed for their department and the sensitivity of the data they handle.
- **Audit pressure:** frameworks such as NIST AI RMF, ISO 42001 and the EU AI Act expect documented risk assessments and evidence of oversight.
- **Slow reviews:** tools wait in a queue with no owner, SLA or visible status.

The mock data in the repo shows exactly these cases: an unapproved browser extension pinging external endpoints, a restricted image tool with a 61% compliance score, and two tools stuck in Pending Review.

## 3. Goals, non-goals and scope

The MVP (Stage 2) succeeds if a real organization can run its AI tool approvals end to end in AegisAI instead of spreadsheets.

**Goals**

1. One searchable registry of every AI tool, with owner, vendor, data sensitivity, risk level and approval status.
2. A repeatable review workflow: submit, assess, approve, restrict or revoke.
3. A policy matrix that says which tool classes are allowed for which department and data tier.
4. A self-service checker so an employee gets an answer in under 30 seconds.
5. A tamper-evident audit trail exportable for auditors.

**Non-goals for the MVP**

- Governing the AI models a company builds itself (model cards, bias testing). AegisAI governs tools people use.
- Real-time blocking of prompts or network traffic (DLP). The MVP records and advises; enforcement integrations come in Stage 3.
- Scanning source-code repositories for AI engineering quality.
- A mobile app.

## 4. Personas

Five roles use the product; the repo's mock audit log already names four of them (InfoSec, Legal and Compliance, department submitters, Chief Compliance Office).

| Persona | Who they are | What they need | Primary modules |
| --- | --- | --- | --- |
| Governance admin | InfoSec or CISO office (mock: Marcus Brody) | Inventory, risk ratings, policy enforcement, revocations | Registry, Policy Matrix, Settings |
| Compliance officer | Legal and Compliance (mock: Elena Rostova) | Framework-mapped assessments, approvals, evidence | Risk Assessments, Audit Log |
| Tool requester | Department lead or engineer (mock: Sarah Chen) | Submit a tool, track its status, know the rules | Registry, Employee Checker |
| Employee | Any staff member | Quick yes/no on whether a tool is allowed for their work | Employee Checker |
| External auditor | Read-only guest | Exportable proof of controls | Audit Log, Overview |

## 5. Current state of the repo

The repo (one commit, about 1,700 lines under `src/`) is a Vite + React 19 single-page app with routing, theming and six dashboard components, but no backend and no persistence.

| Module | Route | Status | Notes |
| --- | --- | --- | --- |
| Overview | / | Built (mock data) | 4 KPI cards, status and risk charts (Recharts), pending-review list, recent activity, print-to-PDF export |
| Tool Registry | /tools | Partly built | Card grid of 6 tools; "Register Tool" button is disabled; no filtering or detail view |
| Audit Log | /audit-log | Partly built | Read-only table of 10 events; export uses window.print() |
| Policy Matrix | /policy-matrix | Placeholder | Describes data tiers, allowable prompts, DLP rules |
| Risk Assessments | /risk-assessments | Placeholder | Describes NIST AI RMF, ISO 42001, EU AI Act assessments |
| Employee Checker | /employee-checker | Placeholder | Describes self-service approval lookup |
| Settings | /settings | Placeholder | Describes SSO, framework mapping, webhooks |

**Also present:** light and dark theme, responsive sidebar and topbar, a search box in the topbar that isn't wired to anything, and sidebar badges (6 tools, 2 assessments, 10 events) that are hard-coded.

**Known gaps to fix in Stage 2:** the README is still the unmodified Vite template; the package name is "proj"; the dashboard's "+2 this month" and "Avg response 1.4d" figures are literal strings, not calculated; the 2 assessments badge has no data behind it; no tests; no TypeScript; there is a single "Initial commit" in history.

## 6. User stories

**Tool requester**

- As a requester, I submit a tool with vendor, use case, data types and user count, so that InfoSec can review it.
- As a requester, I see my request's status and who it is waiting on, so that I'm not chasing people by email.

**Governance admin**

- As an admin, I filter the registry by status, risk, department and sensitivity, so that I can find what needs action.
- As an admin, I restrict or revoke a tool and see which users are affected, so that I can contain a risk quickly.
- As an admin, I define a policy once (for example, "Restricted data may not go to image generators") and see every tool it applies to.

**Compliance officer**

- As a compliance officer, I complete a risk assessment with a questionnaire mapped to NIST AI RMF, ISO 42001 and the EU AI Act, so that the evidence is stored with the tool.
- As a compliance officer, I approve with conditions and set a re-review date, so that approvals don't go stale.

**Employee**

- As an employee, I type a tool name and pick my department and data type, and get Allowed, Allowed with conditions, or Not allowed with the reason.
- As an employee, if the tool isn't registered, I can request it in one click.

**Auditor**

- As an auditor, I export a filtered audit trail with who, what, when and why for every decision, so that I can verify controls without asking engineers.

## 7. Functional requirements

Priority: **P0** = required for the MVP, **P1** = MVP if time allows, **P2** = Stage 3.

| ID | Module | Requirement | Priority |
| --- | --- | --- | --- |
| FR-1 | Auth | Email sign-in with roles: Admin, Compliance, Requester, Employee, Auditor (read-only) | P0 |
| FR-2 | Auth | SSO via SAML or OIDC | P2 |
| FR-3 | Registry | Create, edit and archive a tool with the fields in section 8 | P0 |
| FR-4 | Registry | Search and filter by status, risk, category, department, sensitivity | P0 |
| FR-5 | Registry | Tool detail page: description, owner, assessments, policies, history | P0 |
| FR-6 | Registry | Request workflow: Submitted, In review, Approved, Restricted, Rejected, with a named reviewer | P0 |
| FR-7 | Registry | Review SLA timer and overdue flag (replaces the hard-coded "1.4d") | P1 |
| FR-8 | Policy Matrix | Grid of tool category against department and data sensitivity tier, each cell Allowed, Conditional or Blocked | P0 |
| FR-9 | Policy Matrix | Policy versioning with an effective date and author | P1 |
| FR-10 | Risk Assessments | Questionnaire templates per framework (NIST AI RMF, ISO 42001, EU AI Act risk class) | P0 |
| FR-11 | Risk Assessments | Computed risk level and compliance score from answers, with a documented formula | P0 |
| FR-12 | Risk Assessments | Evidence attachments and a re-review date | P1 |
| FR-13 | Employee Checker | Lookup by tool name, department and data type returning a verdict and reason | P0 |
| FR-14 | Employee Checker | "Not listed? Request it" hand-off into the registry workflow | P0 |
| FR-15 | Audit Log | Append-only record of every create, update, approval, policy change and login | P0 |
| FR-16 | Audit Log | Filter by event type, tool, actor and date; export CSV and PDF | P0 |
| FR-17 | Audit Log | Hash-chained entries so tampering is detectable | P1 |
| FR-18 | Overview | KPIs and charts calculated from live data, not literals | P0 |
| FR-19 | Overview | Global search across tools and policies (the topbar box today does nothing) | P1 |
| FR-20 | Settings | Organization profile, departments, data sensitivity tiers, framework toggles | P0 |
| FR-21 | Settings | Notification webhooks (Slack, email) for escalations and overdue reviews | P1 |
| FR-22 | Discovery | Detect unregistered AI tools from browser-extension or network logs | P2 |
| FR-23 | Enforcement | Push block lists to a proxy, SSO app catalog or DLP tool | P2 |

## 8. Data model

The mock data defines two entities (AI tool, audit event). The MVP needs six, with the first two extended from the existing fields.

| Entity | Key fields | Source |
| --- | --- | --- |
| AiTool | id, name, vendor, category, approvalStatus (Approved, Pending Review, Restricted), riskLevel (Low, Medium, High), ownerDepartment, dataSensitivity (Internal Only, Confidential, Restricted), userCount, complianceScore (0-100), lastReviewed, description | In repo |
| AuditEvent | id, timestamp, eventType (TOOL_SUBMISSION, POLICY_UPDATE, APPROVAL_GRANTED, RISK_ESCALATION, COMPLIANCE_SCAN, ACCESS_REVOCATION), toolId, actor, department, details, severity (info, warning, success, critical) | In repo |
| User | id, name, email, department, role | New |
| Policy | id, toolCategory, department, sensitivityTier, verdict (Allowed, Conditional, Blocked), conditions, version, effectiveFrom | New |
| Assessment | id, toolId, framework, answers, riskLevel, score, assessor, status, reviewDate, evidence | New |
| ToolRequest | id, toolId, requester, useCase, dataTypes, status, reviewer, submittedAt, decidedAt | New |

**Relationships:** a tool has many assessments, requests and audit events; a policy applies to many tools through category; every state change writes one audit event.

**Schema notes:** the mock "timestamp" values are strings like "12 mins ago" and must become UTC timestamps; "Automated Scanner" actors need a system-user record; audit rows are insert-only.

## 9. Architecture and tech stack

Today AegisAI is a browser-only app; Stage 2 puts an API, a database and an insert-only audit store behind it.

```
People: admin, compliance officer, requester, employee, auditor
   |
   v
[BUILT]     React single-page app
            React 19, Vite, Tailwind 4, React Router, Recharts; mock data today
   |
   v
[PROPOSED]  API and authentication
            Role-based access, registry, policy, assessment and audit endpoints, scoring
   |
   +------------------------+---------------------------+
   v                        v                           v
[PROPOSED] Database    [PROPOSED] Audit store     [STAGE 3] Integrations
 tools, users,          insert-only, hash-chained   Slack and email webhooks,
 policies, assessments, one event per state change  SSO, proxy and DLP hooks
 requests
```

The frontend should stop importing mock data directly and call a data-access layer, so the pages don't change when the API arrives.

**Recommended MERN stack for Stage 2**

| Layer | Choice | Why |
| --- | --- | --- |
| Database | MongoDB Atlas with the Mongoose ODM | Questionnaire answers differ by framework, which suits flexible documents; Atlas has a free tier for development |
| API | Node.js (current LTS), Express 5, TypeScript | Same language as the frontend; Express is the "E" in MERN and the best documented option |
| Validation | Zod, shared with the frontend | One schema checks form input in the browser and requests on the server |
| Auth | Email and password (argon2 or bcrypt); short-lived JWT access token plus refresh token in httpOnly cookies; role-check middleware | Covers FR-1; OIDC or SAML can follow later (FR-2) |
| API hardening | helmet, CORS allow-list, express-rate-limit | Baseline for the OWASP review in section 10 |
| Frontend | React 19, Vite, Tailwind 4, React Router 7, Recharts, Lucide | Already in the repo; keep |
| Server state and forms | TanStack Query, React Hook Form with the Zod resolver | Replaces the direct mock-data imports and gives loading and error states |
| Language | TypeScript in web, API and shared code | Catches shape mismatches between the mock data and the real API early |
| Audit store | Separate auditEvents collection, insert-only database role, SHA-256 hash chain | Covers FR-15 and FR-17: the app's database user can insert and read but not update or delete |
| Background jobs | node-cron for the MVP; Agenda later (it stores jobs in MongoDB) | Overdue-review flags and reminders (FR-7, FR-21) |
| Notifications | Nodemailer for email; Slack incoming webhooks | FR-21 |
| Evidence files | MongoDB GridFS for the MVP; S3-compatible storage later | FR-12 without running another service |
| Exports | CSV generated on the server; print stylesheet for PDF | FR-16; the current window.print() approach carries over |
| Testing | Vitest and React Testing Library (web); Vitest, Supertest and mongodb-memory-server (API); Playwright for a few key flows | Unit tests for scoring and the policy resolver come first |
| Tooling and CI | npm workspaces, Oxlint (already in the repo), GitHub Actions running lint, typecheck, test and build | Every pull request is checked |
| Local development | Docker Compose with the API and MongoDB | One command to start |
| Hosting | Vercel or Netlify for the web app, Render or Railway for the API, MongoDB Atlas for data | Free or low-cost tiers are enough for a pilot |
| Logging | pino; Sentry optional | Structured logs for debugging and audits of the API itself |

**Proposed repository layout**

```
aegisai/
  apps/web          the existing Vite app, moved here
  apps/api          Express + Mongoose
  packages/shared   Zod schemas, enums (status, risk, sensitivity), types
  docker-compose.yml
```

**Trade-offs of using MongoDB for this product**

- **Good fit:** assessment answers vary by framework, so they store naturally as nested documents.
- **Weaker fit:** tools, policies, assessments and requests reference each other. Use ObjectId references and index toolId on assessments, requests and audit events.
- **Hash chain:** appending to the chain must be atomic. Use a sequence counter updated with findOneAndUpdate, or a transaction (Atlas runs as a replica set, so transactions are available).
- **Dashboard queries:** counts by status and risk use aggregation pipelines, which is fine at the expected scale of hundreds of tools.

A fuller version is in the separate file `tech-stack-aegisai-mern.md`.

## 10. Non-functional requirements

A governance tool is only credible if it is itself trustworthy, so security and audit integrity outrank polish.

| Area | Requirement |
| --- | --- |
| Security | Role-based access enforced on the server, not just hidden in the UI; secrets in environment variables; OWASP Top 10 review before launch |
| Audit integrity | Append-only audit store; no update or delete paths; hash chain verifiable from the UI (P1) |
| Privacy | Store tool metadata and assessments only, never employee prompts or file contents; data-processing details documented for DPDP and GDPR review |
| Performance | Dashboard loads in under 2 seconds for 500 tools and 100,000 audit events; employee checker answers in under 1 second |
| Availability | 99.5% monthly target for the MVP; daily database backups |
| Accessibility | WCAG 2.1 AA: keyboard navigation, colour-independent status (not colour alone), contrast in both themes |
| Quality | Unit tests for the scoring formula and policy resolver; component tests for each page; lint (oxlint) and build in CI on every pull request |
| Maintainability | Move to TypeScript before Stage 2 features land; replace mock imports with a data-access layer so pages don't change when the API arrives |
| Portability | Export all data as CSV or JSON so customers aren't locked in |

## 11. Compliance framework mapping

The repo already names NIST AI RMF, ISO 42001 and the EU AI Act. The MVP maps each to a concrete feature rather than just displaying a badge; the exact control wording must be checked by a compliance professional before launch.

| Framework | What it asks of a user organization | AegisAI feature |
| --- | --- | --- |
| NIST AI RMF (Govern, Map, Measure, Manage) | Defined accountability, inventory of AI systems, risk measurement, ongoing monitoring | Registry owners (Govern), tool inventory and context (Map), assessment score (Measure), review dates and escalations (Manage) |
| ISO/IEC 42001 | A documented AI management system with policies, risk assessment and continual improvement | Policy Matrix with versions, assessment records, audit trail |
| EU AI Act | Classify AI use by risk tier; keep records; ensure human oversight and transparency for higher-risk uses | EU risk-class field on each assessment; approval conditions; exportable records |
| India DPDP Act 2023 | Lawful handling of personal data, including when it is sent to third-party processors | Data sensitivity tier and a "personal data" flag on each tool and policy |

**Compliance score:** in the mock data it is a single 0-100 number per tool with no formula. The MVP should define it as a weighted sum of assessment answers, publish the weights in Settings, and show the breakdown so the number can be defended to an auditor.

## 12. Roadmap and milestones

Build the foundation first, because every other module needs login, a database and an audit trail.

| Phase | Name | Scope |
| --- | --- | --- |
| Stage 1 (done) | Prototype | React app, mock data, dashboard, registry cards, audit table |
| Stage 2a | Foundation | TypeScript, API, database, login, live registry, audit log, live KPIs |
| Stage 2b | Governance core | Policy matrix, risk assessments, employee checker, audit export |
| Stage 3 | Scale | SSO, discovery, enforcement, alerts, multi-tenancy |

**Gates**

1. Before Stage 2a: a pilot organization is identified.
2. Between Stage 2a and 2b: live registry with login and audit log.
3. Between Stage 2b and Stage 3: a pilot organization runs its approvals in AegisAI.

Gates are exit criteria, not dates. Set dates once you confirm your weekly hours and deadline (section 15).

**Proposed build order inside Stage 2b**

1. Policy Matrix, because the checker and the assessments both read from it.
2. Employee Checker, the fastest demo and the best test of the matrix.
3. Risk Assessments with the scoring formula (FR-10, FR-11).
4. Audit export and the hash chain (FR-16, FR-17).

If time runs short, cut P1 items first and keep every P0 item in section 7.

## 13. Success metrics

The MVP is a success if a pilot organization moves its AI approvals into AegisAI and trusts the numbers. Targets below are proposals for the author to confirm.

| Metric | Definition | MVP target |
| --- | --- | --- |
| Inventory coverage | Registered tools / tools found by a manual audit | 90% or more |
| Median review time | Submission to decision | 5 working days or less |
| Overdue reviews | Tools past their re-review date | Under 10% |
| Checker usage | Employee checker queries per active employee per month | 0.5 or more |
| Checker accuracy | Verdicts matching the policy owner's judgement in a 50-case test | 95% or more |
| Audit readiness | Time to export a complete trail for one tool | Under 2 minutes |
| Data trust | Dashboard figures that are calculated, not literal | 100% |

## 14. Risks, assumptions and dependencies

| Risk | Likelihood | Impact | Mitigation |
| --- | --- | --- | --- |
| Product stays a demo: no real organization uses it | High | High | Find one pilot (a college club, a startup or a department) before building Stage 2 |
| Scope creep into DLP and network enforcement | High | Medium | Keep enforcement out of the MVP; ship a clean API and integrations in Stage 3 |
| Incumbents already do this (enterprise GRC suites, SaaS-management and AI-governance vendors) | High | Medium | Target small and mid-size teams who can't afford them; compete on setup time and price |
| A wrong "compliant" verdict creates legal exposure | Medium | High | Label scores as decision support, publish the formula, require a human approver |
| Regulations and frameworks change | Medium | Medium | Store framework mappings as editable data, not code |
| Audit trail is tamper-able in a simple CRUD backend | Medium | High | Insert-only table, no delete endpoint, hash chain |
| Solo or small-team capacity | High | Medium | Build in the order in section 12; cut P1 items first |

**Assumptions:** one organization per deployment at first (multi-tenancy later); English-only UI; an admin enters the initial tool list by hand or CSV import.

**Dependencies:** a hosted database and auth provider, an email or Slack service for notifications, and legal review of the assessment questionnaires.

## 15. Open questions for the author

These are the cross-questions the repo cannot answer. Your answers change scope, so please settle the first five before Stage 2 starts.

**Product and market**

- [ ] Who is the first real customer? AegisAI as written targets a large enterprise ("Acme Global"). Is that the real target, or is a lighter version for colleges and startups intended?
- [ ] Why would a company use this instead of a spreadsheet, or a paid tool such as an AI-governance or SaaS-management product? What is the one thing yours does better?
- [ ] Is this a portfolio project, an open-source tool, or a startup? The answer sets how much auth, multi-tenancy and compliance depth is worth building.

**Scope and correctness**

- [ ] How will tools get into the registry: manual entry, CSV import, or automatic discovery (browser extension, SSO logs)? Manual entry alone makes the "100% Tracked" badge a promise you can't keep.
- [ ] Who computes the compliance score and risk level, and from what formula? Today they are typed in by hand.
- [ ] Does AegisAI only record decisions, or should it enforce them (block a site, revoke an SSO app)? This decides whether Stage 3 is an integration project.
- [ ] Should risk be per tool, or per tool plus use case? The same tool can be low risk for brainstorming and high risk with customer data.

**Technical**

- [ ] Do you agree with the MERN plan in section 9, with TypeScript from day one and a monorepo with a shared package? Is there a reason to keep plain JavaScript?
- [ ] Is multi-tenancy needed, or one organization per deployment?
- [ ] How will you prove the audit log is tamper-evident, as its page claims?
- [ ] Is the hosting in section 9 (Vercel or Netlify, Render or Railway, MongoDB Atlas) acceptable, or does a pilot customer need self-hosted Docker?

**Delivery**

- [ ] How many hours per week can you give this, and what is the deadline (placements, a hackathon, an open-source programme)? That decides which P0 items are realistic.
- [ ] Which Stage 2 module do you want first: Policy Matrix, Risk Assessments, or the Employee Checker? Section 12 proposes an order, but you may know a better demo story.
