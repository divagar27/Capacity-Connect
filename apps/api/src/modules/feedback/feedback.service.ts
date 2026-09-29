import {
  Injectable,
  BadRequestException,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { EnrollmentStatus } from '@capacity-connect/shared';

@Injectable()
export class FeedbackService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Submit course and trainer feedback (only allowed if enrolled)
   */
  async submitFeedback(
    userId: string,
    courseId: string,
    rating: number,
    comments?: string,
  ) {
    if (rating < 1 || rating > 5) {
      throw new BadRequestException('Rating must be between 1 and 5');
    }

    // Verify enrollment
    const enrollment = await this.prisma.courseEnrollment.findUnique({
      where: { userId_courseId: { userId, courseId } },
      include: { course: true },
    });

    if (!enrollment) {
      throw new BadRequestException('You must be enrolled in the course to provide feedback');
    }

    const trainerId = enrollment.course.instructorId;

    return this.prisma.feedback.upsert({
      where: { userId_courseId: { userId, courseId } },
      update: {
        rating,
        comments,
        trainerId,
      },
      create: {
        userId,
        courseId,
        trainerId,
        rating,
        comments,
      },
    });
  }

  /**
   * Compute average feedback rating for a trainer
   */
  async getTrainerAverageRating(trainerId: string): Promise<number> {
    const aggregate = await this.prisma.feedback.aggregate({
      where: { trainerId },
      _avg: { rating: true },
    });

    return aggregate._avg.rating ? Number(aggregate._avg.rating.toFixed(2)) : 5.0;
  }
}
