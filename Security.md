# Security Plan - AegisAI

Oct 15, 2026 · Draft for the author to review. Companion to `prd-aegisai.md` and `tech-stack-aegisai-mern.md`.

A governance product that is itself breached or tampered with loses all credibility. This plan lists what must be protected, the threats that matter for AegisAI, and the controls for the MERN stack proposed for Stage 2. Items marked **P0** are required before any real organization uses the product; **P1** are expected before wider release; **P2** are Stage 3.

## 1. Scope and principles

**In scope:** the React web app, the Express API, the MongoDB database, the audit log, file evidence, notifications, CI/CD and hosting.

**Out of scope for now:** employee devices, the third-party AI tools being governed, network-level DLP.

**Principles**

1. **Deny by default.** Every route requires authentication and an explicit role; nothing is public except login and the health check.
2. **Enforce on the server.** The UI hides buttons for convenience only.
3. **Collect less.** Store tool metadata and decisions, never employee prompts or file contents.
4. **Make tampering visible.** Audit events are insert-only and hash-chained.
5. **Least privilege everywhere:** users, database accounts, CI tokens, cloud roles.

## 2. Assets and data classification

| Asset | Why it matters | Sensitivity |
| --- | --- | --- |
| User accounts and sessions | Account takeover gives an attacker control of approvals | High |
| Tool inventory and risk ratings | Shows which tools are unapproved or weak; useful to an attacker or a competitor | Confidential |
| Assessments and evidence files | May contain contract terms, vendor security reports, internal findings | Confidential |
| Policy matrix | Changing a cell changes what employees are told is allowed | High (integrity) |
| Audit log | The product's proof of oversight | High (integrity) |
| Secrets (JWT keys, database URI, webhook URLs) | Compromise breaks everything above | Critical |
| Personal data (name, email, department) | Small, but covered by privacy law | Confidential |

## 3. Threat model

| # | Threat | Example in AegisAI | Main controls | Priority |
| --- | --- | --- | --- | --- |
| T1 | Account takeover | Credential stuffing against the login page | Argon2id hashing, rate limits, lockout, breached-password check, MFA for Admin (sections 4 and 11) | P0 |
| T2 | Broken access control | A requester reads or edits another team's tool by changing an ID in the URL | Object-level checks on every read and write; table-driven role tests | P0 |
| T3 | Injection | `$where` or `$ne` operators sent in a login or filter field (NoSQL injection) | Strict Zod validation, operator-key rejection, no raw query building | P0 |
| T4 | Stored XSS | A requester enters a script in a tool description that runs in an admin's browser | React output encoding, never `dangerouslySetInnerHTML`, CSP header, length limits | P0 |
| T5 | CSV injection | A tool name beginning with `=` runs a formula when an auditor opens the export | Prefix risky cells with an apostrophe in CSV export | P0 |
| T6 | Mass assignment | A requester sends `approvalStatus: "Approved"` in a create request | Zod whitelists fields per role; the model never receives raw request bodies | P0 |
| T7 | Audit tampering | An insider edits or deletes events to hide a revocation | Insert-only database role, hash chain, verify endpoint, external hash anchor | P0 / P1 |
| T8 | Insider abuse | An admin quietly approves a risky tool | Every decision is audited with actor and reason; two-person approval for High risk (P2) | P1 |
| T9 | Secret leakage | A JWT secret committed to git or printed in logs | Secret scanning, env-only secrets, log redaction | P0 |
| T10 | Vulnerable dependency | A malicious or outdated npm package | Lockfile, `npm ci`, Dependabot, `npm audit` in CI, pinned CI actions | P0 |
| T11 | CSRF | A malicious site triggers a state-changing request using the user's cookies | SameSite cookies plus CSRF token or custom header check | P0 |
| T12 | SSRF through webhooks | An admin sets a notification URL pointing at an internal address | Allow-list webhook hosts, block private IP ranges, short timeouts | P1 |
| T13 | Malicious evidence upload | A file with active content uploaded as assessment evidence | Type and size limits, served as download only, never rendered inline | P1 |
| T14 | Denial of service | Flooding the checker or login | Rate limits, request size limits, pagination caps | P1 |
| T15 | Data loss | Accidental deletion or a bad deploy | Automated backups, tested restore, soft delete for tools | P0 |

## 4. Authentication and session management

- **Passwords:** argon2id (or bcrypt with a cost chosen for about 250 ms per hash); minimum 12 characters; check against a breached-password list if feasible; never log or return hashes.
- **Login limits:** rate-limit by IP and by account (for example, 5 failed attempts in 15 minutes, then a temporary lock); use the same error message for "unknown user" and "wrong password".
- **Tokens:** access token valid for about 15 minutes and a refresh token for about 7 days, both in httpOnly, `Secure`, `SameSite` cookies. Rotate the refresh token on every use, store only its hash, and revoke the whole family if an old one is reused.
- **CSRF:** because cookies carry the session, state-changing requests need a CSRF token or a required custom header, in addition to SameSite.
- **Logout and password change:** revoke the user's refresh tokens immediately.
- **MFA:** TOTP for Admin and Compliance roles before production use (P1). Until then, document the risk.
- **SSO:** OIDC or SAML in Stage 3 (FR-2); when enabled, local password login for non-break-glass accounts can be turned off.
- **Account provisioning:** accounts are created by an Admin or via invite link; no open self-registration. First admin is created by a seed command, never by a default password.

## 5. Authorization

- A single role-check middleware per route, defined next to the route so a missing check is visible in review.
- **Object-level rules:** a Requester sees only their own requests; an Employee sees only checker results; an Auditor is read-only everywhere. These checks live in the service layer, not the UI.
- **Table-driven test:** one test iterates every route against every role and asserts the expected allow or deny, so a new route without a rule fails CI.
- The permission matrix is in section 5 of `tech-stack-aegisai-mern.md`; this plan treats it as the source of truth for review.
- All denials of privileged actions are written to the audit log.

## 6. Data protection and privacy

- **In transit:** HTTPS only, with HSTS. Atlas connections use TLS.
- **At rest:** use database encryption at rest (default on managed Atlas clusters) and encrypted backups. Evidence files inherit the same protection through GridFS.
- **Minimization:** the product stores tool metadata, assessments, decisions and basic user details (name, email, department, role). It does not store employee prompts, chat content or documents.
- **Personal data and the immutable log:** audit events reference a user ID rather than copying name and email. If a person must be erased, pseudonymize the user record; the chain stays valid.
- **Retention:** keep audit events for a configurable period (default to decide, see open questions); delete evidence files when their tool is permanently removed.
- **Data location:** choose the Atlas region deliberately; if a pilot customer requires data to stay in India, select an Indian region.
- **Environments:** no production data in staging or local development; the seed script uses mock data only.

## 7. Application and API security

| OWASP Top 10 (2021 categories) | How AegisAI addresses it |
| --- | --- |
| A01 Broken Access Control | Deny by default, server-side roles, object-level checks, table-driven role tests |
| A02 Cryptographic Failures | TLS everywhere, argon2id, hashed refresh tokens, secrets outside code |
| A03 Injection | Zod validation on all input, NoSQL operator rejection, no string-built queries, CSV injection guard |
| A04 Insecure Design | This threat model, reviewed before each stage; abuse cases for the checker and approvals |
| A05 Security Misconfiguration | `helmet` headers, CORS allow-list, no stack traces in production, env validation at start-up |
| A06 Vulnerable and Outdated Components | Dependabot, `npm audit` in CI, regular upgrades of Node LTS, Express, Mongoose |
| A07 Identification and Authentication Failures | Rate limits, lockout, token rotation, MFA for privileged roles |
| A08 Software and Data Integrity Failures | Lockfile and `npm ci`, pinned CI actions, hash-chained audit log, signed or reviewed deploys |
| A09 Security Logging and Monitoring Failures | Structured logs of auth events and denials, alerts in section 9 |
| A10 Server-Side Request Forgery | Webhook host allow-list, block private address ranges, timeouts |

**Response headers and limits (baseline)**

- `Content-Security-Policy` that allows only the app's own scripts and styles, `X-Content-Type-Options: nosniff`, `Referrer-Policy`, frame protection.
- JSON body size limit (for example 100 KB), pagination cap on list endpoints, upload limits for evidence files.
- Generic error messages to clients; details only in server logs.

## 8. Audit log integrity

The design is in section 6 of `tech-stack-aegisai-mern.md`. Security requirements for it:

1. One service function is the only writer to `auditEvents`.
2. The API's database user has `find` and `insert` on that collection only.
3. A verify endpoint and a nightly job recompute the chain; a failure raises a critical alert.
4. Publish the latest hash outside the database on a schedule (for example, an email to the Auditor role) so a full rewrite by a database admin is detectable.
5. State the limit plainly in product copy: the log is tamper-evident, not tamper-proof.

## 9. Logging, monitoring and alerting

**Log:** sign-ins and failures, token refresh and reuse, role denials, user and role changes, policy changes, exports, chain verification results.

**Never log:** passwords, tokens, full request bodies, evidence file contents.

**Alert on (P1):**

- A burst of failed logins for one account or from one IP.
- A refresh-token reuse event.
- A new Admin account or a role change to Admin.
- An audit chain verification failure.
- A sudden large export of the audit log.

Send alerts to email or Slack through the same webhook mechanism as FR-21.

## 10. Secrets, supply chain and infrastructure

**Secrets**

- Environment variables from the host's secret store; `.env` files are never committed; `.env.example` lists names only.
- Separate secrets per environment; rotate JWT secrets if exposure is suspected (this signs everyone out, which is the intent).
- Secret scanning on the repository (GitHub secret scanning or gitleaks in CI).

**Supply chain and CI**

- Commit the lockfile and install with `npm ci`.
- Dependabot for npm and GitHub Actions; `npm audit` in CI; review new dependencies before adding them.
- GitHub: two-factor authentication on, protected `main`, required reviews or checks, least-privilege `GITHUB_TOKEN`, third-party Actions pinned to a commit.

**Infrastructure**

- One database user per environment with least privilege; the audit writer role is separate and insert-only.
- Restrict Atlas network access to the API host (IP access list or private networking where the plan allows); no `0.0.0.0/0` in production.
- Automated backups with a tested restore.
- Separate staging and production projects and credentials.
- Run containers as a non-root user and keep the Node base image up to date.

## 11. Incident response (minimum viable)

1. **Detect:** an alert, a user report or a failed chain verification.
2. **Contain:** disable the affected account, revoke refresh tokens, rotate secrets, or take the API offline if needed.
3. **Assess:** use the audit log and server logs to find what was accessed or changed; check the chain to see whether the log itself was touched.
4. **Notify:** tell the pilot organization's contact promptly. Breach-notification duties depend on the law and the contract (for example, India's DPDP Act or GDPR), so get legal advice before committing to deadlines.
5. **Recover:** restore from backup if data changed, redeploy with fixed code, rotate everything that was exposed.
6. **Learn:** write a short post-incident note and add a test or control that would have caught it.

Keep a one-page contact sheet: who owns the product, who can rotate secrets, who talks to the customer.

## 12. Security testing and pre-launch checklist

**Ongoing:** unit tests for the role matrix, validation and the hash chain; `npm audit` and Dependabot on every pull request.

**Before the first pilot (P0)**

- [ ] Every route has an explicit role rule; the table-driven role test passes.
- [ ] Login rate limiting and lockout work against a scripted attack.
- [ ] Cookies are httpOnly, `Secure` and `SameSite`; CSRF protection is tested.
- [ ] NoSQL operator injection attempts on login and filters are rejected.
- [ ] A tool description containing a script renders as plain text in the registry and the audit log.
- [ ] CSV export neutralizes cells that start with `=`, `+`, `-` or `@`.
- [ ] The API database user cannot update or delete `auditEvents` (verified by trying).
- [ ] Chain verification detects a manually edited event in a test database.
- [ ] No secrets in the repository history; secret scanning enabled.
- [ ] Backups run and a restore has been tested once.
- [ ] Production has no default or seed credentials.
- [ ] Error responses show no stack traces or database details.

**Before wider release (P1)**

- [ ] MFA for Admin and Compliance.
- [ ] Alerts from section 9 are live.
- [ ] A baseline automated scan (for example OWASP ZAP) is run against staging and findings are triaged.
- [ ] An independent review or penetration test, scoped to authentication, access control and the audit log.
- [ ] Webhook allow-list and evidence-upload controls are in place.

## 13. Privacy and compliance notes

- The product helps customers with frameworks such as NIST AI RMF, ISO 42001 and the EU AI Act, but using it does not make an organization compliant. Say so in the product and the terms.
- Review the handling of personal data with someone qualified under India's DPDP Act 2023 (and GDPR if EU users are involved) before onboarding a real organization.
- Compliance scores are decision support. Keep the formula visible and require a named human approver for every approval.
- This plan is an engineering draft, not legal advice or a certification.

## 14. Open questions for the author

- [ ] Is MFA required for Admin and Compliance from the first pilot, or only before wider release?
- [ ] What audit retention period should be the default (for example 1 year, 3 years, configurable)?
- [ ] Does any pilot customer need data kept in a specific country or region?
- [ ] Who is the named owner for security incidents and secret rotation, and who is the backup?
- [ ] Is there budget or a plan for an independent security review before real customer data is loaded?
- [ ] Should High-risk tool approvals need two people from the start, or later (P2)?
- [ ] Will evidence file uploads be in the MVP, or deferred until the upload controls are built?
