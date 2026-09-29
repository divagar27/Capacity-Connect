import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { CompetencyService } from './competency.service';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles, Public } from '../../common/decorators/roles.decorator';
import { Role } from '@capacity-connect/shared';
import { CurrentUser, RequestUser } from '../../common/decorators/current-user.decorator';

@ApiTags('Competency & Trainer Recommendation')
@ApiBearerAuth()
@UseGuards(RolesGuard)
@Controller()
export class CompetencyController {
  constructor(private readonly competencyService: CompetencyService) {}

  @Get('competency/trainers')
  @Public()
  @ApiOperation({ summary: 'Rank trainers by subject using explainable weighted formula (30% skills, 25% credentials, 20% experience, 15% delivery, 10% feedback)' })
  async getRankedTrainers(@Query('subject') subject: string) {
    return this.competencyService.rankTrainersBySubject(subject || 'Meteorology');
  }

  @Get('competency/learning-path')
  @Roles(Role.TRAINEE)
  @ApiOperation({ summary: 'Trainee: return deterministic competency gaps and course pathways' })
  async getLearningPath(@CurrentUser() user: RequestUser) {
    return this.competencyService.getLearningPath(user.id);
  }

  @Get('admin/skill-heatmap')
  @Roles(Role.ADMIN)
  @ApiOperation({ summary: 'Admin: Skill heatmap of department x skill proficiency averages' })
  async getHeatmap() {
    return this.competencyService.getSkillHeatmap();
  }
}
