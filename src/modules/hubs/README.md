# Module 2: Hubs, Geolocation & Staff Management

## Overview
Manages KTC physical procurement hubs, PostGIS 25km radius discovery, staff assignments, and automated cash account provisioning for hub operations.

## Endpoints

| Method | Endpoint | Auth Required | RBAC Guard | Description |
|---|---|---|---|---|
| `POST` | `/api/v1/hubs` | Yes | `ADMIN`, `SUPER_ADMIN` | Creates new hub, PostGIS Point location, and auto-provisions `HUB_SAFE` cash account |
| `GET` | `/api/v1/hubs/nearby` | Optional | Public / Authenticated | 25km radius search by `lat`/`lng`, `addressId`, or user default address, returning `distanceKm` |
| `GET` | `/api/v1/hubs` | No | Public | Paginated list of active hubs |
| `GET` | `/api/v1/hubs/:id` | No | Public | Details of a single hub |
| `PATCH` | `/api/v1/hubs/:id` | Yes | `HUB_POLICY` | Root bypass for Admins; `HUB_MANAGER` restricted to operational fields (`operatingHours`, `contactPhone`, `metadata`) of assigned hub |
| `POST` | `/api/v1/hubs/:id/staff` | Yes | `STAFF_POLICY` | Assigns staff member to hub; auto-provisions `OPERATOR_CASH_IN_HAND` cash account for `STORE_OPERATOR` |
| `GET` | `/api/v1/hubs/:id/staff` | Yes | `STAFF_POLICY` | Lists active staff assignments for a hub |
| `DELETE` | `/api/v1/hubs/:id/staff/:staffId` | Yes | `STAFF_POLICY` | Deactivates a staff assignment |

## Domain Rules & Invariants
- **Spatial Indexing & Radius:** Location stored as `geography(Point, 4326)` with PostGIS GiST index. `ST_DWithin` calculates nearby hubs within configurable radius (default 25km).
- **Automated Cash Provisioning:**
  - Creating a `KtsHub` auto-provisions a `HUB_SAFE` `CashAccount` in the same database transaction.
  - Assigning a user as `STORE_OPERATOR` auto-provisions an `OPERATOR_CASH_IN_HAND` `CashAccount` for them at that hub if one does not already exist.
- **RBAC Boundaries:** Creation and deactivation are strictly reserved for `ADMIN` and `SUPER_ADMIN`. `HUB_MANAGER` is strictly scoped to their assigned hub for staff and operational edits.
