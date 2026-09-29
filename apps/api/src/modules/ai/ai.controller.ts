import { Body, Controller, Get, Param, Post, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { IsNotEmpty, IsString } from 'class-validator';
import { Role } from '@capacity-connect/shared';
import { CurrentUser, RequestUser } from '../../common/decorators/current-user.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { RolesGuard } from '../../common/guards/roles.guard';
import { AiService } from './ai.service';

export class OfflineQueryDto {
  @IsNotEmpty()
  @IsString()
  courseId: string;

  @IsNotEmpty()
  @IsString()
  query: string;
}

@ApiTags('Course Lesson Search')
@ApiBearerAuth()
@UseGuards(RolesGuard)
@Controller('ai')
export class AiController {
  constructor(private readonly aiService: AiService) {}

  @Post('offline/search')
  @Roles(Role.TRAINEE)
  @ApiOperation({ summary: 'Search saved lesson text for an enrolled trainee using local extractive matching' })
  searchCorpus(@Body() dto: OfflineQueryDto, @CurrentUser() user: RequestUser) {
    return this.aiService.searchApprovedCorpus(dto.courseId, dto.query, user.id);
  }

  @Get('offline/pack/:courseId')
  @Roles(Role.TRAINEE)
  @ApiOperation({ summary: 'Get lesson text for offline reading in an enrolled course' })
  downloadStudyPack(@Param('courseId') courseId: string, @CurrentUser() user: RequestUser) {
    return this.aiService.getOfflineStudyPack(courseId, user.id);
  }

  @Get('offline/remediation')
  @Roles(Role.TRAINEE)
  @ApiOperation({ summary: 'Suggest lessons based on recorded incorrect answers when matching lesson content exists' })
  getRemediation(@CurrentUser() user: RequestUser) {
    return this.aiService.getRemediationRecommendations(user.id);
  }
}
