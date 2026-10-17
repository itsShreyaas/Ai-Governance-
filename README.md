# AegisAI — Enterprise AI Tool Governance

Enterprise AI Tool Governance, Policy Enforcement, and Risk Assessment Platform.

## Monorepo Architecture

- **`src/`**: React 19 + Vite frontend dashboard (Stage 1).
- **`packages/shared/`**: Shared TypeScript enums, document types, and Zod input validation schemas. Server-controlled fields (`approvalStatus`, `riskLevel`, `complianceScore`, etc.) are omitted from input schemas to prevent mass-assignment.
- **`apps/api/`**: Express / Mongoose API (TypeScript) with authentication, Tool Registry, Requests, Audit, Dashboard, Settings, and Users routes, plus an insert-only, tamper-evident hash-chained audit service.

---

## Getting Started

### 1. Prerequisites
- Node.js (v20+ recommended)
- Docker & Docker Compose (for local single-node MongoDB replica set)

### 2. Start Local MongoDB Replica Set
MongoDB transactions require a replica set. The included `docker-compose.yml` initializes a single-node replica set `rs0` on port 27017:
```bash
docker compose up -d
```

### 3. Install Dependencies
```bash
npm install
```

### 4. Run Checks
Run repository-wide lint, typecheck, tests, and production build from the root:
```bash
npm run lint
npm run typecheck
npm test
npm run build
```

### 5. Run Database Scripts
Run scripts from the root using the API workspace:

- **Create Indexes:**
  ```bash
  npm run db:indexes --workspace=@aegisai/api
  ```
- **Seed Initial Data (Mock Tools, Users & Audit Trail):**
  ```bash
  npm run seed --workspace=@aegisai/api
  ```
- **Verify Audit Log Hash Chain:**
  ```bash
  npm run verify-audit --workspace=@aegisai/api
  ```
The API scripts require `MONGODB_URI`. Copy `.env.example` to `.env` and set the variable for your shell, or provide it directly in the environment before running them. The API server, authentication, Tool Registry, Requests, and Audit endpoints are implemented; start the current application UI with `npm run dev`.

---

## Audit Integrity
All audit entries are written strictly through `apps/api/src/services/auditService.ts`. Each event computes:
$$h_n = \text{SHA256}(n \parallel \text{canonical}(event_n) \parallel h_{n-1})$$
Entries are append-only; update and delete operations are prohibited.
