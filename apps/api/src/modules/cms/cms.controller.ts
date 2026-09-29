import { Controller, Get, Post, Delete, Body, Param, Query, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { CmsService } from './cms.service';
import { Public, Roles } from '../../common/decorators/roles.decorator';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Role, AnnouncementType } from '@capacity-connect/shared';
import { IsBoolean, IsEnum, IsNotEmpty, IsOptional, IsString } from 'class-validator';

export class CreateAnnouncementDto {
  @IsNotEmpty()
  @IsString()
  title: string;

  @IsNotEmpty()
  @IsString()
  content: string;

  @IsOptional()
  @IsEnum(AnnouncementType)
  type?: AnnouncementType;

  @IsOptional()
  @IsBoolean()
  pinned?: boolean;

  @IsOptional()
  @IsString()
  expireAt?: string;
}

@ApiTags('Homepage CMS')
@Controller()
export class CmsController {
  constructor(private readonly cmsService: CmsService) {}

  @Public()
  @Get('public/announcements')
  @ApiOperation({ summary: 'Public: Cached list of published notices, achievements, and new content' })
  async getPublicAnnouncements(@Query('type') type?: AnnouncementType) {
    return this.cmsService.getPublicAnnouncements(type);
  }

  @ApiBearerAuth()
  @UseGuards(RolesGuard)
  @Roles(Role.ADMIN)
  @Post('cms/announcements')
  @ApiOperation({ summary: 'Admin: Create announcement and invalidate cache' })
  async createAnnouncement(@Body() dto: CreateAnnouncementDto) {
    return this.cmsService.createAnnouncement(dto);
  }

  @ApiBearerAuth()
  @UseGuards(RolesGuard)
  @Roles(Role.ADMIN)
  @Delete('cms/announcements/:id')
  @ApiOperation({ summary: 'Admin: remove an announcement from publication' })
  async deleteAnnouncement(@Param('id') id: string) {
    return this.cmsService.deleteAnnouncement(id);
  }
}
