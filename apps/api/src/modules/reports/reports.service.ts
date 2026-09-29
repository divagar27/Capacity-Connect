import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';

@Injectable()
export class ReportsService {
  constructor(
    private readonly prisma: PrismaService,
  ) {}

  /** Aggregate current dashboard counts and profile-level skill data. */
  async getAdminStats() {
    const [
      totalUsers,
      pendingApprovals,
      totalCourses,
      totalEnrollments,
      completedEnrollments,
      totalCertificates,
      totalAssessments,
      activeTrainees,
      activeTrainers,
      assessmentAttempts,
      enrollmentRows,
      competencyRows,
    ] = await Promise.all([
      this.prisma.user.count(),
      this.prisma.user.count({ where: { status: 'PENDING' } }),
      this.prisma.course.count({ where: { status: 'PUBLISHED' } }),
      this.prisma.courseEnrollment.count(),
      this.prisma.courseEnrollment.count({ where: { status: 'COMPLETED' } }),
      this.prisma.issuedCertificate.count(),
      this.prisma.questionnaire.count(),
      this.prisma.user.count({ where: { role: 'TRAINEE', status: 'ACTIVE' } }),
      this.prisma.user.count({ where: { role: 'TRAINER', status: 'ACTIVE' } }),
      this.prisma.assessmentAttempt.count({ where: { status: { in: ['SUBMITTED', 'TIMED_OUT'] } } }),
      this.prisma.courseEnrollment.findMany({ select: { createdAt: true } }),
      this.prisma.userSkill.groupBy({
        by: ['skillId'],
        _avg: { proficiency: true },
        _count: { userId: true },
      }),
    ]);

    const competencyIds = competencyRows.map((row) => row.skillId);
    const competencies = competencyIds.length
      ? await this.prisma.skillTaxonomy.findMany({ where: { id: { in: competencyIds } }, select: { id: true, name: true, category: true } })
      : [];
    const competencyById = new Map(competencies.map((competency) => [competency.id, competency]));
    const now = new Date();
    const enrollmentTrend = Array.from({ length: 6 }, (_, offset) => {
      const monthDate = new Date(now.getFullYear(), now.getMonth() - (5 - offset), 1);
      const year = monthDate.getFullYear();
      const month = monthDate.getMonth();
      return {
        month: monthDate.toLocaleString('en', { month: 'short' }),
        count: enrollmentRows.filter((row) => row.createdAt.getFullYear() === year && row.createdAt.getMonth() === month).length,
      };
    });

    const stats = {
      totalUsers,
      pendingApprovals,
      totalCourses,
      totalEnrollments,
      completedEnrollments,
      totalCertificates,
      totalAssessments,
      activeTrainees,
      activeTrainers,
      assessmentAttempts,
      enrollmentTrend,
      competencyDistribution: competencyRows.map((row) => ({
        ...(competencyById.get(row.skillId) || { name: 'Uncategorised', category: 'Other' }),
        traineeCount: row._count.userId,
        averageProficiency: Number((row._avg.proficiency || 0).toFixed(1)),
      })),
      completionRate:
        totalEnrollments > 0
          ? Number(((completedEnrollments / totalEnrollments) * 100).toFixed(1))
          : 0,
      timestamp: new Date().toISOString(),
    };

    return stats;
  }

  async exportEnrollmentsCsv(): Promise<string> {
    const enrollments = await this.prisma.courseEnrollment.findMany({
      include: {
        user: { select: { name: true, email: true, employeeId: true, department: true } },
        course: { select: { title: true, level: true } },
        certificate: { select: { serialNumber: true } },
      },
      orderBy: { createdAt: 'desc' },
    });

    const headers = [
      'Enrollment ID',
      'Employee ID',
      'Learner Name',
      'Department',
      'Course Title',
      'Status',
      'Progress (%)',
      'Certificate Serial',
    ];

    const rows = enrollments.map((e) => [
      e.id,
      e.user.employeeId || 'N/A',
      `"${e.user.name}"`,
      `"${e.user.department || 'IMD'}"`,
      `"${e.course.title.replace(/"/g, '""')}"`,
      e.status,
      e.progress,
      e.certificate?.serialNumber || 'N/A',
    ]);

    return [headers.join(','), ...rows.map((r) => r.join(','))].join('\n');
  }
}
