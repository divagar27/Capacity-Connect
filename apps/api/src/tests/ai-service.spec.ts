import { AiService } from '../modules/ai/ai.service';
import { PrismaService } from '../prisma/prisma.service';

describe('AiService', () => {
  it('searches the enrolled course lesson text and cites that lesson', async () => {
    const prisma = {
      course: { findFirst: jest.fn().mockResolvedValue({
        id: 'course-1', title: 'Data quality', updatedAt: new Date('2026-01-01'), subject: { name: 'Analysis' },
        modules: [{ title: 'Observations', lessons: [{ id: 'lesson-1', title: 'Units and flags', content: 'Check units and quality flags before comparing observations.' }] }],
      }) },
      aiInteraction: { create: jest.fn().mockResolvedValue({}) },
    } as unknown as PrismaService;
    const service = new AiService(prisma);

    const result = await service.searchApprovedCorpus('course-1', 'quality flags', 'trainee-1');

    expect(result.unsupported).toBe(false);
    expect(result.bestPassages[0].passage.lessonId).toBe('lesson-1');
    expect(result.answerSummary).toContain('quality flags');
    expect((prisma as any).course.findFirst).toHaveBeenCalledWith(expect.objectContaining({
      where: expect.objectContaining({ status: 'PUBLISHED', enrollments: expect.any(Object) }),
    }));
  });

  it('returns no remediation when the user has no submitted attempt', async () => {
    const prisma = { assessmentAttempt: { findFirst: jest.fn().mockResolvedValue(null) } } as unknown as PrismaService;
    const service = new AiService(prisma);

    await expect(service.getRemediationRecommendations('trainee-1')).resolves.toEqual([]);
  });
});
