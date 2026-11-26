# Module 3: Crop Catalogue, Perishability, Dynamic Grades & Unit Conversions

## 1. Overview
Provides the commodity hierarchy (`Category` → `Crop` → `CropVariety`) powering procurement, daily mandi pricing, GRN weighing, hub inventory, and buyer ordering. Enforces canonical storage base units (`KG` / `PIECE`), perishability classification (`PERISHABLE` / `NON_PERISHABLE`), customizable per-crop and per-variety trade unit conversions, dynamic per-variety quality grade specifications, and immutable transactional audit logging.

## 2. Admin Endpoints (`/api/v1/admin/catalog/*`)

| Method | Endpoint | Auth | RBAC Guard | Description |
|---|---|---|---|---|
| `GET` | `/api/v1/admin/catalog/meta` | Yes | `CROP:VIEW` | Returns base units, trade units, perishability types, grade presets, and conversion presets |
| `GET` | `/api/v1/admin/catalog/categories` | Yes | `CROP:VIEW` | Paginated, searchable list of crop categories with crop counts |
| `POST` | `/api/v1/admin/catalog/categories` | Yes | `CROP:CREATE` | Creates a bilingual category and writes an `AuditLog` record |
| `GET` | `/api/v1/admin/catalog/categories/:id` | Yes | `CROP:VIEW` | Retrieves single category detail and child crops |
| `PATCH` | `/api/v1/admin/catalog/categories/:id` | Yes | `CROP:UPDATE` | Updates category fields and records `AuditLog` snapshot |
| `DELETE` | `/api/v1/admin/catalog/categories/:id` | Yes | `CROP:DELETE` | Deletes category if zero child crops exist; otherwise throws `409 Conflict` |
| `GET` | `/api/v1/admin/catalog/crops` | Yes | `CROP:VIEW` | Paginated list of master crops filtered by `categoryId`, `baseUnit`, `perishabilityType`, `isActive`, and `search` |
| `POST` | `/api/v1/admin/catalog/crops` | Yes | `CROP:CREATE` | Creates master crop with canonical `baseUnit`, `perishabilityType`, `shelfLifeDays`, and default `unitConversions` |
| `GET` | `/api/v1/admin/catalog/crops/:id` | Yes | `CROP:VIEW` | Retrieves crop detail, effective unit conversions, and child varieties |
| `PATCH` | `/api/v1/admin/catalog/crops/:id` | Yes | `CROP:UPDATE` | Updates master crop; blocks `baseUnit` mutation if varieties already exist |
| `DELETE` | `/api/v1/admin/catalog/crops/:id` | Yes | `CROP:DELETE` | Deletes crop if zero child varieties exist |
| `GET` | `/api/v1/admin/catalog/varieties` | Yes | `CROP:VIEW` | Paginated varieties filtered by `categoryId`, `cropId`, `baseUnit`, `perishabilityType`, `grade` (JSONB containment), and `isActive` |
| `POST` | `/api/v1/admin/catalog/varieties` | Yes | `CROP:CREATE` | Creates variety with bilingual names, `unitConversions` overrides, and dynamic `gradeSpecs` array |
| `GET` | `/api/v1/admin/catalog/varieties/:id` | Yes | `CROP:VIEW` | Retrieves variety detail, `effectiveUnitConversions`, `gradeSpecs`, and downstream usage counts |
| `PATCH` | `/api/v1/admin/catalog/varieties/:id` | Yes | `CROP:UPDATE` | Updates variety translations, unit overrides, grade specs, and status |
| `DELETE` | `/api/v1/admin/catalog/varieties/:id` | Yes | `CROP:DELETE` | Deletes variety only if unreferenced by rates, listings, tokens, GRNs, inventory, or orders |

## 3. Domain Rules & Invariants
- **Canonical Storage Unit Lock:** `Crop.baseUnit` (`KG` or `PIECE`) cannot be altered once child `CropVariety` records exist.
- **Conversion Resolution:** `catalogService.resolveEffectiveUnitConversions(crop, variety)` merges `{ [crop.baseUnit]: 1, ...crop.unitConversions, ...variety.unitConversions }`, allowing variety-specific packaging overrides (e.g., `BAG = 25 KG` vs `50 KG`).
- **Dynamic Per-Variety Grade Specs:** `CropVariety.gradeSpecs` stores an array of `{ code, label, labelHi, maxMoisturePercent, maxForeignMatterPercent, notes }` with unique normalized uppercase `code`s per variety, supporting commodity-specific grades such as `GRADE_A`, `FAQ`, `BROKEN_5`, or `BOLD_GRAIN`.
- **RBAC Split (`CropPolicy`):** `SUPER_ADMIN` and `ADMIN` hold full CRUD across all endpoints. `HUB_MANAGER`, `STORE_OPERATOR`, `FARMER`, and `BUYER` hold read-only (`CROP:VIEW`) permissions evaluated against `user.activeRole`.
