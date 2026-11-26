# Module 4: Centralized Pricing & Margin Engine

## Overview
Manages Global Network Benchmark rates (`hubId = null`) and Hub-Specific Override rates (`hubId = <uuid>`) for dynamic `CropVariety.gradeSpecs` grade codes, computing precise decimal margins (`Prisma.Decimal`), bulk tier discounts, and lifecycle transitions (`DRAFT`, `PUBLISHED`, `ARCHIVED`) with immutable `AuditLog` entries.

## Admin Endpoints (`/api/v1/admin/pricing`)

| Method | Endpoint | Guard | Description |
|---|---|---|---|
| `GET` | `/rates` | `MANDI_RATE:VIEW` | Paginated, hub-scoped list of rates (`search`, `scope`, `hubId`, `categoryId`, `cropId`, `varietyId`, `gradeCode`, `status`, `effectiveDate`) |
| `GET` | `/resolve` | `MANDI_RATE:VIEW` | Resolves active `PUBLISHED` rate prioritizing hub override over global benchmark |
| `GET` | `/rates/:id` | `MANDI_RATE:VIEW` | Single rate detail with variety/crop/hub relations |
| `POST` | `/rates` | `SET_GLOBAL` / `SET_HUB` | Creates rate; defaults `minRatePerUnit`/`maxRatePerUnit`/`baseRatePerUnit` to `farmerBuyRate` when omitted |
| `POST` | `/rates/bulk-upsert` | `SET_GLOBAL` / `SET_HUB` | Bulk upserts up to 50 daily rates inside a single transaction |
| `PATCH` | `/rates/:id` | `SET_GLOBAL` / `SET_HUB` | Updates pricing/tiers/metadata and recalculates `marginPercent` |
| `PATCH` | `/rates/:id/status` | `SET_GLOBAL` / `SET_HUB` | Transitions `DRAFT` \| `PUBLISHED` \| `ARCHIVED`; publishing archives conflicting `PUBLISHED` rates for the same `(hubId, cropVarietyId, gradeCode, rateDate)` |

## Shared Domain Service
- `pricingService.getActiveRate(varietyId, hubId, gradeCode, asOfDate)` is shared and reusable across `/api/v1/app/*`, GRN intake, and buyer order pricing.
