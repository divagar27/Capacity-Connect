import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { OfflineSearchResponse, OfflineStudyPack, SearchPassage, TopicRemediationItem } from '@capacity-connect/shared';

const STOPWORDS = new Set(['the', 'is', 'at', 'which', 'on', 'a', 'an', 'and', 'or', 'of', 'for', 'in', 'to', 'from', 'with', 'how', 'do', 'i', 'you', 'what', 'where', 'when', 'why', 'can', 'does', 'did', 'be', 'are', 'have', 'has', 'had', 'by', 'this', 'that', 'these', 'those']);
const tokens = (text: string) => (text.toLowerCase().match(/[a-z0-9]+/g) || []).filter((word) => word.length > 1 && !STOPWORDS.has(word));

@Injectable()
export class AiService {
  constructor(private readonly prisma: PrismaService) {}

  private async getEnrolledCourse(courseId: string, userId: string) {
    const course = await this.prisma.course.findFirst({
      where: { id: courseId, status: 'PUBLISHED', enrollments: { some: { userId, status: { in: ['ENROLLED', 'IN_PROGRESS', 'COMPLETED'] } } } },
      include: { subject: true, modules: { orderBy: { order: 'asc' }, include: { lessons: { orderBy: { order: 'asc' } } } } },
    });
    if (!course) throw new NotFoundException('Published course or active enrollment not found');
    return course;
  }

  private toPassages(course: Awaited<ReturnType<AiService['getEnrolledCourse']>>): SearchPassage[] {
    return course.modules.flatMap((module) => module.lessons
      .filter((lesson) => Boolean(lesson.content?.trim()))
      .map((lesson) => ({
        id: lesson.id,
        documentId: `course-${course.id}`,
        documentTitle: course.title,
        sectionTitle: `${module.title}: ${lesson.title}`,
        courseId: course.id,
        lessonId: lesson.id,
        sourceType: 'CURRICULUM_LESSON' as const,
        content: lesson.content as string,
        keywords: [],
        reference: `${course.subject.name} · ${module.title} · ${lesson.title}`,
      })));
  }

  async searchApprovedCorpus(courseId: string, rawQuery: string, userId: string): Promise<OfflineSearchResponse> {
    const query = (rawQuery || '').trim();
    const course = await this.getEnrolledCourse(courseId, userId);
    const queryTokens = [...new Set(tokens(query))];
    const passages = this.toPassages(course);
    const scored = passages.map((passage) => {
      const words = tokens(`${passage.sectionTitle} ${passage.content}`);
      const counts = new Map<string, number>();
      for (const word of words) counts.set(word, (counts.get(word) || 0) + 1);
      const matched = queryTokens.filter((word) => counts.has(word));
      const score = matched.reduce((sum, word) => sum + 2 + Math.log1p(counts.get(word) || 0), 0) / Math.sqrt(Math.max(1, words.length / 40));
      return { passage, score: Number(score.toFixed(2)), matchDetails: matched };
    }).filter((item) => item.score >= 1 && item.matchDetails.length).sort((left, right) => right.score - left.score);

    try {
      await this.prisma.aiInteraction.create({ data: { userId, courseId, action: 'OFFLINE_CORPUS_SEARCH', prompt: query, response: scored[0]?.passage.content || 'UNSUPPORTED', citations: scored.slice(0, 3).map(({ passage }) => ({ lessonId: passage.lessonId, section: passage.sectionTitle })) as any } });
    } catch { /* Search should still work when optional interaction logging is unavailable. */ }

    return {
      query,
      expandedQueryTokens: queryTokens,
      totalMatches: scored.length,
      answerSummary: scored.length ? scored[0].passage.content : 'No matching text was found in this course’s saved lesson content.',
      bestPassages: scored.slice(0, 3),
      unsupported: scored.length === 0,
      searchMethod: 'BM25_EXTRACTIVE_LOCAL',
    };
  }

  async getOfflineStudyPack(courseId: string, userId: string): Promise<OfflineStudyPack> {
    const course = await this.getEnrolledCourse(courseId, userId);
    const passages = this.toPassages(course);
    const pack = { courseId, courseTitle: course.title, passages, glossary: {}, practiceQuestions: [] };
    return {
      packId: `course-${course.id}-lessons`,
      courseId: course.id,
      courseTitle: course.title,
      version: course.updatedAt.toISOString(),
      issuedAt: new Date().toISOString(),
      estimatedSizeKb: Math.ceil(JSON.stringify(pack).length / 1024),
      glossary: {},
      passages,
      practiceQuestions: [],
    };
  }

  async getRemediationRecommendations(userId: string): Promise<TopicRemediationItem[]> {
    const attempt = await this.prisma.assessmentAttempt.findFirst({
      where: { userId, status: { in: ['SUBMITTED', 'TIMED_OUT'] } },
      include: { answers: { include: { question: true } }, questionnaire: { select: { courseId: true } } },
      orderBy: { createdAt: 'desc' },
    });
    if (!attempt?.questionnaire.courseId) return [];
    const incorrect = attempt.answers.filter((answer) => answer.isCorrect === false);
    if (!incorrect.length) return [];

    const course = await this.getEnrolledCourse(attempt.questionnaire.courseId, userId);
    const lessons = course.modules.flatMap((module) => module.lessons.map((lesson) => ({ ...lesson, moduleTitle: module.title })));
    const grouped = new Map<string, typeof incorrect>();
    for (const answer of incorrect) {
      const topic = answer.question.topicTag || 'Untitled topic';
      grouped.set(topic, [...(grouped.get(topic) || []), answer]);
    }

    return [...grouped.entries()].flatMap(([topicTag, answers]) => {
      const topicTerms = tokens(`${topicTag} ${answers.map((answer) => answer.question.prompt).join(' ')}`);
      const matched = lessons.map((lesson) => {
        const lessonTerms = new Set(tokens(`${lesson.title} ${lesson.content || ''}`));
        return { lesson, overlap: topicTerms.filter((term) => lessonTerms.has(term)).length };
      }).sort((left, right) => right.overlap - left.overlap)[0];
      if (!matched || matched.overlap === 0 || !matched.lesson.content) return [];
      return [{
        topicTag,
        missedCount: answers.length,
        totalTested: attempt.answers.filter((answer) => answer.question.topicTag === topicTag).length,
        recommendedLessonTitle: matched.lesson.title,
        recommendedLessonId: matched.lesson.id,
        courseId: course.id,
        remediationAdvice: `Review the lesson text for “${matched.lesson.title}” after the recorded incorrect response(s) on this topic.`,
        referencePassage: matched.lesson.content,
      }];
    });
  }
}
