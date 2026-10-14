# AegisAI — Enterprise AI Tool Governance

Enterprise AI Tool Governance, Policy Enforcement, and Risk Assessment Platform.

## Monorepo Architecture

- **`src/`**: React 19 + Vite frontend dashboard (Stage 1).
- **`packages/shared/`**: Shared TypeScript enums, document types, and Zod input validation schemas. Server-controlled fields (`approvalStatus`, `riskLevel`, `complianceScore`, etc.) are omitted from input schemas to prevent mass-assignment.
- **`apps/api/`**: Express / Mongoose data layer (TypeScript) with Mongoose models, index management, and an insert-only, tamper-evident hash-chained audit service.

---

## Getting Started

### 1. Prerequisites
- Node.js (v20+ recommended)
- Docker & Docker Compose (for local single-node MongoDB replica set)

### 2. Configure Environment
Copy `.env.example` to `.env`:
```bash
cp .env.example .env
```

### 3. Start Local MongoDB Replica Set
MongoDB transactions require a replica set. The included `docker-compose.yml` initializes a single-node replica set `rs0` on port 27017:
```bash
docker compose up -d
```

### 4. Install Dependencies
```bash
npm install
```

### 5. Run Database Scripts
Navigate to `apps/api` or run via npm workspaces:

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
- **Typecheck:**
  ```bash
  npm run typecheck --workspace=@aegisai/shared
  npm run typecheck --workspace=@aegisai/api
  ```

---

## Audit Integrity
All audit entries are written strictly through `apps/api/src/services/auditService.ts`. Each event computes:
$$h_n = \text{SHA256}(n \parallel \text{canonical}(event_n) \parallel h_{n-1})$$
Entries are append-only; update and delete operations are prohibited.
