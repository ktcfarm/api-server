# Module: Storage & Direct Upload Presigning

## 1. Overview
Provides provider-agnostic asset storage abstraction and presigned direct-to-cloud upload authorization for public media assets and private compliance documents. Bypasses application server binary streaming by generating authenticated upload targets for Cloudflare R2 (S3-compatible) or Cloudinary.

## 2. Endpoints

| Method | Endpoint | Auth Required | RBAC / Access Guard | Description |
|---|---|---|---|---|
| `POST` | `/api/v1/storage/presign-upload` | Yes | Authenticated User | Generates client-direct upload target URL, HTTP method, and bucket classification based on file purpose |
| `GET` | `/api/v1/storage/access-url` | Yes | Resource Owner or Staff / Admin | Resolves public CDN URL or generates time-bounded signed access URL for private assets |

## 3. Domain Rules & Invariants
- **Bucket Isolation:**
  - `PUBLIC` bucket: Holds public commodities imagery (`CROP_PHOTO`) and user avatars (`PROFILE_PHOTO`). Resolved directly through CDN base URL.
  - `PRIVATE` bucket: Holds confidential verification documents (`KYC_DOCUMENT`) and dispute evidence (`DISPUTE_EVIDENCE`). Requires dynamic signature generation.
- **IDOR Protection on Private Assets:** Retrieval of private access URLs enforces strict ownership. Non-privileged callers may access only private assets residing within their own user key prefix (`/userId/`). Privileged roles (`STORE_OPERATOR`, `HUB_MANAGER`, `ADMIN`, `SUPER_ADMIN`) have cross-user inspection privileges for compliance verification.
- **Provider Agnosticism:** Service logic consumes the singleton exported from `src/core/storage/storage.factory.js`. Storage backends can be swapped via environment configuration without modifying controller or route layers.
