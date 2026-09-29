import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { AssessmentAttemptStatus, Role } from '@capacity-connect/shared';

@Injectable()
export class AssessmentsService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Trainer: Create questionnaire with questions & options
   */
  async createQuestionnaire(trainerId: string, data: any) {
    if (!data?.title?.trim() || !data.subjectId || !Array.isArray(data.questions) || data.questions.length === 0) {
      throw new BadRequestException('An assessment needs a title, subject, and at least one question');
    }

    if (data.courseId) {
      const course = await this.prisma.course.findUnique({ where: { id: data.courseId } });
      if (!course) throw new NotFoundException('Course not found');
      const author = await this.prisma.user.findUnique({ where: { id: trainerId }, select: { role: true } });
      if (author?.role !== Role.ADMIN && course.instructorId !== trainerId) {
        throw new ForbiddenException('Assessments can only be attached to courses you manage');
      }
      if (course.subjectId !== data.subjectId) {
        throw new BadRequestException('Assessment subject must match the selected course');
      }
    }

    for (const question of data.questions) {
      const options = question.options || [];
      if (!question.prompt?.trim() || options.length < 2 || options.filter((option: any) => option.isCorrect).length !== 1) {
        throw new BadRequestException('Each question needs a prompt, at least two options, and exactly one correct answer');
      }
    }

    return this.prisma.questionnaire.create({
      data: {
        title: data.title,
        subjectId: data.subjectId,
        courseId: data.courseId,
        trainerId,
        durationMins: data.durationMins || 30,
        passMark: data.passMark || 60,
        negativeMarking: data.negativeMarking || 0,
        startAt: data.startAt ? new Date(data.startAt) : null,
        deadline: data.deadline ? new Date(data.deadline) : null,
        questions: {
          create: (data.questions || []).map((q: any) => ({
            prompt: q.prompt,
            topicTag: q.topicTag || 'General Meteorology',
            difficulty: q.difficulty || 'MEDIUM',
            points: q.points || 1.0,
            options: {
              create: (q.options || []).map((opt: any, idx: number) => ({
                text: opt.text,
                isCorrect: Boolean(opt.isCorrect),
                order: idx,
              })),
            },
          })),
        },
      },
      include: {
        questions: { include: { options: true } },
      },
    });
  }

  /**
   * Trainee: Start test (verifies window, no prior attempt; returns shuffled questions WITHOUT correct answers)
   */
  async startTest(testId: string, userId: string) {
    let test = await this.prisma.questionnaire.findUnique({
      where: { id: testId },
      include: {
        questions: {
          include: {
            options: {
              select: { id: true, text: true, order: true }, // SECURITY: Exclude isCorrect!
            },
          },
        },
        course: { select: { status: true } },
      },
    });

    if (!test) throw new NotFoundException('Assessment not found');
    if (test.status !== 'PUBLISHED') throw new NotFoundException('Assessment is not available');
    if (test.course && test.course.status !== 'PUBLISHED') throw new NotFoundException('Assessment is not available');

    if (test.courseId) {
      const enrollment = await this.prisma.courseEnrollment.findUnique({
        where: { userId_courseId: { userId, courseId: test.courseId } },
        select: { id: true },
      });
      if (!enrollment) throw new ForbiddenException('Enroll in this course before starting its assessment');
    }

    const now = new Date();
    if (test.startAt && now < test.startAt) {
      throw new BadRequestException('Assessment has not started yet');
    }
    if (test.deadline && now > test.deadline) {
      throw new BadRequestException('Assessment is already closed');
    }

    // Check prior attempt (one attempt rule)
    const existingAttempt = await this.prisma.assessmentAttempt.findFirst({
      where: { questionnaireId: test.id, userId },
      include: { answers: true },
    });

    if (existingAttempt) {
      if (existingAttempt.status !== AssessmentAttemptStatus.IN_PROGRESS) {
        throw new BadRequestException('You have already completed this test');
      }

      // Check if attempt has expired on server
      if (now > existingAttempt.endsAt) {
        await this.prisma.assessmentAttempt.update({
          where: { id: existingAttempt.id },
          data: { status: AssessmentAttemptStatus.TIMED_OUT },
        });
        throw new BadRequestException('Your test session has timed out');
      }

      return {
        attemptId: existingAttempt.id,
        endsAt: existingAttempt.endsAt,
        assessmentId: test.id,
        title: test.title,
        courseId: test.courseId,
        answers: existingAttempt.answers.map((answer) => ({ questionId: answer.questionId, selectedOptionId: answer.selectedOptionId })),
        questions: test.questions,
      };
    }

    // Hard server-side calculated cutoff
    const endsAt = new Date(now.getTime() + test.durationMins * 60 * 1000);

    const attempt = await this.prisma.assessmentAttempt.create({
      data: {
        questionnaireId: test.id,
        userId,
        startedAt: now,
        endsAt,
        status: AssessmentAttemptStatus.IN_PROGRESS,
      },
    });

    // Shuffle questions and options for exam integrity
    const shuffledQuestions = test.questions
      .sort(() => 0.5 - Math.random())
      .map((q) => ({
        ...q,
        options: q.options.sort(() => 0.5 - Math.random()),
      }));

    return {
      attemptId: attempt.id,
      startedAt: attempt.startedAt,
      endsAt: attempt.endsAt,
      durationMins: test.durationMins,
      assessmentId: test.id,
      title: test.title,
      courseId: test.courseId,
      questions: shuffledQuestions,
    };
  }

  async getMyAttempts(userId: string) {
    return this.prisma.assessmentAttempt.findMany({
      where: { userId },
      select: {
        id: true,
        startedAt: true,
        submittedAt: true,
        status: true,
        score: true,
        isPassed: true,
        questionnaire: {
          select: { id: true, title: true, courseId: true, course: { select: { title: true } } },
        },
      },
      orderBy: { startedAt: 'desc' },
    });
  }

  /**
   * Trainee: Autosave answers
   */
  async autosaveAnswers(
    attemptId: string,
    userId: string,
    answers: { questionId: string; selectedOptionId: string }[],
  ) {
    const attempt = await this.prisma.assessmentAttempt.findUnique({
      where: { id: attemptId },
      include: { questionnaire: { select: { questions: { select: { id: true, options: { select: { id: true } } } } } } },
    });

    if (!attempt || attempt.userId !== userId) {
      throw new ForbiddenException('Attempt not found or unauthorized');
    }

    if (attempt.status !== AssessmentAttemptStatus.IN_PROGRESS) {
      throw new BadRequestException('Attempt is no longer in progress');
    }

    if (!Array.isArray(answers) || answers.length > attempt.questionnaire.questions.length) {
      throw new BadRequestException('Answer list is invalid');
    }
    if (new Date() > attempt.endsAt) throw new BadRequestException('Attempt time has expired');

    for (const ans of answers) {
      const question = attempt.questionnaire.questions.find((item) => item.id === ans.questionId);
      if (!question || !question.options.some((option) => option.id === ans.selectedOptionId)) {
        throw new BadRequestException('Answer must refer to an option in this assessment');
      }
      await this.prisma.attemptAnswer.upsert({
        where: {
          attemptId_questionId: { attemptId, questionId: ans.questionId },
        },
        update: { selectedOptionId: ans.selectedOptionId },
        create: {
          attemptId,
          questionId: ans.questionId,
          selectedOptionId: ans.selectedOptionId,
        },
      });
    }

    return { autosaved: true };
  }

  /**
   * Trainee: Server-side grading, negative marking calculation, question stats update
   */
  async submitTest(attemptId: string, userId: string) {
    const attempt = await this.prisma.assessmentAttempt.findUnique({
      where: { id: attemptId },
      include: {
        questionnaire: {
          include: {
            questions: {
              include: { options: true },
            },
          },
        },
        answers: true,
      },
    });

    if (!attempt || attempt.userId !== userId) {
      throw new ForbiddenException('Attempt not found or unauthorized');
    }

    if (attempt.status !== AssessmentAttemptStatus.IN_PROGRESS) {
      throw new BadRequestException('Attempt already evaluated');
    }

    const now = new Date();
    // 30 seconds network grace period
    const isTimedOut = now.getTime() > attempt.endsAt.getTime() + 30 * 1000;

    const answersMap = new Map(attempt.answers.map((a) => [a.questionId, a.selectedOptionId]));
    const negativeMark = attempt.questionnaire.negativeMarking || 0;

    let totalPoints = 0;
    let earnedPoints = 0;

    for (const q of attempt.questionnaire.questions) {
      totalPoints += q.points;
      const selectedOptionId = answersMap.get(q.id);
      const correctOption = q.options.find((o) => o.isCorrect);

      let isCorrect = false;
      let scoreForQ = 0;

      if (selectedOptionId) {
        if (correctOption && selectedOptionId === correctOption.id) {
          isCorrect = true;
          scoreForQ = q.points;
        } else {
          isCorrect = false;
          scoreForQ = -negativeMark;
        }
      }

      earnedPoints += scoreForQ;

      // Update question answer record
      await this.prisma.attemptAnswer.upsert({
        where: { attemptId_questionId: { attemptId, questionId: q.id } },
        update: { isCorrect, scoreAwarded: scoreForQ },
        create: { attemptId, questionId: q.id, isCorrect, scoreAwarded: scoreForQ },
      });

      // Update question statistics for discrimination and difficulty index
      await this.prisma.questionStats.upsert({
        where: { questionId: q.id },
        update: {
          totalAttempts: { increment: 1 },
          ...(isCorrect ? { correctAttempts: { increment: 1 } } : {}),
        },
        create: {
          questionId: q.id,
          totalAttempts: 1,
          correctAttempts: isCorrect ? 1 : 0,
        },
      });
    }

    const percentage = totalPoints > 0 ? Math.max(0, (earnedPoints / totalPoints) * 100) : 0;
    const isPassed = !isTimedOut && percentage >= attempt.questionnaire.passMark;

    const finalized = await this.prisma.assessmentAttempt.update({
      where: { id: attemptId },
      data: {
        status: isTimedOut ? AssessmentAttemptStatus.TIMED_OUT : AssessmentAttemptStatus.SUBMITTED,
        submittedAt: now,
        score: Number(percentage.toFixed(2)),
        isPassed,
      },
    });

    return {
      attemptId: finalized.id,
      score: finalized.score,
      isPassed: finalized.isPassed,
      status: finalized.status,
      passMark: attempt.questionnaire.passMark,
      submittedAt: finalized.submittedAt,
      correctCount: attempt.questionnaire.questions.filter((question) => {
        const answer = answersMap.get(question.id);
        return question.options.some((option) => option.id === answer && option.isCorrect);
      }).length,
      totalQuestions: attempt.questionnaire.questions.length,
      competencyAreas: [...new Set(attempt.questionnaire.questions.map((question) => question.topicTag))],
      review: attempt.questionnaire.questions.map((question) => {
        const selectedOptionId = answersMap.get(question.id) || null;
        const correctOption = question.options.find((option) => option.isCorrect);
        return {
          questionId: question.id,
          prompt: question.prompt,
          topicTag: question.topicTag,
          selectedOptionId,
          correctOptionId: correctOption?.id || null,
          isCorrect: Boolean(correctOption && selectedOptionId === correctOption.id),
          options: question.options.map((option) => ({ id: option.id, text: option.text })),
        };
      }),
      improvementSuggestions: [...new Set(attempt.questionnaire.questions
        .filter((question) => !answersMap.get(question.id)
          || !question.options.some((option) => option.id === answersMap.get(question.id) && option.isCorrect))
        .map((question) => question.topicTag))]
        .map((topic) => `Review the learning material for ${topic}.`),
    };
  }

  /**
   * Trainer analytics: submission rate, average score, weak topics, at-risk learners
   */
  async getTrainerAnalytics(testId: string, requesterId: string, requesterRole: Role) {
    const test = await this.prisma.questionnaire.findUnique({
      where: { id: testId },
      include: {
        questions: { include: { stats: true } },
        attempts: {
          include: {
            user: { select: { id: true, name: true, email: true, employeeId: true } },
          },
        },
      },
    });

    if (!test) throw new NotFoundException('Assessment not found');
    if (requesterRole !== Role.ADMIN && test.trainerId !== requesterId) {
      throw new ForbiddenException('Assessment analytics are limited to its trainer');
    }

    const totalAttempts = test.attempts.length;
    const submitted = test.attempts.filter((a) => a.status === AssessmentAttemptStatus.SUBMITTED);
    const avgScore =
      submitted.length > 0
        ? submitted.reduce((acc, curr) => acc + (curr.score || 0), 0) / submitted.length
        : 0;

    // Identify weak topics
    const topicStats: Record<string, { total: number; correct: number }> = {};
    for (const q of test.questions) {
      if (!topicStats[q.topicTag]) topicStats[q.topicTag] = { total: 0, correct: 0 };
      if (q.stats) {
        topicStats[q.topicTag].total += q.stats.totalAttempts;
        topicStats[q.topicTag].correct += q.stats.correctAttempts;
      }
    }

    const weakTopics = Object.entries(topicStats)
      .map(([topic, stats]) => ({
        topic,
        accuracy: stats.total > 0 ? (stats.correct / stats.total) * 100 : 0,
      }))
      .sort((a, b) => a.accuracy - b.accuracy);

    const atRiskLearners = test.attempts
      .filter((a) => a.status === AssessmentAttemptStatus.TIMED_OUT || (a.score !== null && a.score < test.passMark))
      .map((a) => ({
        user: a.user,
        score: a.score,
        status: a.status,
      }));

    return {
      testTitle: test.title,
      totalAttempts,
      submittedCount: submitted.length,
      averageScore: Number(avgScore.toFixed(2)),
      passRate: totalAttempts > 0 ? Number(((submitted.filter((a) => a.isPassed).length / totalAttempts) * 100).toFixed(1)) : 0,
      weakTopics,
      atRiskLearners,
    };
  }

  /**
   * List questionnaires with optional subject filter
   */
  async findAllQuestionnaires(subjectId?: string) {
    const where: any = {
      status: 'PUBLISHED',
      OR: [{ courseId: null }, { course: { status: 'PUBLISHED' } }],
    };
    if (subjectId) where.subjectId = subjectId;

    return this.prisma.questionnaire.findMany({
      where,
      include: {
        subject: true,
        course: { select: { id: true, title: true } },
        _count: { select: { questions: true, attempts: true } },
      },
      orderBy: { createdAt: 'desc' },
    });
  }
}
