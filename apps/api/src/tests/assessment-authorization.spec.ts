import { BadRequestException, ForbiddenException, NotFoundException } from '@nestjs/common';
import { AssessmentAttemptStatus } from '@capacity-connect/shared';
import { AssessmentsService } from '../modules/assessments/assessments.service';
import { PrismaService } from '../prisma/prisma.service';

describe('AssessmentsService authorization', () => {
  it('does not start a fabricated assessment id', async () => {
    const prisma = { questionnaire: { findUnique: jest.fn().mockResolvedValue(null) } } as unknown as PrismaService;
    const service = new AssessmentsService(prisma);

    await expect(service.startTest('made-up-id', 'trainee-1')).rejects.toBeInstanceOf(NotFoundException);
  });

  it('requires enrollment before starting a course assessment', async () => {
    const prisma = {
      questionnaire: { findUnique: jest.fn().mockResolvedValue({
        id: 'assessment-1', status: 'PUBLISHED', courseId: 'course-1', course: { status: 'PUBLISHED' },
        questions: [], startAt: null, deadline: null,
      }) },
      courseEnrollment: { findUnique: jest.fn().mockResolvedValue(null) },
    } as unknown as PrismaService;
    const service = new AssessmentsService(prisma);

    await expect(service.startTest('assessment-1', 'trainee-1')).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('rejects an answer that belongs to another assessment', async () => {
    const prisma = {
      assessmentAttempt: { findUnique: jest.fn().mockResolvedValue({
        id: 'attempt-1', userId: 'trainee-1', status: AssessmentAttemptStatus.IN_PROGRESS,
        endsAt: new Date(Date.now() + 60_000), questionnaire: { questions: [{ id: 'question-1', options: [{ id: 'option-1' }] }] },
      }) },
      attemptAnswer: { upsert: jest.fn() },
    } as unknown as PrismaService;
    const service = new AssessmentsService(prisma);

    await expect(service.autosaveAnswers('attempt-1', 'trainee-1', [{ questionId: 'other-question', selectedOptionId: 'option-1' }]))
      .rejects.toBeInstanceOf(BadRequestException);
    expect((prisma as any).attemptAnswer.upsert).not.toHaveBeenCalled();
  });
});
