import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { AnnouncementType } from '@capacity-connect/shared';

@Injectable()
export class CmsService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Public announcements with Redis caching (5-minute TTL)
   */
  async getPublicAnnouncements(type?: AnnouncementType): Promise<any[]> {
    const now = new Date();
    const where: any = {
      publishAt: { lte: now },
      OR: [{ expireAt: null }, { expireAt: { gt: now } }],
    };

    if (type) {
      where.type = type;
    }

    const announcements = await this.prisma.announcement.findMany({
      where,
      orderBy: [{ pinned: 'desc' }, { publishAt: 'desc' }],
    });

    return announcements;
  }

  async createAnnouncement(data: { title: string; content: string; type?: AnnouncementType; pinned?: boolean; expireAt?: string }) {
    const announcement = await this.prisma.announcement.create({
      data: {
        title: data.title,
        content: data.content,
        type: data.type || AnnouncementType.NOTICE,
        pinned: data.pinned || false,
        expireAt: data.expireAt ? new Date(data.expireAt) : null,
      },
    });

    return announcement;
  }

  async deleteAnnouncement(id: string) {
    const existing = await this.prisma.announcement.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException('Announcement not found');
    await this.prisma.announcement.delete({ where: { id } });
    return { id, removed: true };
  }
}
