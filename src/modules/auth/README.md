# Module 1: Auth & Multi-Role Progressive Onboarding

## Overview
Provides authentication, 6-digit numeric PIN security, rotating refresh-token sessions, progressive multi-role onboarding (`BUYER` & `FARMER`), and Option A step-by-step Farmer e-KYC persistence for the unified mobile app and web portal.

## Endpoints

| Method | Endpoint | Auth Required | Rate Limit | Description |
|---|---|---|---|---|
| `POST` | `/api/v1/auth/otp/send` | No | Strict (5 / 15m) | Sends 6-digit OTP via Email or SMS (pre-checks verified duplicates on `REGISTER`) |
| `POST` | `/api/v1/auth/register` | No | Auth (20 / 15m) | Registers user with verified Email OTP, normalizes phone, sets 6-digit PIN |
| `POST` | `/api/v1/auth/login/pin` | No | Auth (20 / 15m) | Logs in via phone/email + 6-digit PIN (5-attempt 15-min lockout) |
| `POST` | `/api/v1/auth/login/otp` | No | Strict (5 / 15m) | Passwordless login via verified OTP |
| `GET` | `/api/v1/auth/onboarding/farmer/status` | Yes | API | Returns Farmer e-KYC step progress and stored KYC records |
| `PUT` | `/api/v1/auth/onboarding/farmer/identity` | Yes | API | Step 1: Saves legal name, father/spouse name, Aadhaar verification & photo key |
| `PUT` | `/api/v1/auth/onboarding/farmer/location` | Yes | API | Step 2: Saves farm location, land size, primary crops & PostGIS farm coordinates |
| `PUT` | `/api/v1/auth/onboarding/farmer/payout` | Yes | API | Step 3: Saves default Bank Account or UPI VPA, marks KYC complete & rotates tokens |
| `POST` | `/api/v1/auth/onboarding/farmer` | Yes | API | Legacy single-step Farmer profile onboarding endpoint |
| `POST` | `/api/v1/auth/pin/reset` | No | Auth (20 / 15m) | Resets 6-digit PIN using verified `RESET_PIN` OTP and revokes sessions |
| `POST` | `/api/v1/auth/token/refresh` | No | API | Verifies hashed refresh token, rotates `UserSession` hash, issues fresh tokens |
| `POST` | `/api/v1/auth/switch-role` | Yes | API | Switches active role (`BUYER`, `FARMER`, or authorized staff/admin role) |
| `POST` | `/api/v1/auth/logout` | Yes | API | Revokes the current `UserSession` record |
| `POST` | `/api/v1/auth/verify-identifier` | Yes | API | Marks secondary email or phone as verified |
| `GET` | `/api/v1/auth/me` | Yes | API | Returns sanitized user profile, roles, onboarding status & staff assignments |
