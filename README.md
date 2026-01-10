# Flight Training Super App

A production-minded MVP for flight tracking, logbook management, and training cost capture.

## Features
- Flight tracking with Leaflet map + polyline rendering.
- Pilot logbook entry management.
- Cost + receipt tracking with secure downloads.
- ADS-B import via provider interface (mock provider for `N12345`).
- Lucia authentication with Argon2id password hashing and approval gating.
- Planned flight lifecycle tracking with checklist sign-offs.
- Preflight/postflight checklist templates and per-flight checklist runs.

## Data model highlights
- Flights track planned times, actual times, import metadata, and lifecycle status.
- Checklist templates (system or user) with ordered items for preflight/postflight.
- Per-flight checklist runs snapshot template items and record sign-offs.

## Local development

### Quick start (local terminal)
```bash
npm install
cp .env.example .env
npm run db:migrate
npm run db:generate
npm run dev
```

### 1) Install dependencies
```bash
npm install
```

### 2) Configure environment
```bash
cp .env.example .env
```
Update `DATABASE_URL` for your PostgreSQL instance.

### 3) Run Prisma migrations + generate client
```bash
npm run db:migrate
npm run db:generate
```

### 4) (Optional) Seed an admin user
```bash
SEED_ADMIN_EMAIL=admin@example.com SEED_ADMIN_PASSWORD=change-me-please npx prisma db seed
```
Seeding also creates system default preflight and postflight checklist templates.

### 5) Start the dev server
```bash
npm run dev
```

## Useful scripts
- `npm run dev` — run Next.js in development
- `npm run build` — build for production
- `npm run start` — run production build
- `npm run test` — run Vitest in CI-style mode
- `npm run test:watch` — run Vitest in watch mode
- `npm run test:coverage` — run tests with line-by-line coverage output

## Security notes
- Session cookies are HttpOnly and SameSite=Lax, secure in production.
- All data access is scoped to the authenticated user.
- Receipts are stored under `/uploads` and downloaded through auth-checked endpoints.

## ADS-B providers
The `app/lib/adsb.ts` provider interface makes it easy to integrate a real ADS-B data source later. The mock provider returns sample flights for tail number `N12345`.
