# AegisAI Database

Sources: `prd-aegisai.md` (PRD section 8, FRs), `tech-stack-aegisai-mern.md` (TECH_STACK section 4), `ARCHITECTURE.md`, `security-aegisai.md`. Stack: MongoDB Atlas, Mongoose, TypeScript. Nothing here exists in code yet; Stage 1 uses mock data only.

Items marked **[U#]** are unclear in the source documents and listed in section 6. Fields not named in the sources are marked *(added)* with the reason.

## 1. Conventions

- One collection per entity; related documents hold ObjectId references, not copies.
- Enums and shapes live in `packages/shared` (Zod); every write is validated with Zod before it reaches Mongoose. Mongoose `strict` mode is on.
- Dates are UTC `Date` values. `createdAt` and `updatedAt` on every collection except `auditEvents` (which uses `timestamp`) and `counters`.
- MongoDB runs as a replica set so the audit append can use a transaction.
- Scope: one organization per deployment (PRD assumption), so no `organizationId` field **[U9]**.

## 2. Relationships

```
users 1 ──< requests        (requester, reviewer)
users 1 ──< assessments     (assessor)
users 1 ──< auditEvents     (actor)
users 1 ──< refreshTokens
tools 1 ──< assessments
tools 1 ──< requests        (see U4)
tools 1 ──< auditEvents     (optional: some events have no tool)
policies  ·· tools          matched by category + department + sensitivity tier,
                            not by ObjectId
```

## 3. Collections

### users

| Field | Type | Rules |
| --- | --- | --- |
| name | String | required |
| email | String | required, unique, lowercased |
| department | String | required **[U1]** |
| role | Enum | Admin, Compliance, Requester, Employee, Auditor, system |
| passwordHash | String | argon2id or bcrypt; absent for `system` users |
| isActive | Boolean | *(added)* default true; SECURITY says to disable accounts during an incident **[U12]** |

System users (for example "Automated Scanner") have role `system` and cannot log in.

### tools

| Field | Type | Rules |
| --- | --- | --- |
| name, vendor | String | required |
| category | String | required **[U2]** |
| description | String | optional, length-limited (XSS control in SECURITY) |
| approvalStatus | Enum | Approved, Pending Review, Restricted **[U3]** |
| riskLevel | Enum | Low, Medium, High **[U5]** |
| ownerDepartment | String | by name **[U1]** |
| dataSensitivity | Enum | Internal Only, Confidential, Restricted |
| userCount | Number | integer, >= 0 |
| complianceScore | Number | 0 to 100 **[U5]** |
| lastReviewed | Date | **[U5]** |
| personalData | Boolean | *(added)* PRD section 11 maps DPDP to a "personal data" flag on tools and policies |
| archivedAt | Date or null | *(added)* FR-3 "archive" and SECURITY "soft delete for tools"; archived tools are hidden, never removed |

### policies

| Field | Type | Rules |
| --- | --- | --- |
| toolCategory | String | required, same values as `tools.category` |
| department | String | required **[U1]** |
| sensitivityTier | Enum | same values as `tools.dataSensitivity` |
| verdict | Enum | Allowed, Conditional, Blocked |
| conditions | String | used when verdict is Conditional |
| version | Number | integer, starts at 1 (FR-9, P1) **[U7]** |
| effectiveFrom | Date | required |
| author | ObjectId (users) | *(added)* FR-9 asks for version author (P1) |
| personalData | Boolean | *(added)* see tools |

### assessments

| Field | Type | Rules |
| --- | --- | --- |
| toolId | ObjectId (tools) | required |
| framework | Enum | NIST AI RMF, ISO 42001, EU AI Act |
| answers | Array | nested; shape not defined **[U6]** |
| riskLevel | Enum | Low, Medium, High |
| score | Number | 0 to 100, computed by the shared scoring function |
| euRiskClass | String | *(added)* PRD section 11 wants an EU risk-class field per assessment; values not defined **[U6]** |
| assessor | ObjectId (users) | required |
| status | String | values not defined **[U6]** |
| reviewDate | Date | next re-review |
| evidence | Array | GridFS file ids with file names (FR-12, P1) |

### requests

| Field | Type | Rules |
| --- | --- | --- |
| toolId | ObjectId (tools) | **[U4]** |
| requester | ObjectId (users) | required |
| useCase | String | required |
| dataTypes | Array of String | required **[U7]** |
| status | Enum | Submitted, In review, Approved, Restricted, Rejected (FR-6) **[U3]** |
| reviewer | ObjectId (users) | set when review starts |
| submittedAt, decidedAt | Date | decidedAt set on decision |

### auditEvents (insert-only)

| Field | Type | Rules |
| --- | --- | --- |
| sequence | Number | required, unique, assigned from `counters` |
| timestamp | Date | required |
| eventType | Enum | TOOL_SUBMISSION, POLICY_UPDATE, APPROVAL_GRANTED, RISK_ESCALATION, COMPLIANCE_SCAN, ACCESS_REVOCATION, plus more **[U8]** |
| severity | Enum | info, warning, success, critical |
| toolId | ObjectId (tools) | optional |
| actor | ObjectId (users) | required; a user id, never a copied name or email (SECURITY) |
| department | String | from the mock event shape **[U1]** |
| details | String | free text; never prompts or file contents |
| previousHash, hash | String | SHA-256 hex; hash covers sequence, canonical event and previous hash |

Rules: no update or delete path in the API; the API's database user has `find` and `insert` only on this collection; written only by the audit service, in the same transaction as the change it records. The first event uses a fixed genesis value as `previousHash` **[U14]**.

### counters

`_id` (String, for example `auditEvents`) and `seq` (Number). Incremented with `findOneAndUpdate` inside the audit transaction (TECH_STACK).

### refreshTokens *(added, implied by SECURITY)*

| Field | Type | Rules |
| --- | --- | --- |
| userId | ObjectId (users) | required |
| tokenHash | String | required, unique; the raw token is never stored |
| familyId | String | groups rotated tokens; reuse revokes the family |
| expiresAt | Date | TTL index removes expired rows |
| revokedAt | Date or null | set on logout, password change or reuse |

### settings *(added, see U9)*

A single document (one organization per deployment) holding: organization profile, departments, data sensitivity tiers, framework toggles, compliance-score weights, notification webhook settings (FR-20, FR-21, PRD section 11).

### Evidence files

MongoDB GridFS (`fs.files`, `fs.chunks`) for the MVP (FR-12, P1); `assessments.evidence` stores the references. Served as download only.

## 4. Indexes

From TECH_STACK unless marked *(added)*.

| Collection | Index |
| --- | --- |
| users | unique `email` |
| tools | text on `name`, `vendor`, `description`; compound `approvalStatus` + `riskLevel` |
| policies | compound `toolCategory` + `department` + `sensitivityTier`; `effectiveFrom` |
| assessments | `toolId`; `reviewDate` |
| requests | `status`; `requester` |
| auditEvents | unique `sequence`; `toolId` + `timestamp`; `eventType` |
| refreshTokens | unique `tokenHash`; TTL on `expiresAt` *(added)* |

Dashboard counts by status and risk use aggregation pipelines over `tools`, not stored counters.

## 5. Data ownership and access

The customer organization owns all data. Access is enforced by the API, not the database, except the audit collection (insert-only database role).

| Collection | Written by | Read by | Notes |
| --- | --- | --- | --- |
| users | Admin | Admin | Holds the only personal data (name, email, department) |
| tools | Admin, Compliance; Requesters only through requests | Admin, Compliance, Requester, Auditor | Decisions via `POST /tools/:id/decision` |
| policies | Admin; Compliance can only "propose" **[U15]** | All signed-in roles through the checker; Admin, Compliance, Auditor directly | |
| assessments | Admin, Compliance | Admin, Compliance, Auditor | |
| requests | Requester creates; Admin, Compliance decide | Requester sees own; Admin, Compliance, Auditor see all | |
| auditEvents | Audit service only | Admin, Compliance, Auditor; Requester sees own requests' events | Insert-only |
| settings | Admin | Admin | |
| refreshTokens, counters | API internals | Nobody through the API | |

**Personal data and erasure:** audit events reference `actor` by id, so a user record can be pseudonymized without breaking the hash chain. Prompts, chat content and documents are never stored.

**Environments:** no production data in staging or local; the seed script loads the six mock tools and ten mock events (events written through the audit service so the chain is valid).

## 6. Unclear requirements

| # | Question | Why it matters |
| --- | --- | --- |
| U1 | Are departments free text or a managed list? Sources say `ownerDepartment` is stored by name, and Settings (FR-20) manages departments. | Spelling mismatches break policy matching. Proposed: strings validated against `settings.departments`. |
| U2 | Is tool `category` free text or a fixed list? | Policies match tools by category. |
| U3 | Tool status has three values (Approved, Pending Review, Restricted); requests have five; the API offers approve, restrict, reject and revoke. Where do Rejected and revoked live on a tool? | The data model cannot represent a rejected or revoked tool as written. |
| U4 | FR-14 lets an employee request a tool that is not in the registry. Does a request then create a tool in Pending Review, or does the request hold a tool name instead of `toolId`? | Decides whether `requests.toolId` is required. |
| U5 | `riskLevel`, `complianceScore` and `lastReviewed` are on the tool (PRD) but computed from assessments (FR-11, TECH_STACK says derived values are not typed by hand). Stored copy or computed on read? With several frameworks, which assessment decides? | Avoids two sources of truth. |
| U6 | No format for questionnaire templates (FR-10), assessment `answers`, assessment `status` values, or EU risk-class values. | Needed before the assessment module. |
| U7 | Policy versioning (FR-9): new document per version or edit in place? Is only one policy active per category, department and tier? How does the checker map a request's `dataTypes` to a sensitivity tier (FR-13)? | Affects unique indexes and the resolver. |
| U8 | Only six audit event types are defined, but FR-15 and SECURITY need more: logins, role denials, user and role changes, exports, chain verification failures. | Event enum must be extended. |
| U9 | Settings and score weights have no schema. Single document assumed. If multi-tenancy is chosen (open question), every collection needs `organizationId`. | Late change is costly. |
| U10 | Confirm a `refreshTokens` collection (implied, not listed in TECH_STACK). | Required by the rotation and reuse-detection design. |
| U11 | Retention for audit events and evidence files is undecided (open question in SECURITY). | Drives deletion jobs and TTLs. |
| U12 | Is deactivation (`isActive`) the only way to remove a user, with pseudonymization for erasure requests? | SECURITY mentions disabling accounts; no field is defined. |
| U13 | Must tool names be unique, or unique per vendor? | Duplicates in the registry. |
| U14 | Canonical event form (key order, timestamp format) and the genesis hash value are not fixed. | Must be fixed once; changing it breaks verification of old events. |
| U15 | Compliance can "propose" policy changes (permission matrix). No proposal or approval record exists. | A proposal needs somewhere to live. |
