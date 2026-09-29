import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { MediaService } from '../media/media.service';
import { MediaVisibility, MediaStatus, ResourceType, Role } from '@capacity-connect/shared';

@Injectable()
export class LibraryService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly mediaService: MediaService,
  ) {}

  /**
   * Step 1: Return direct signed MinIO upload URL
   */
  async getUploadUrl(
    filename: string,
    mimeType: string,
    fileSize: number,
  ) {
    const allowedMime = [
      'video/mp4',
      'application/pdf',
      'application/vnd.ms-powerpoint',
      'application/vnd.openxmlformats-officedocument.presentationml.presentation',
      'image/jpeg',
      'image/png',
    ];

    if (!allowedMime.includes(mimeType)) {
      throw new BadRequestException('Unsupported media file type');
    }

    if (fileSize > 50 * 1024 * 1024) {
      throw new BadRequestException('File exceeds 50MB maximum limit');
    }

    const sanitized = filename.replace(/[^a-zA-Z0-9.-]/g, '_');
    const fileKey = `library/${Date.now()}-${sanitized}`;

    // Return object key and target upload location
    return {
      fileKey,
      uploadUrl: `/api/v1/media/upload`,
    };
  }

  /**
   * Step 2: Confirm uploaded item and set status to READY
   */
  async confirmUpload(
    trainerId: string,
    trainerRole: Role,
    data: {
      title: string;
      description?: string;
      subjectId?: string;
      courseId?: string;
      resourceType?: ResourceType;
      tags?: string[];
      fileKey: string;
      fileSize?: number;
      mimeType?: string;
      visibility?: MediaVisibility;
    },
  ) {
    let subjectId = data.subjectId;
    if (data.courseId) {
      const course = await this.prisma.course.findUnique({ where: { id: data.courseId }, select: { id: true, subjectId: true, instructorId: true } });
      if (!course) throw new BadRequestException('Choose a valid course');
      if (trainerRole !== Role.ADMIN && course.instructorId !== trainerId) {
        throw new ForbiddenException('Resources can only be attached to courses you manage');
      }
      if (subjectId && subjectId !== course.subjectId) throw new BadRequestException('Resource subject must match the selected course');
      subjectId = course.subjectId;
    } else if (subjectId) {
      const subject = await this.prisma.subject.findUnique({ where: { id: subjectId }, select: { id: true } });
      if (!subject) throw new BadRequestException('Choose a valid subject');
    }

    return this.prisma.libraryItem.create({
      data: {
        trainerId,
        title: data.title,
        description: data.description,
        subjectId,
        courseId: data.courseId,
        resourceType: data.resourceType || ResourceType.STUDY_MATERIAL,
        tags: data.tags || [],
        fileKey: data.fileKey,
        fileSize: data.fileSize,
        mimeType: data.mimeType,
        visibility: data.visibility || MediaVisibility.PUBLIC,
        status: MediaStatus.READY,
      },
    });
  }

  /**
   * Search library items by title, tags, or subject with visibility gate
   */
  async searchLibrary(
    q?: string,
    subjectId?: string,
    courseId?: string,
    userId?: string,
    userRole?: Role,
  ) {
    const filters: any[] = [];

    if (q) {
      filters.push({ OR: [
        { title: { contains: q, mode: 'insensitive' } },
        { description: { contains: q, mode: 'insensitive' } },
        { tags: { has: q } },
      ] });
    }

    if (subjectId) {
      filters.push({ subjectId });
    }
    if (courseId) {
      filters.push({ courseId });
    }

    // Visibility rules are combined with (rather than substituted for) search filters.
    if (userRole !== Role.ADMIN) {
      const enrollments = userId
        ? await this.prisma.courseEnrollment.findMany({
            where: { userId, status: { in: ['ENROLLED', 'IN_PROGRESS', 'COMPLETED'] } },
            select: { course: { select: { subjectId: true } } },
          })
        : [];
      const enrolledSubjectIds = [...new Set(enrollments.map((enrollment) => enrollment.course.subjectId))];
      filters.push({ OR: [
        { visibility: MediaVisibility.PUBLIC },
        ...(userId ? [{ trainerId: userId }] : []),
        ...(enrolledSubjectIds.length ? [{ visibility: MediaVisibility.ENROLLED, subjectId: { in: enrolledSubjectIds } }] : []),
      ] });
    }

    return this.prisma.libraryItem.findMany({
      where: filters.length ? { AND: filters } : {},
      include: {
        subject: { select: { id: true, name: true } },
        course: { select: { id: true, title: true } },
        trainer: { select: { id: true, name: true, avatarUrl: true } },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  /**
   * Secure signed URL retrieval with visibility gate
   */
  async getItemStreamUrl(itemId: string, userId?: string, userRole?: Role) {
    const item = await this.prisma.libraryItem.findUnique({
      where: { id: itemId },
    });

    if (!item) throw new NotFoundException('Library resource not found');
    if (item.status !== MediaStatus.READY) throw new NotFoundException('Library resource is not ready');

    if (item.visibility === MediaVisibility.PRIVATE) {
      if (item.trainerId !== userId && userRole !== Role.ADMIN) {
        throw new ForbiddenException('Private trainer item');
      }
    }

    if (item.visibility === MediaVisibility.ENROLLED && userRole !== Role.ADMIN && item.trainerId !== userId) {
      const enrollment = userId && item.subjectId
        ? await this.prisma.courseEnrollment.findFirst({
            where: {
              userId,
              status: { in: ['ENROLLED', 'IN_PROGRESS', 'COMPLETED'] },
              OR: [
                ...(item.courseId ? [{ courseId: item.courseId }] : []),
                { course: { subjectId: item.subjectId } },
              ],
            },
            select: { id: true },
          })
        : null;
      if (!enrollment) throw new ForbiddenException('Enrollment required to access this resource');
    }

    // Signed presigned MinIO URL valid for 2 hours
    const signedUrl = await this.mediaService.getPresignedUrl(item.fileKey, 7200);
    return {
      title: item.title,
      mimeType: item.mimeType,
      url: signedUrl,
    };
  }
}
