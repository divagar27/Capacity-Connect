# Prototype capability and readiness notes

Capacity Connect is a working software prototype for a digital capacity-building and learning portal. It is not an official IMD/MoES deployment, standards certification, or production-ready identity service. The demo dataset is fictional and explicitly labelled.

## Current workflows

### Authentication and access

- Google OAuth uses a browser-generated `state` and PKCE code verifier when an OAuth client is configured.
- Administrators can review pending accounts and assign an approved role.
- A role-switching demo login is available only when `NODE_ENV` is not `production`.
- JWTs are stored in HTTP-only cookies; refresh tokens are rotated and stored hashed.

### Training and course management

- Public catalogue entries are published courses from PostgreSQL.
- Trainees can enroll, read lesson text, record sequential lesson completion, and see actual stored progress.
- Trainers can create draft courses, add lessons and assessments, upload course resources through MinIO, and submit drafts.
- Administrators can publish only submitted courses.

### Assessments and training records

- Assessment answers are delivered without the correct-answer flags.
- The API validates enrollment, attempt ownership, assessment question/option membership, and attempt expiry.
- Scores and answer review are computed from the saved attempt on the server.
- A training record requires 100% lesson completion and a passing published assessment attached to the same course.
- Serial lookup confirms a saved record in this app. It is not an external registry lookup or official credential verification.

### Profiles and trainer directory

- Profiles store user-entered contact details, qualifications, experience, certificates, and declared skill levels.
- Learners may set current and target skill levels. Learning paths use taxonomy IDs and explicit course mappings.
- Trainer search uses deterministic weights over those profile entries plus published course and platform-recorded feedback data.
- Profile information is not independently verified. The score is a profile match, not an accreditation.

### Administration

- Admin screens use current database counts for user, course, enrollment, assessment, and profile skill records.
- Announcement creation, removal, account approval, and course publication are wired to API endpoints.
- Audit log entries are application audit events; their presence does not establish GIGW or other compliance certification.

## Prototype boundaries

- Email and external notifications are not delivered; no provider is configured.
- ClamAV is optional and disabled in the example environment. Configure a scanner before accepting uploads where malware scanning is required.
- The lesson search API searches actual saved lesson text. There is no AI question-generation endpoint or generated-tutor chat UI.
- The sample accounts, trainer details, competencies, courses, and questions are made-up demonstration records.
- PostgreSQL is the supported database. The repository does not yet have a Prisma migration history; local setup uses `prisma db push`.
- The app has unit tests and production builds, but this repository has no automated full-stack test against a provisioned PostgreSQL/Redis/MinIO stack.

## Local verification commands

Run from the repository root after installing dependencies and configuring the API environment:

```powershell
npm run prisma:generate --workspace=@capacity-connect/api
npm run prisma:push --workspace=@capacity-connect/api
npm run prisma:seed --workspace=@capacity-connect/api
npm run build
npm test
```

See the root [README](../README.md) for setup details and the [demo walkthrough](SIH_DEMO_SCRIPT.md) for a sample evaluation path.

## Environment reference

The example environment is [`infra/.env.example`](../infra/.env.example). `DATABASE_URL` is a PostgreSQL connection string. Replace the development signing secrets and configure `ADMIN_EMAILS`, OAuth, storage, and `CERTIFICATE_ISSUER` for the intended environment. Do not commit `.env` files or credential exports.
