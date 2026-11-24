# Module 1: Auth & Multi-Role Progressive Onboarding

## Overview
Provides authentication, PIN credentials, rotating refresh-token sessions, and progressive multi-role onboarding (Buyer & Farmer) for the unified mobile app and web portal.

## Endpoints

| Method | Endpoint | Auth Required | Rate Limit | Description |
|---|---|---|---|---|
| `POST` | `/api/v1/auth/otp/send` | No | Strict (5 / 15m) | Sends 6-digit OTP via Email or SMS |
| `POST` | `/api/v1/auth/register` | No | Auth (20 / 15m) | Registers user with unique phone/email, sets 4-digit PIN |
| `POST` | `/api/v1/auth/login/pin` | No | Auth (20 / 15m) | Logs in via phone/email + PIN (5-attempt 15-min lockout) |
| `POST` | `/api/v1/auth/login/otp` | No | Strict (5 / 15m) | Passwordless login via verified OTP |
| `POST` | `/api/v1/auth/onboarding/farmer` | Yes (`BUYER`) | API | Upgrades user to `FARMER`, creates `FarmerProfile`, returns fresh JWT with `activeRole: FARMER` |
| `POST` | `/api/v1/auth/pin/reset` | No | Auth (20 / 15m) | Resets PIN using a verified OTP challenge token |
| `POST` | `/api/v1/auth/token/refresh` | No | API | Rotates refresh token in `UserSession`, issues fresh access token |
| `POST` | `/api/v1/auth/logout` | Yes | API | Revokes the current `UserSession` record |
| `POST` | `/api/v1/auth/verify-identifier` | Yes | API | Marks secondary email or phone as verified |
| `GET` | `/api/v1/auth/me` | Yes | API | Returns user profile, active roles, and assigned hub staff profile |

## Domain Rules & Invariants
- **Service-Enforced Uniqueness:** Uniqueness of phone and email is validated inside transactions.
- **PIN Lockout:** 5 consecutive failed PIN attempts locks the account for 15 minutes (`pinLockedUntil`).
- **Session Rotation:** Each refresh token issuance replaces the previous hash in `UserSession`.
- **Immediate JWT Role Promotion:** Calling `/onboarding/farmer` immediately issues and returns a fresh access token containing `activeRole: 'FARMER'` so mobile clients can immediately access Farmer routes without an extra refresh.
