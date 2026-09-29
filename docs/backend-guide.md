# Backend API guide

Capacity Connect uses a NestJS 10 API with Prisma and PostgreSQL. The Next.js app calls it through a same-origin `/api/v1/*` rewrite.

## Runtime components

- **NestJS:** REST controllers, request validation, session and role guards, and API response formatting.
- **PostgreSQL / Prisma:** accounts, profiles, courses, lessons, enrollments, assessments, feedback, announcements, and training records.
- **Redis:** shared JWT revocation state when available; a local in-memory fallback is used when Redis is unavailable.
- **MinIO:** file storage for trainer course resources.
- **ClamAV:** optional upload scanning; `ENABLE_VIRUS_SCAN` is false in the development example.
- **Swagger:** generated API docs at `/api/v1/docs`.

## Module map

```text
apps/api/
├── prisma/
│   ├── schema.prisma
│   └── seed.ts
└── src/
    ├── common/             # Guards, decorators, DTOs, filters, interceptors
    ├── modules/
    │   ├── auth/           # Google OAuth, demo access, JWT and refresh sessions
    │   ├── users/           # Current user and admin account lifecycle
    │   ├── profiles/       # Qualifications, experience and skill levels
    │   ├── courses/        # Catalogue, authoring, enrollment and progress
    │   ├── library/        # Visibility-aware resource search and access
    │   ├── media/          # MinIO file upload and streaming URLs
    │   ├── assessments/    # Timed attempts, answer validation and grading
    │   ├── certificates/   # Platform training record issue and lookup
    │   ├── competency/     # Taxonomy mappings, learning paths and trainer matching
    │   ├── cms/            # Public announcements
    │   ├── reports/        # Admin counts and CSV export
    │   ├── audit-log/      # Application audit events
    │   └── ai/             # Enrolled-course lesson text search and recommendations
    └── main.ts
```

## Local startup

Follow the [root README](../README.md) to configure environment files and start PostgreSQL, Redis, and MinIO. The API can run without Redis; MinIO is needed only for uploads.

```powershell
npm run prisma:generate --workspace=@capacity-connect/api
npm run prisma:push --workspace=@capacity-connect/api
npm run prisma:seed --workspace=@capacity-connect/api
npm run dev:api
```

Open [Swagger](http://localhost:4000/api/v1/docs) after the API starts. Local schema setup uses `db push` because there are no checked-in migration files yet; do not point it at an existing database without reviewing the schema change.

## API behavior and security notes

- Protected routes use JWT session cookies and role/status checks. Demo switching is rejected when `NODE_ENV=production`.
- Course and assessment operations check ownership, publication status, enrollment, and attempt membership in the API.
- Published assessment payloads omit `isCorrect`; grading and answer review happen after submission on the server.
- Resource searches combine search filters with visibility rules. Stream URLs require access to the resource.
- The trainer directory labels profile data as declared or platform-recorded; it does not claim to verify a qualification.
- Training record verification checks the local database record. It does not contact an external organization.
- Email and notification delivery providers are not configured. The API reports that no message was sent.

See [`SIH_SUBMISSION_READINESS.md`](SIH_SUBMISSION_READINESS.md) for prototype scope and limitations.
