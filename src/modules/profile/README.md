# Module 1B: Profile, Preferences, Addresses & Bank Account Management

## Overview
Provides authenticated mobile endpoints for inspecting combined KYC/profile status, updating basic profile fields (`name`, `languagePref`, `avatarKey`), alert preferences, Buyer business details (`BuyerProfile`), saved delivery addresses (`Address`), and Farmer/User Bank & UPI payout accounts.

## Endpoints

| Method | Endpoint | Auth Required | Description |
|---|---|---|---|
| `GET` | `/api/v1/app/profile/kyc-status` | Yes | Returns sanitized user, Farmer/Buyer profiles, preferences, Aadhaar document, addresses, bank accounts, and onboarding state |
| `PATCH` | `/api/v1/app/profile` | Yes | Updates basic profile fields, `languagePref`, alert `preferences`, and `buyerProfile` fields |
| `GET` | `/api/v1/app/profile/bank-accounts` | Yes | Lists saved Bank / UPI payout accounts (masked account numbers) |
| `POST` | `/api/v1/app/profile/bank-accounts` | Yes | Adds or updates a Bank Account (`BANK`) or UPI VPA (`UPI`) |
| `PATCH` | `/api/v1/app/profile/bank-accounts/:id/default` | Yes | Marks an account as the default settlement destination |
| `DELETE` | `/api/v1/app/profile/bank-accounts/:id` | Yes | Deletes a payout account (if not linked to historical settlements) |
| `GET` | `/api/v1/app/profile/addresses` | Yes | Lists saved Buyer delivery addresses (`label != FARM`) ordered by default/recent |
| `POST` | `/api/v1/app/profile/addresses` | Yes | Creates a delivery address (and PostGIS `location` when `latitude`/`longitude` provided) |
| `PATCH` | `/api/v1/app/profile/addresses/:id` | Yes | Updates an existing delivery address |
| `PATCH` | `/api/v1/app/profile/addresses/:id/default` | Yes | Promotes an address as the default delivery destination |
| `DELETE` | `/api/v1/app/profile/addresses/:id` | Yes | Deletes a saved delivery address (if not referenced by orders) |
