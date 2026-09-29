import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { Role, UserStatus, PaginatedResult } from '@capacity-connect/shared';
import { PaginationDto } from '../../common/dto/pagination.dto';

@Injectable()
export class UsersService {
  constructor(private readonly prisma: PrismaService) {}

  async findAllAdmin(
    pagination: PaginationDto,
    status?: UserStatus,
    role?: Role,
  ): Promise<PaginatedResult<any>> {
    const page = Number(pagination.page) || 1;
    const limit = Number(pagination.limit) || 10;
    const skip = (page - 1) * limit;

    const where: any = {};
    if (status) where.status = status;
    if (role) where.role = role;
    if (pagination.q) {
      where.OR = [
        { name: { contains: pagination.q, mode: 'insensitive' } },
        { email: { contains: pagination.q, mode: 'insensitive' } },
        { employeeId: { contains: pagination.q, mode: 'insensitive' } },
        { department: { contains: pagination.q, mode: 'insensitive' } },
      ];
    }

    const [data, total] = await Promise.all([
      this.prisma.user.findMany({
        where,
        skip,
        take: limit,
        orderBy: {
          [pagination.sort || 'createdAt']: pagination.order || 'desc',
        },
      }),
      this.prisma.user.count({ where }),
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
    const user = await this.prisma.user.findUnique({
      where: { id },
      include: {
        qualifications: true,
        workExperiences: true,
        certificates: true,
        userSkills: {
          include: { skill: true },
        },
      },
    });

    if (!user) {
      throw new NotFoundException('User not found');
    }
    return user;
  }

  async updateUserStatusAndRole(
    userId: string,
    status: UserStatus,
    role?: Role,
    department?: string,
  ) {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) {
      throw new NotFoundException('User not found');
    }

    return this.prisma.user.update({
      where: { id: userId },
      data: {
        status,
        ...(role !== undefined ? { role } : {}),
        ...(department ? { department } : {}),
      },
    });
  }
}
