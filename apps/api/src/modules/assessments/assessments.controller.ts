import {
  Controller,
  Get,
  Post,
  Put,
  Param,
  Body,
  UseGuards,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { AssessmentsService } from './assessments.service';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles, Public } from '../../common/decorators/roles.decorator';
import { CurrentUser, RequestUser } from '../../common/decorators/current-user.decorator';
import { Role } from '@capacity-connect/shared';
import { Query } from '@nestjs/common';
import { Type } from 'class-transformer';
import { ArrayMaxSize, IsArray, IsNotEmpty, IsString, ValidateNested } from 'class-validator';

class AssessmentAnswerDto {
  @IsNotEmpty()
  @IsString()
  questionId: string;

  @IsNotEmpty()
  @IsString()
  selectedOptionId: string;
}

class AutosaveAnswersDto {
  @IsArray()
  @ArrayMaxSize(100)
  @ValidateNested({ each: true })
  @Type(() => AssessmentAnswerDto)
  answers: AssessmentAnswerDto[];
}

@ApiTags('Assessments & Timed Tests')
@ApiBearerAuth()
@UseGuards(RolesGuard)
@Controller('tests')
export class AssessmentsController {
  constructor(private readonly assessmentsService: AssessmentsService) {}

  @Public()
  @Get()
  @ApiOperation({ summary: 'Public: List published assessments with question and attempt counts' })
  async listAll(@Query('subjectId') subjectId?: string) {
    return this.assessmentsService.findAllQuestionnaires(subjectId);
  }

  @Post()
  @Roles(Role.TRAINER, Role.ADMIN)
  @ApiOperation({ summary: 'Trainer: Create timed MCQ assessment with negative marking' })
  async create(
    @CurrentUser() user: RequestUser,
    @Body() body: any,
  ) {
    return this.assessmentsService.createQuestionnaire(user.id, body);
  }

  @Post(':id/start')
  @Roles(Role.TRAINEE)
  @ApiOperation({ summary: 'Trainee: Start test attempt (verifies window, returns shuffled questions without answers)' })
  async startTest(
    @Param('id') id: string,
    @CurrentUser() user: RequestUser,
  ) {
    return this.assessmentsService.startTest(id, user.id);
  }

  @Put('attempts/:id/answers')
  @Roles(Role.TRAINEE)
  @ApiOperation({ summary: 'Trainee: Autosave current answers' })
  async autosave(
    @Param('id') attemptId: string,
    @CurrentUser() user: RequestUser,
    @Body() body: AutosaveAnswersDto,
  ) {
    return this.assessmentsService.autosaveAnswers(attemptId, user.id, body.answers);
  }

  @Post('attempts/:id/submit')
  @Roles(Role.TRAINEE)
  @ApiOperation({ summary: 'Trainee: Submit test for server-side evaluation & negative marking' })
  async submit(
    @Param('id') attemptId: string,
    @CurrentUser() user: RequestUser,
  ) {
    return this.assessmentsService.submitTest(attemptId, user.id);
  }

  @Get('my-attempts')
  @Roles(Role.TRAINEE)
  @ApiOperation({ summary: 'Trainee: list personal assessment outcomes' })
  async getMyAttempts(@CurrentUser() user: RequestUser) {
    return this.assessmentsService.getMyAttempts(user.id);
  }

  @Get(':id/analytics')
  @Roles(Role.TRAINER, Role.ADMIN)
  @ApiOperation({ summary: 'Trainer/Admin: View weak topics, at-risk learners, and question discrimination metrics' })
  async getAnalytics(@Param('id') id: string, @CurrentUser() user: RequestUser) {
    return this.assessmentsService.getTrainerAnalytics(id, user.id, user.role as Role);
  }
}
