import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';

@Injectable()
export class ProfilesService {
  constructor(private readonly prisma: PrismaService) {}

  async getProfile(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      include: {
        qualifications: true,
        workExperiences: true,
        certificates: true,
        userSkills: {
          include: { skill: true },
        },
      },
    });

    if (!user) throw new NotFoundException('User profile not found');
    return user;
  }

  async addQualification(userId: string, data: { degree: string; field: string; institution: string; year: number }) {
    return this.prisma.qualification.create({
      data: {
        userId,
        degree: data.degree,
        field: data.field,
        institution: data.institution,
        year: data.year,
      },
    });
  }

  async addWorkExperience(userId: string, data: { title: string; organization?: string; startYear: number; endYear?: number; description?: string }) {
    return this.prisma.workExperience.create({
      data: {
        userId,
        title: data.title,
        organization: data.organization || 'India Meteorological Department',
        startYear: data.startYear,
        endYear: data.endYear,
        description: data.description,
      },
    });
  }

  async addCertificate(userId: string, data: { title: string; issuingBody: string; issueYear: number; fileUrl: string }) {
    return this.prisma.userCertificate.create({
      data: {
        userId,
        title: data.title,
        issuingBody: data.issuingBody,
        issueYear: data.issueYear,
        fileUrl: data.fileUrl,
      },
    });
  }

  async getSkillsTaxonomy() {
    return this.prisma.skillTaxonomy.findMany({
      include: { children: true },
      where: { parentId: null },
    });
  }

  async setUserSkill(userId: string, skillId: string, proficiency: number, targetProficiency?: number) {
    if (proficiency < 1 || proficiency > 5) {
      throw new BadRequestException('Proficiency must be between 1 and 5');
    }
    if (targetProficiency !== undefined && (targetProficiency < 1 || targetProficiency > 5)) {
      throw new BadRequestException('Target proficiency must be between 1 and 5');
    }

    return this.prisma.userSkill.upsert({
      where: {
        userId_skillId: { userId, skillId },
      },
      update: { proficiency, ...(targetProficiency === undefined ? {} : { targetProficiency }) },
      create: { userId, skillId, proficiency, targetProficiency },
    });
  }
}
