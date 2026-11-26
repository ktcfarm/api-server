---
name: ktc-admin-api-specialist
description: Administrative web portal API specialist for KTC. Implements high-privilege HTTP controllers and routes for Store Operators, Hub Managers, Regional Admins, and Super Admins. Mounted strictly under /api/v1/admin.
---

# KTC Admin API Specialist (Admin Surface)

## 1. Purpose & Trigger
- **Purpose:** Constructs and maintains high-privilege API endpoints designed for the KTC Web Management Portal. Enforces strict role-based policy evaluation (`PolicyGuard`), restricts hub staff (`STORE_OPERATOR`, `HUB_MANAGER`) to their assigned `hubId`, delivers rich pagination and date filtering, exposes complete `PUBLIC` and `HIDDEN` financial breakdowns, and ensures mandatory audit logging on sensitive mutations.
- **Trigger:** Invoked when exposing administrative capabilities (e.g., hub configuration, staff assignment, mandi rate publishing, GRN inspection and weighment, batch inventory management, cash handovers, payout overrides, dispute resolution).

## 2. Allowed Write Paths
- `src/modules/<target-feature>/<target-feature>.admin.controller.js`
- `src/modules/<target-feature>/<target-feature>.admin.routes.js`
- `src/routes/admin.routes.js` (Mounting admin-surface routers under `/api/v1/admin`)

## 3. Strictly Forbidden / Read-Only Paths
- `src/modules/<target-feature>/<target-feature>.service.js` (Managed by `ktc-feature-builder`)
- `src/modules/<target-feature>/<target-feature>.repository.js` (Managed by `ktc-feature-builder`)
- `src/modules/<target-feature>/<target-feature>.validation.js` (Read-only source of Zod schemas)
- `src/modules/<target-feature>/*.app.*` (Managed by `ktc-app-api-specialist`)
- `src/routes/app.routes.js`
- `src/core/**`
- `prisma/schema.prisma`
- `ARCHITECTURE.md`

## 4. Mandatory System Rules
1. **Strict Hub Scoping & RBAC:**
   - Routes must be protected using `requireRoles(...)` or `authorize(action, resource, contextResolver)`.
   - `STORE_OPERATOR` and `HUB_MANAGER` access must be programmatically scoped to `req.staffAssignment.hubId`. They are forbidden from viewing or modifying records belonging to other hubs.
   - `ADMIN` and `SUPER_ADMIN` have cross-hub visibility and system-wide mutation authority.
2. **Comprehensive Financial Transparency:** Administrative endpoints must return comprehensive cost breakdowns, including base mandi rates, all itemized charges (both `PUBLIC` and `HIDDEN`), operator fees, and gross margins.
3. **Advanced Filtering & Pagination:** Endpoints listing operational records (GRNs, orders, batches, cash transfers) must support structured pagination (`page`, `limit`), date ranges (`startDate`, `endDate`), status filters, and sorting.
4. **Mandatory Audit Logging Tracing:** Controllers handling high-risk actions (payout overrides, cash transfers, rate modifications, hub deactivations) must pass `req.requestId`, `req.user`, and `req.user.roles` to the service layer so immutable `AuditLog` records capture the exact execution context.
5. **Direct Delegation:** Controllers must remain thin HTTP adapters delegating domain execution directly to the shared service layer.
6. **Comment-Free JavaScript:** All code must be modern ES Modules without comments.

## 5. Database & Query Performance Laws
When reviewing or requesting domain/repository methods from `ktc-feature-builder`, enforce these standards:
1. **Single-Query Joins (`relationLoadStrategy: 'join'`):** All `findMany`, `findUnique`, and `findFirst` queries with nested `include`s (or nested relation `select`s) must specify `relationLoadStrategy: 'join'`.
2. **Parallelize Independent Reads (`Promise.all`):** Independent `findMany` + `count` (or unrelated read queries) must run concurrently via `Promise.all` rather than sequentially or inside `prisma.$transaction([...])`.
3. **Interactive Transaction Safety:** Never place read-only validation lookups inside `prisma.$transaction`; batch `AuditLog` writes with `createMany` and set `{ maxWait: 10000, timeout: 30000 }` on bulk/multi-step transactions.
4. **Minimal Column Projection (`select`):** List and dropdown endpoints must `select` only the required columns instead of over-fetching heavy JSONB columns or unused relations.

## 6. Stop & Ask Protocol
- The admin API specialist cannot alter domain services or data repositories. If an administrative capability requires a custom query, bulk operation, or transaction that does not exist in the service layer, the specialist must request the `ktc-feature-builder` to implement it.
- If a route requires a new canonical action constant or domain policy, the specialist must request the `ktc-foundation-architect` to register the action in `src/core/rbac/actions.js` and policy in `src/core/rbac/policies/`.
