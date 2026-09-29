import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { CourseStatus, EnrollmentStatus, PaginatedResult, Role } from '@capacity-connect/shared';
import { PaginationDto } from '../../common/dto/pagination.dto';

@Injectable()
export class CoursesService {
  constructor(private readonly prisma: PrismaService) {}

  async findSubjects() {
    return this.prisma.subject.findMany({
      orderBy: { name: 'asc' },
      select: { id: true, name: true, code: true, description: true },
    });
  }

  async findAll(pagination: PaginationDto, status?: CourseStatus): Promise<PaginatedResult<any>> {
    const page = Number(pagination.page) || 1;
    const limit = Number(pagination.limit) || 10;
    const skip = (page - 1) * limit;

    const where: any = {};
    if (status) where.status = status;
    if (pagination.q) {
      where.OR = [
        { title: { contains: pagination.q, mode: 'insensitive' } },
        { description: { contains: pagination.q, mode: 'insensitive' } },
      ];
    }

    const [data, total] = await Promise.all([
      this.prisma.course.findMany({
        where,
        skip,
        take: limit,
        orderBy: { [pagination.sort || 'createdAt']: pagination.order || 'desc' },
        include: {
          subject: true,
          instructor: { select: { id: true, name: true, avatarUrl: true } },
          _count: { select: { enrollments: true, modules: true } },
        },
      }),
      this.prisma.course.count({ where }),
    ]);

    return {
      data,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    };
  }

  async findOne(id: string) {
    const course = await this.prisma.course.findUnique({
      where: { id },
      include: {
        subject: true,
        instructor: { select: { id: true, name: true, avatarUrl: true } },
        modules: {
          orderBy: { order: 'asc' },
          include: {
            lessons: { orderBy: { order: 'asc' } },
          },
        },
        competencies: { include: { competency: true } },
        questionnaires: {
          where: { status: 'PUBLISHED' },
          select: { id: true, title: true, deadline: true, durationMins: true, passMark: true, _count: { select: { questions: true } } },
        },
      },
    });

    if (!course || course.status !== CourseStatus.PUBLISHED) throw new NotFoundException('Course not found');
    return course;
  }

  async createCourse(userId: string, data: {
    title: string;
    description: string;
    subjectId: string;
    level?: string;
    durationMins?: number;
    capacity?: number;
    thumbnailUrl?: string;
    prerequisites?: string[];
    learningObjectives?: string[];
    competencies?: { skillId: string; targetLevel: number }[];
  }) {
    const subject = await this.prisma.subject.findUnique({ where: { id: data.subjectId } });
    if (!subject) throw new BadRequestException('Choose a valid subject');

    return this.prisma.course.create({
      data: {
        title: data.title,
        description: data.description,
        subjectId: data.subjectId,
        level: data.level || 'BEGINNER',
        durationMins: data.durationMins || 0,
        capacity: data.capacity || 100,
        prerequisites: data.prerequisites || [],
        learningObjectives: data.learningObjectives || [],
        thumbnailUrl: data.thumbnailUrl,
        instructorId: userId,
        status: CourseStatus.DRAFT,
        competencies: data.competencies?.length
          ? {
              create: data.competencies.map((mapping) => ({
                targetLevel: mapping.targetLevel,
                competency: { connect: { id: mapping.skillId } },
              })),
            }
          : undefined,
      },
      include: { subject: true, competencies: { include: { competency: true } } },
    });
  }

  async submitForApproval(courseId: string, userId: string) {
    const course = await this.prisma.course.findUnique({ where: { id: courseId } });
    if (!course) throw new NotFoundException('Course not found');
    if (course.instructorId !== userId) throw new ForbiddenException('Not your course');
    if (course.status !== CourseStatus.DRAFT) throw new BadRequestException('Only draft courses can be submitted');

    return this.prisma.course.update({
      where: { id: courseId },
      data: { status: CourseStatus.SUBMITTED },
    });
  }

  async approveCourse(courseId: string) {
    const course = await this.prisma.course.findUnique({ where: { id: courseId } });
    if (!course) throw new NotFoundException('Course not found');
    if (course.status !== CourseStatus.SUBMITTED) {
      throw new BadRequestException('Only submitted courses can be published');
    }
    return this.prisma.course.update({
      where: { id: courseId },
      data: { status: CourseStatus.PUBLISHED },
    });
  }

  async addModule(courseId: string, title: string, order = 0, userId?: string) {
    const course = await this.prisma.course.findUnique({ where: { id: courseId } });
    if (!course) throw new NotFoundException('Course not found');
    if (course.status !== CourseStatus.DRAFT) throw new BadRequestException('Published courses cannot be edited');
    if (userId && course.instructorId !== userId) {
      const user = await this.prisma.user.findUnique({ where: { id: userId } });
      if (user?.role !== Role.ADMIN) {
        throw new ForbiddenException('Unauthorized: You do not own this course');
      }
    }

    return this.prisma.courseModule.create({
      data: { courseId, title, order },
    });
  }

  async addLesson(
    moduleId: string,
    data: { title: string; content?: string; mediaUrl?: string; dripDays?: number; durationMins?: number; order?: number },
    userId?: string,
  ) {
    const moduleItem = await this.prisma.courseModule.findUnique({
      where: { id: moduleId },
      include: { course: true },
    });
    if (!moduleItem) throw new NotFoundException('Module not found');
    if (moduleItem.course.status !== CourseStatus.DRAFT) throw new BadRequestException('Published courses cannot be edited');

    if (userId && moduleItem.course.instructorId !== userId) {
      const user = await this.prisma.user.findUnique({ where: { id: userId } });
      if (user?.role !== Role.ADMIN) {
        throw new ForbiddenException('Unauthorized: You do not own this course module');
      }
    }

    return this.prisma.lesson.create({
      data: {
        moduleId,
        title: data.title,
        content: data.content,
        mediaUrl: data.mediaUrl,
        dripDays: data.dripDays || 0,
        durationMins: data.durationMins || 0,
        order: data.order || 0,
      },
    });
  }

  /**
   * Trainee Enrollment with capacity, published status, and duplicate checks
   */
  async enroll(courseId: string, userId: string) {
    const course = await this.prisma.course.findUnique({
      where: { id: courseId },
      include: { _count: { select: { enrollments: true } } },
    });

    if (!course) throw new NotFoundException('Course not found');
    if (course.status !== CourseStatus.PUBLISHED) {
      throw new BadRequestException('Cannot enroll in an unpublished course');
    }
    if (course._count.enrollments >= course.capacity) {
      throw new BadRequestException('Course capacity has been reached');
    }

    const existing = await this.prisma.courseEnrollment.findUnique({
      where: { userId_courseId: { userId, courseId } },
    });

    if (existing) {
      throw new BadRequestException('Already enrolled in this course');
    }

    return this.prisma.courseEnrollment.create({
      data: {
        userId,
        courseId,
        status: EnrollmentStatus.ENROLLED,
        progress: 0,
        lessonProgress: [],
      },
    });
  }

  /**
   * Mark lesson progress and update completion percentage
   */
  async recordLessonProgress(courseId: string, lessonId: string, userId: string) {
    const enrollment = await this.prisma.courseEnrollment.findUnique({
      where: { userId_courseId: { userId, courseId } },
    });
    if (!enrollment) throw new BadRequestException('Not enrolled in this course');

    const course = await this.prisma.course.findUnique({
      where: { id: courseId },
      include: {
        modules: { orderBy: { order: 'asc' }, include: { lessons: { orderBy: { order: 'asc' } } } },
      },
    });
    if (!course) throw new NotFoundException('Course not found');

    const allLessons = course.modules.flatMap((m) => m.lessons);
    const lessonExists = allLessons.some((l) => l.id === lessonId);
    if (!lessonExists) {
      throw new BadRequestException('Lesson does not belong to this enrolled course');
    }

    const totalLessons = allLessons.length;

    const completedList: string[] = [...((enrollment.lessonProgress as string[]) || [])];
    const orderedLessonIds = course.modules.flatMap((module) => module.lessons.map((lesson) => lesson.id));
    const lessonIndex = orderedLessonIds.indexOf(lessonId);
    if (orderedLessonIds.slice(0, lessonIndex).some((previousLessonId) => !completedList.includes(previousLessonId))) {
      throw new BadRequestException('Complete the preceding lesson before recording this one');
    }
    if (!completedList.includes(lessonId)) {
      completedList.push(lessonId);
    }

    const progressPercentage = totalLessons > 0 ? (completedList.length / totalLessons) * 100 : 100;
    const isCompleted = progressPercentage >= 100;

    return this.prisma.courseEnrollment.update({
      where: { id: enrollment.id },
      data: {
        lessonProgress: completedList,
        progress: Number(progressPercentage.toFixed(1)),
        status: isCompleted ? EnrollmentStatus.COMPLETED : EnrollmentStatus.IN_PROGRESS,
        completedAt: isCompleted ? new Date() : null,
      },
    });
  }

  /**
   * Trainee: Get all personal enrollments with course details, progress, and certificates
   */
  async getUserEnrollments(userId: string) {
    return this.prisma.courseEnrollment.findMany({
      where: { userId },
      include: {
        course: {
          include: {
            subject: true,
            instructor: { select: { id: true, name: true, email: true } },
            modules: {
              orderBy: { order: 'asc' },
              include: { lessons: { orderBy: { order: 'asc' } } },
            },
          },
        },
        certificate: true,
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  /**
   * Trainer: Get all authored courses across draft, submitted, and published
   */
  async getTrainerCourses(trainerId: string) {
    return this.prisma.course.findMany({
      where: { instructorId: trainerId },
      include: {
        subject: true,
        modules: {
          orderBy: { order: 'asc' },
          include: { lessons: { orderBy: { order: 'asc' } } },
        },
        _count: { select: { enrollments: true } },
        competencies: { include: { competency: true } },
        questionnaires: {
          select: {
            id: true,
            title: true,
            deadline: true,
            status: true,
            _count: { select: { attempts: true, questions: true } },
          },
        },
      },
      orderBy: { updatedAt: 'desc' },
    });
  }

  async findSubmittedCourses() {
    return this.prisma.course.findMany({
      where: { status: CourseStatus.SUBMITTED },
      include: {
        subject: true,
        instructor: { select: { id: true, name: true, email: true } },
        competencies: { include: { competency: true } },
        _count: { select: { modules: true, enrollments: true } },
      },
      orderBy: { updatedAt: 'asc' },
    });
  }

  async getTrainerAnalytics(trainerId: string) {
    const courses = await this.prisma.course.findMany({
      where: { instructorId: trainerId },
      select: {
        id: true,
        title: true,
        status: true,
        enrollments: { select: { status: true } },
        questionnaires: {
          select: {
            id: true,
            attempts: { select: { status: true, score: true, isPassed: true } },
          },
        },
      },
    });

    const enrollments = courses.flatMap((course) => course.enrollments);
    const attempts = courses.flatMap((course) => course.questionnaires.flatMap((test) => test.attempts));
    const assessed = attempts.filter((attempt) => attempt.status === 'SUBMITTED' && attempt.score != null);
    const completed = enrollments.filter((enrollment) => enrollment.status === EnrollmentStatus.COMPLETED).length;

    return {
      courseCount: courses.length,
      publishedCourseCount: courses.filter((course) => course.status === CourseStatus.PUBLISHED).length,
      pendingCourseCount: courses.filter((course) => course.status === CourseStatus.SUBMITTED).length,
      enrollmentCount: enrollments.length,
      completionCount: completed,
      completionRate: enrollments.length ? Number(((completed / enrollments.length) * 100).toFixed(1)) : 0,
      assessmentParticipation: attempts.length,
      averageAssessmentScore: assessed.length
        ? Number((assessed.reduce((sum, attempt) => sum + (attempt.score || 0), 0) / assessed.length).toFixed(1))
        : null,
      courses: courses.map((course) => ({
        id: course.id,
        title: course.title,
        status: course.status,
        enrollments: course.enrollments.length,
        completions: course.enrollments.filter((enrollment) => enrollment.status === EnrollmentStatus.COMPLETED).length,
        assessmentAttempts: course.questionnaires.reduce((sum, test) => sum + test.attempts.length, 0),
      })),
    };
  }
}
