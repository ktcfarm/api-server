# KTC System Architecture & Engineering Specifications

## 1. System Overview & Technology Stack
Krishi Trade Center (KTC / Mandi Exchange) is a hub-and-spoke agricultural procurement platform and commodity exchange connecting farmers, institutional/bulk commercial buyers, and physical hub staff.

### Platform Clients
- **Unified Mobile Client (Flutter):** Serves both Farmers and Buyers through progressive onboarding and role switching (`activeRole`).
- **Store & Admin Web Portal (React / Vite):** Serves Store Operators, Hub Managers, Regional Admins, and Super Admins.

### Backend Infrastructure
- **Runtime Environment:** Node.js (ES Modules, `"type": "module"`), pure modern JavaScript.
- **HTTP Framework:** Express with modular routers, strict input validation, security headers, and structured logging.
- **Database & Spatial Engine:** PostgreSQL 15+ hosted on Supabase, leveraging PostGIS (`geography(Point, 4326)`) and GiST spatial indexes.
- **ORM & Data Layer:** Prisma Client v6.19.3 utilizing direct connection pooling and transactional isolation.
- **Asset Storage Layer:** Abstracted `BaseStorageProvider` facilitating client-direct presigned uploads to Cloudflare R2 (primary) or Cloudinary (secondary).

---

## 2. Core Architectural Laws

### Layered Separation of Concerns
Every functional module inside `src/modules/` adheres strictly to four distinct layers:
1. **Routes (`*.routes.js`):** Endpoint definitions, HTTP verb binding, and middleware chains (`authMiddleware`, `validate`, `authorize`, rate limiters). Zero domain logic.
2. **Controllers (`*.controller.js`):** Unpacking HTTP requests, parameter extraction, invocation of domain services, and returning uniform JSON envelopes (`{ success: true, data: ... }`).
3. **Services (`*.service.js`):** Core business logic, transaction orchestration (`prisma.$transaction`), strategy selection, audit event dispatch, and invariant enforcement.
4. **Repositories (`*.repository.js`):** Pure data access, Prisma model queries, PostGIS spatial SQL statements, and transactional query runners (`tx || prisma`).

### Pragmatic Object-Oriented & SOLID Design
The architecture leverages abstract base classes and polymorphic strategies to encapsulate volatile domain algorithms:
- `BaseStorageProvider`: Governs presigned upload target generation, access URL resolution, and asset deletion.
- `BaseOtpChannel`: Encapsulates delivery mechanics across SMS, Email, and In-App channels.
- `BaseChargeCalculationStrategy`: Executes polymorphic charge models (`FLAT`, `PERCENTAGE`, `PER_UNIT_WEIGHT`).
- `BasePayoutAllocationStrategy`: Encapsulates settlement allocation algorithms (`FIFO`, `MANUAL_OVERRIDE`).

### Policy-Based Access Control (RBAC)
- Fine-grained authorization is evaluated by `PolicyGuard` using canonical actions defined in `src/core/rbac/actions.js`.
- Root bypass is reserved exclusively for `SUPER_ADMIN` and `ADMIN` roles within `PolicyGuard.can()`.
- Operational staff (`HUB_MANAGER`, `STORE_OPERATOR`) are programmatically locked to their assigned physical `hubId`.

### Dual Surface Routing Architecture
The backend exposes two distinct routing surfaces over the single service layer:
- **Mobile Surface (`/api/v1/app`):** Tailored for the Flutter mobile application. Delivers minimal payload footprints, enforces strict resource ownership (preventing IDOR), and redacts all internal margins and hidden fees.
- **Administrative Surface (`/api/v1/admin`):** Tailored for web portal operations. Enforces rigorous RBAC, exposes hub-scoped filters, detailed pagination, full fee audits, and high-privilege operational endpoints.
- **Shared Domain Core:** Both surfaces delegate strictly to identical service singletons. Zero business logic is duplicated across route surfaces.

### Source Code Conventions
- **Pure JavaScript:** All code is standard ECMAScript. No TypeScript compilation step or declaration files exist within application runtime code.
- **Zero Inline Comments:** Source files (`.js`) must remain completely comment-free. Clarity is achieved via explicit identifier naming, single-responsibility functions, and architectural guardrails.
- **Financial and Metric Precision:** Monetary figures, tax calculations, and commodity weights are strictly stored and computed using Prisma `Decimal` / string math. Native IEEE-754 floating-point types (`number`) are forbidden for financial and inventory math.
- **Universal Schema Extensibility:** All schema models provide a `metadata Json?` column for operational tags, custom attributes, and enum extension values.

---

## 3. Locked Domain Invariants

### 1. Principal-Buyer Procurement Model
KTC operates strictly as a principal buyer and distributor. Physical hubs buy produce directly from farmers via Goods Receipt Notes (GRN). KTC assumes legal inventory ownership and fulfills buyer orders from hub stock. Direct peer-to-peer (P2P) trading between farmers and buyers is strictly prohibited.

### 2. Application-Enforced Identifier Uniqueness
Phone numbers and email addresses are not guarded by database unique constraints. This allows historical preservation, account soft deletion, and multi-tenant mapping. Identifier uniqueness is strictly verified inside transactional service logic during user registration and profile mutation.

### 3. Canonical Base Units & Conversion Matrix
- All weight-measured crops define `KG` as the canonical base unit.
- All count-measured crops (e.g., coconut, banana) define `PIECE` as the canonical base unit.
- Trade and container units (`QUINTAL`, `BAG`, `CRATE`, `DOZEN`) map directly to the canonical base unit via the `Crop.unitConversions` JSON structure (e.g., `{"QUINTAL": 100, "BAG": 50}`).
- All inventory ledgers, receipt notes, batch trackers, and valuation algorithms store physical quantities strictly in the canonical base unit.

### 4. Three-Stage Charge Engine & Snapshot Immutability
- **`INBOUND_GRN`:** Mandi levies, weighing fees, loading, and handling fees deducted from or added to farmer settlements.
- **`CATALOG_PRICE`:** Hub processing markup, holding costs, and wastage buffers added to base commodity rates.
- **`OUTBOUND_ORDER`:** Packaging, logistics, and delivery surcharges applied to commercial buyer invoices.
- **Visibility:** `PUBLIC` charges appear explicitly on external receipts and invoices; `HIDDEN` charges are absorbed into gross commodity pricing.
- **Historical Immutability:** When a transaction occurs, all applied charges snapshot their computed value, calculation type, and `direction` (`ADDITION` | `DEDUCTION`) into `TransactionCharge`. Subsequent modifications to `ChargeDefinition` never alter historical records.

### 5. Multi-Level Cash Accounts & Handover Protocols
- Every `KtsHub` automatically provisions an associated `HUB_SAFE` cash account upon creation.
- Every assigned `STORE_OPERATOR` automatically provisions an `OPERATOR_CASH_IN_HAND` account upon staff assignment.
- Physical cash transfers between operators or between an operator and the hub safe mandate an in-app, time-bounded verification OTP generated by the sender and validated by the receiver before ledger mutation.

### 6. Hybrid Settlement Allocation
- Inbound farmer payments default to first-in, first-out (`FIFO`) matching against unliquidated Goods Receipt Notes.
- Authorized finance administrators may invoke `MANUAL_OVERRIDE` to target specific settlement batches, triggering an immediate immutable `AuditLog` record.

### 7. Spatial Geolocation & Discovery
- Hub locations and addresses store PostGIS `geography(Point, 4326)` geometries indexed with GiST indexes.
- Proximity discovery (`/api/v1/app/hubs/nearby`) evaluates geographic proximity using `ST_DWithin` queries bounded by an indexing-supported radius threshold (defaulting to 25 km).

---

## 4. Documentation Immutability & Modification Rule
This document (`ARCHITECTURE.md`) represents the immutable source of truth for the KTC platform architecture.
- Routine feature implementations, bug fixes, middleware additions, and API routing adjustments are strictly prohibited from altering this file.
- Modifications to `ARCHITECTURE.md` are permitted exclusively when:
  1. A new functional module is formally completed and integrated into the platform.
  2. A core platform-level architectural revision is explicitly commissioned by engineering leadership.

---

## 5. Platform Module Progress

| Module | Domain Scope | Status |
|---|---|---|
| **Module 1** | Auth, Sessions, PIN Security & Progressive Onboarding | Completed |
| **Module 2** | Hubs, Geolocation (PostGIS) & Staff Assignment | Completed |
| **Foundation** | Security Middlewares, Storage Abstraction & Dual Routing | Completed |
| **Module 3** | Crop Master, Varieties & Unit Conversions | Completed |
| **Module 4** | Daily Mandi Rates & Pricing Engine | Pending |
| **Module 5** | Inbound Procurement & Goods Receipt Notes (GRN) | Pending |
| **Module 6** | Hub Inventory & Batch Management | Pending |
| **Module 7** | Outbound Buyer Orders & Fulfillment | Pending |
| **Module 8** | Cash Ledger, Float & Safe Management | Pending |
| **Module 9** | Farmer Payouts & Settlement Allocation | Pending |
| **Module 10** | Disputes, Auditing & Operational Analytics | Pending |
