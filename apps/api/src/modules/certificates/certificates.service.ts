import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ForbiddenException,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { ConfigService } from '@nestjs/config';
import * as QRCode from 'qrcode';
import * as crypto from 'crypto';
import { Role } from '@capacity-connect/shared';

@Injectable()
export class CertificatesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly configService: ConfigService,
  ) {}

  /**
   * Generate QR-verifiable certificate with unique serial number and cryptographic verifyHash
   */
  async generateCertificate(enrollmentId: string, requesterId: string, requesterRole: Role) {
    const enrollment = await this.prisma.courseEnrollment.findUnique({
      where: { id: enrollmentId },
      include: {
        user: true,
        course: true,
        certificate: true,
      },
    });

    if (!enrollment) throw new NotFoundException('Enrollment not found');
    if (requesterRole !== Role.ADMIN && enrollment.userId !== requesterId) {
      throw new ForbiddenException('Certificate access is limited to the enrolled trainee and administrators');
    }
    if (enrollment.progress < 100) {
      throw new BadRequestException('Course syllabus must be 100% completed to be eligible for certification');
    }

    const assessmentsForCourse = await this.prisma.questionnaire.findMany({
      where: {
        courseId: enrollment.courseId,
        status: 'PUBLISHED',
      },
      include: {
        attempts: { where: { userId: enrollment.userId, isPassed: true }, select: { id: true } },
      },
    });
    if (assessmentsForCourse.length === 0) {
      throw new BadRequestException('A published course assessment is required before a certificate can be issued.');
    }
    if (!assessmentsForCourse.some((assessment) => assessment.attempts.length > 0)) {
      throw new BadRequestException('Certificate issuance requires passing a published assessment attached to this course.');
    }

    if (enrollment.certificate) {
      return enrollment.certificate;
    }

    const year = new Date().getFullYear();
    const randomBytes = crypto.randomBytes(4).toString('hex').toUpperCase();
    const serialNumber = `CC-${year}-${randomBytes}`;

    // Cryptographic hash for anti-tamper verification
    const verifyHash = crypto
      .createHash('sha256')
      .update(`${serialNumber}:${enrollment.userId}:${enrollment.courseId}:${Date.now()}`)
      .digest('hex');

    const frontendUrl = this.configService.get<string>('FRONTEND_URL', 'http://localhost:3000');
    const verifyUrl = `${frontendUrl}/verify/${serialNumber}`;

    // Generate QR code DataURL
    const qrCodeUrl = await QRCode.toDataURL(verifyUrl, {
      width: 250,
      margin: 1,
      color: { dark: '#0c2340', light: '#ffffff' },
    });

    return this.prisma.issuedCertificate.create({
      data: {
        serialNumber,
        verifyHash,
        enrollmentId,
        recipientName: enrollment.user.name,
        courseTitle: enrollment.course.title,
        qrCodeUrl,
      },
    });
  }

  /**
   * Public GET /verify/:serial verification endpoint
   */
  async verifyBySerial(serial: string) {
    const cert = await this.prisma.issuedCertificate.findUnique({
      where: { serialNumber: serial },
      include: {
        enrollment: {
          include: {
            user: { select: { id: true, name: true, employeeId: true, department: true } },
            course: { select: { id: true, title: true, subject: true } },
          },
        },
      },
    });

    if (!cert) {
      throw new NotFoundException('Certificate record not found or invalid');
    }

    return {
      isValid: true,
      serialNumber: cert.serialNumber,
      verifyHash: cert.verifyHash,
      recipientName: cert.recipientName,
      courseTitle: cert.courseTitle,
      issueDate: cert.issueDate,
      department: cert.enrollment.user.department,
      organization: this.configService.get<string>('CERTIFICATE_ISSUER', 'Capacity Connect demonstration'),
    };
  }
}
