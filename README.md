# Capacity Connect

Capacity Connect is a prototype learning and capacity-building portal for meteorological training. It combines a Next.js 16 web app, a NestJS 10 API, Prisma, and PostgreSQL.

The checked-in sample courses, accounts, profile details, competencies, and announcements are fictional demo data. This project is not an official IMD or MoES service, credential verifier, or competency standard. Profile qualifications and declared skill levels are not independently verified. A certificate serial confirms that a record exists in this application; it is not an external government registry lookup.

## Implemented workflows

- **Trainees:** browse published courses, enroll, read lessons, record sequential lesson completion, set current and target skill levels, follow course mappings, take course assessments, review results, and request an eligible training record.
- **Trainers:** create draft courses, add modules and lesson text, create a course assessment, upload resources to S3-compatible storage, review actual participation, and submit a course for administrator approval.
- **Administrators:** approve or reject accounts, assign roles, publish submitted courses, publish or remove announcements, and review current counts and recorded skill data.
- **Shared:** Google OAuth with state and PKCE when credentials are configured, non-production sample role access, profile records, a trainer directory ranked from declared and platform-recorded data, and serial lookup for platform training records.
- **Lesson search API:** local extractive search over lesson text for enrolled trainees. It returns no generated answer when lesson text has no matching content. No AI question-generation endpoint is exposed.

The prototype does not send email or external notifications. Approval notifications are reported as unavailable until a delivery provider is configured. File uploads use S3-compatible storage through the MinIO client. ClamAV scanning is optional and disabled in the development example environment.

## Requirements

- Node.js 20.9 or newer and npm 10 or newer
- PostgreSQL 16
- Docker Compose for local PostgreSQL and Redis (or equivalent services)

Redis is used for the shared token blacklist when available; the API falls back to an in-memory blacklist when Redis is offline. An S3-compatible service is needed for trainer file uploads and media downloads. The main course and assessment workflows use PostgreSQL.

## Local setup (PowerShell)

From the repository root:

```powershell
npm ci
Copy-Item infra/.env.example infra/.env
Copy-Item infra/.env.example apps/api/.env
```

Edit `infra/.env` and `apps/api/.env` before starting. Use different, randomly generated `JWT_SECRET` and `REFRESH_TOKEN_SECRET` values of at least 32 characters. Set `ADMIN_EMAILS` to the exact Google account addresses that should bootstrap as administrators; leave it blank if none should. Google sign-in requires a Google OAuth client and the registered redirect URI `http://localhost:3000/auth/callback`.

Start the database and cache services:

```powershell
docker compose --env-file infra/.env -f infra/docker-compose.yml up -d postgres redis
```

The MinIO Community Edition is now distributed as source code, so the old `minio/minio:latest` image in the optional Compose service may not be pullable. Trainer uploads and media downloads require an available S3-compatible service configured with the `MINIO_*` settings in `apps/api/.env`.

The example database URL expects the default local Compose values (`postgres:postgres`, database `capacity_connect`, port `5432`). If you change the Compose database settings, update `DATABASE_URL` in `apps/api/.env` to match.

Generate Prisma Client and apply the schema to a new local development database:

```powershell
npm run prisma:generate --workspace=@capacity-connect/api
npm run prisma:push --workspace=@capacity-connect/api
npm run prisma:seed --workspace=@capacity-connect/api
```

`prisma:push` changes the target database schema. Use it for a local development database that you control; review the schema change before pointing it at any database with existing data. The seed adds or updates clearly marked sample records. Running the seed again restores seeded profile and enrollment examples to their sample values.

Start the API and web app in separate terminals:

```powershell
npm run dev:api
npm run dev:web
```

Open [http://localhost:3000](http://localhost:3000). The API listens at [http://localhost:4000/api/v1](http://localhost:4000/api/v1), and Swagger is at [http://localhost:4000/api/v1/docs](http://localhost:4000/api/v1/docs). The Next.js API rewrite defaults to `http://localhost:4000`; set `API_INTERNAL_URL` in the web process environment when the API is hosted elsewhere.

## Sample walkthrough

1. Sign in at `/auth/login` with **Continue as Trainee**. The non-production sample account is `trainee@demo.local` and is labelled in the interface.
2. Open **Statistical Foundations for Environmental Data**, which starts at 50% progress. Complete the remaining lesson, then take the linked **Statistical Foundations Check**.
3. After passing the course assessment and reaching 100% lesson completion, issue a platform training record. Use its `CC-...` serial at `/verify` to look up the saved record.
4. Switch roles at `/auth/login` with **Continue as Trainer**. Create a draft, add lesson content and an assessment, then submit it.
5. Switch to **Continue as Admin** to publish the submitted course and review account requests or announcements.

These accounts and course records are for local prototype review. The demo role switch is disabled when `NODE_ENV=production`.

## Build and tests

```powershell
npm run build
npm test
npm run typecheck --workspace=@capacity-connect/web
```

The build runs the shared package, API, and Next.js production builds in order. The root test command builds the shared package first, then runs the API Jest suite.

## Configuration and deployment notes

- Keep `.env` files, OAuth credentials, signing secrets, and `atlas-credentials.env.txt` out of source control.
- Use production-grade, unique secrets and a real PostgreSQL service before deployment. Demo role access is only for non-production environments.
- Set `NODE_ENV=production`, `FRONTEND_URL`, `API_INTERNAL_URL`, database and storage credentials, and an explicit administrator allowlist.
- Configure a real notification provider before relying on email or out-of-band alerts.
- Configure ClamAV and set `ENABLE_VIRUS_SCAN=true` before accepting uploads in an environment that requires file scanning.
- Configure the certificate issuer name for the deployment. Issued records remain Capacity Connect records unless the operating organization authorizes another status.
- The repository has no Prisma migration history yet; the local setup uses `prisma db push`. Create and review migrations before adopting a production release process.
