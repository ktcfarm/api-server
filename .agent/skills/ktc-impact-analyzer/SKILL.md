---
name: ktc-impact-analyzer
description: Pre-flight architectural change planner and blast-radius analyzer. Evaluates incoming feature requests, audits cross-module dependencies, and dispatches tasks to scope-locked specialist skills. Strictly read-only.
---

# KTC Impact Analyzer & Pre-Flight Planner

## 1. Purpose & Trigger
- **Purpose:** Serves as the initial pre-flight assessment engine before any code or schema modification begins. The analyzer inspects platform specifications, existing schemas, core contracts, and module dependencies to calculate the precise blast radius, assign appropriate writer skills, and establish execution order.
- **Trigger:** Invoked automatically at the start of any new module development, architectural enhancement, schema migration, or cross-cutting refactor.

## 2. Allowed Write Paths
- **None (`Strictly Read-Only`).**
- This skill has zero write permissions across the entire repository. Its output is exclusively analytical planning documentation delivered directly to the orchestrator.

## 3. Strictly Forbidden / Read-Only Paths
- All paths are read-only:
  - `prisma/schema.prisma`
  - `src/core/**`
  - `src/modules/**`
  - `src/routes/**`
  - `ARCHITECTURE.md`
  - `package.json`
  - `.env*`

## 4. Mandatory System Rules
When analyzing architectural modifications, the following invariants must be verified:
1. **Layered Separation of Concerns:** Any proposed design must adhere strictly to `routes -> controllers -> services -> repositories`.
2. **Strategy & Interface Patterns:** Algorithms subject to variation (OTP delivery, charge computation, payout allocation, asset storage) must inherit from their respective base classes (`BaseOtpChannel`, `BaseChargeCalculationStrategy`, `BasePayoutAllocationStrategy`, `BaseStorageProvider`).
3. **Policy-Based RBAC:** Proposed endpoints must map to canonical actions in `src/core/rbac/actions.js` and be enforced via `PolicyGuard`.
4. **Dual Surface Routing:** Features serving mobile flows (`/api/v1/app`) and administrative portals (`/api/v1/admin`) must share an identical service core without business logic duplication.
5. **Precision Math & Schema Standards:** Any currency, rate, or weight manipulation must use Prisma `Decimal` / string representations. Entities must retain universal `metadata Json?`.
6. **Comment-Free Code Requirement:** Generated implementation plans must mandate zero inline or block comments in all application JavaScript files.

## 5. Standard Impact Analysis Output Format
Every analysis execution must produce a structured impact report detailing:
1. **Target Architecture & Module Scope:** Identification of affected models and domain boundaries.
2. **Skill Routing:** Mapping of exact sub-tasks to the 7 scope-locked writer skills (`ktc-schema-guardian`, `ktc-foundation-architect`, `ktc-middleware-specialist`, `ktc-feature-builder`, `ktc-app-api-specialist`, `ktc-admin-api-specialist`, `ktc-docs-maintainer`).
3. **Downstream Blast Radius:** Direct and indirect dependencies across database relations, foreign keys, service strategies, and shared middleware.
4. **Execution Phasing:** Strict sequencing of tasks (e.g., Schema -> Core/Strategy -> Service/Repository -> Surface Routes -> Docs) indicating parallel versus blocking steps.

## 6. Stop & Ask Protocol
- If a proposed change conflicts with a locked invariant defined in `ARCHITECTURE.md` (e.g., introducing direct P2P trading, adding DB unique constraints on phone/email, or bypassing canonical base units), the analyzer must immediately halt the planning process and document the conflict for engineering review.
