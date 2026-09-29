import { Controller, Get, Patch, Body } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { CurrentUser, RequestUser } from '../../common/decorators/current-user.decorator';
import { AllowPending } from '../../common/decorators/allow-pending.decorator';
import { PrismaService } from '../../prisma/prisma.service';

@ApiTags('Current Session')
@ApiBearerAuth()
@Controller()
export class MeController {
  constructor(private readonly prisma: PrismaService) {}

  @AllowPending()
  @Get('me')
  @ApiOperation({ summary: 'Get current user identity, role, and approval status' })
  async getMe(@CurrentUser() user: RequestUser) {
    const fullUser = await this.prisma.user.findUnique({
      where: { id: user.id },
    });
    return { user: fullUser || user };
  }

  @AllowPending()
  @Patch('me/profile')
  @ApiOperation({ summary: 'Update personal officer profile details (ID number is system protected)' })
  async updateProfile(
    @CurrentUser() user: RequestUser,
    @Body()
    body: {
      name?: string;
      phone?: string;
      bloodGroup?: string;
      stationLocation?: string;
    },
  ) {
    // Account users may update personal contact details; organizational fields remain admin-managed.
    const updated = await this.prisma.user.update({
      where: { id: user.id },
      data: {
        ...(body.name ? { name: body.name } : {}),
        ...(body.phone ? { phone: body.phone } : {}),
      },
    });
    return { success: true, user: updated };
  }
}
