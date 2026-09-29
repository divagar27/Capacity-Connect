# Five-minute prototype walkthrough

This walkthrough uses fictional, seeded records in a local development environment. Do not present the sample accounts, course content, trainer profiles, or platform training records as official IMD/MoES data or credentials.

## Before the walkthrough

1. Start PostgreSQL, Redis, and MinIO with the local Compose setup in the [README](../README.md).
2. Generate Prisma Client, push the schema, seed the sample dataset, and start the API and web app.
3. Open [http://localhost:3000](http://localhost:3000). Sample role access is available only outside production.

## Minute 1 — Find a course and continue learning

1. Open **Training catalogue** and view one of the published sample courses.
2. Go to `/auth/login` and choose **Continue as Trainee**.
3. In the trainee workspace, point out the sample profile, saved skill levels, course mapping, and current enrollment progress.
4. Open **Statistical Foundations for Environmental Data**. The demo enrollment begins at 50% with its first lesson complete.

## Minute 2 — Complete a lesson and assessment

1. Read the second lesson and mark it complete. The API checks lesson order and stores progress.
2. Open the linked **Statistical Foundations Check**. Select answers and show the saved state and assessment timer.
3. Submit the assessment and inspect the server returned score and answer review.
4. Issue the training record after both requirements are met: 100% lesson progress and a passing assessment attached to this course.
5. Open the generated serial at `/verify` to show the record stored in this Capacity Connect instance.

## Minute 3 — Author a course

1. Return to `/auth/login` and choose **Continue as Trainer**.
2. Create a draft course with a subject and learning objectives.
3. Add a module and lesson with actual text, then add a short assessment.
4. If MinIO is running, upload a small PDF or slide deck and attach it to the course.
5. Submit the course for review. It remains out of the public catalogue until an administrator publishes it.

## Minute 4 — Review and publish

1. Choose **Continue as Admin**.
2. Review the pending user queue and select an appropriate role to approve a sample request.
3. Open the submitted course queue and publish the trainer's draft.
4. Add an announcement and confirm it appears in the public portal.

## Minute 5 — Review trainer matching and limits

1. Open **Find trainers** and search for a subject represented in the sample data.
2. Expand a trainer's evidence view. Explain that the score combines declared profile skills, qualifications and experience with platform-recorded published courses and feedback.
3. Point out the sample label. Profile credentials and skill levels are not verified by the app, and a match score is not an accreditation or quality certificate.

## Expected limitations

- Google OAuth requires configured credentials; the non-production demo role switch is available without Google credentials.
- Email and external admin notifications are not delivered because no delivery provider is configured.
- ClamAV is optional and disabled in the local example. MinIO is required for file upload.
- Course examples and demonstration identities are fictional. Certificates are platform records and are not issued by an external government registry.
