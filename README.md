# api-server

Backend API server for **KTC (Krishi Trade Center / Mandi Exchange)**, a hub-and-spoke agricultural procurement platform and commodity marketplace connecting farmers, bulk buyers, and KTC store employees/admins.

## Tech Stack
- **Runtime:** Node.js (ES Modules, `"type": "module"`), pure modern JavaScript
- **Framework:** Express
- **Database & Spatial Engine:** PostgreSQL with PostGIS on Supabase
- **ORM:** Prisma v6.19.3
- **Storage:** Provider-agnostic `BaseStorageProvider` (Cloudflare R2 / Cloudinary)
- **Email:** Provider-agnostic `BaseEmailProvider` (`services.theerrors.in`)

## Getting Started

### Prerequisites
- Node.js >= 20.x
- PostgreSQL with PostGIS extension (Supabase)

### Installation
```bash
npm install
```

### Environment Configuration
Copy `.env.example` to `.env` and configure the database and service secrets:
```bash
cp .env.example .env
```

### Database Synchronization
```bash
npx prisma generate
npx prisma db push
```

### Running the Server
```bash
# Development
npm run dev

# Production
npm start
```

## Architecture & Domain Invariants
Complete architectural specifications, domain invariants, RBAC policy guidelines, and module progress are documented in [ARCHITECTURE.md](ARCHITECTURE.md).
