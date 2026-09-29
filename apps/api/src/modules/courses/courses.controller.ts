import {
  Controller,
  Get,
  Post,
  Patch,
  Body,
  Param,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { CoursesService } from './courses.service';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles, Public } from '../../common/decorators/roles.decorator';
import { CurrentUser, RequestUser } from '../../common/decorators/current-user.decorator';
import { Role, CourseStatus } from '@capacity-connect/shared';
import { PaginationDto } from '../../common/dto/pagination.dto';
import { IsArray, IsInt, IsNotEmpty, IsOptional, IsString, Max, Min } from 'class-validator';

class CourseCompetencyDto {
  @IsNotEmpty()
  @IsString()
  skillId: string;

  @IsInt()
  @Min(1)
  @Max(5)
  targetLevel: number;
}

export class CreateCourseDto {
  @IsNotEmpty()
  @IsString()
  title: string;

  @IsNotEmpty()
  @IsString()
  description: string;

  @IsNotEmpty()
  @IsString()
  subjectId: string;

  @IsOptional()
  @IsString()
  level?: string;

  @IsOptional()
  @IsInt()
  @Min(0)
  durationMins?: number;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  prerequisites?: string[];

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  learningObjectives?: string[];

  @IsOptional()
  @IsArray()
  competencies?: CourseCompetencyDto[];

  @IsOptional()
  @IsInt()
  @Min(1)
  capacity?: number;

  @IsOptional()
  @IsString()
  thumbnailUrl?: string;
}

export class AddLessonDto {
  @IsNotEmpty()
  @IsString()
  title: string;

  @IsOptional()
  @IsString()
  content?: string;

  @IsOptional()
  @IsString()
  mediaUrl?: string;

  @IsOptional()
  @IsInt()
  dripDays?: number;

  @IsOptional()
  @IsInt()
  durationMins?: number;

  @IsOptional()
  @IsInt()
  order?: number;
}

@ApiTags('Courses & Enrollments')
@ApiBearerAuth()
@UseGuards(RolesGuard)
@Controller('courses')
export class CoursesController {
  constructor(private readonly coursesService: CoursesService) {}

  @Public()
  @Get('subjects')
  @ApiOperation({ summary: 'Public: Subject catalogue available for course authoring and discovery' })
  async getSubjects() {
    return this.coursesService.findSubjects();
  }

  @Get('admin/submissions')
  @Roles(Role.ADMIN)
  @ApiOperation({ summary: 'Admin: List courses awaiting publication approval' })
  async getSubmissions() {
    return this.coursesService.findSubmittedCourses();
  }

  @Public()
  @Get()
  @ApiOperation({ summary: 'Public: Catalogue of published courses' })
  async getCatalogue(@Query() pagination: PaginationDto) {
    return this.coursesService.findAll(pagination, CourseStatus.PUBLISHED);
  }

  @Public()
  @Get(':id')
  @ApiOperation({ summary: 'Get course details with modules and lessons' })
  async getCourse(@Param('id') id: string) {
    return this.coursesService.findOne(id);
  }

  @Post()
  @Roles(Role.TRAINER, Role.ADMIN)
  @ApiOperation({ summary: 'Trainer: Create a draft course' })
  async createCourse(
    @CurrentUser() user: RequestUser,
    @Body() dto: CreateCourseDto,
  ) {
    return this.coursesService.createCourse(user.id, dto);
  }

  @Patch(':id/submit')
  @Roles(Role.TRAINER)
  @ApiOperation({ summary: 'Trainer: Submit draft course for admin approval' })
  async submitCourse(
    @Param('id') id: string,
    @CurrentUser() user: RequestUser,
  ) {
    return this.coursesService.submitForApproval(id, user.id);
  }

  @Patch(':id/approve')
  @Roles(Role.ADMIN)
  @ApiOperation({ summary: 'Admin: Approve and publish submitted course' })
  async approveCourse(@Param('id') id: string) {
    return this.coursesService.approveCourse(id);
  }

  @Post(':id/modules')
  @Roles(Role.TRAINER, Role.ADMIN)
  @ApiOperation({ summary: 'Trainer: Add module to course' })
  async addModule(
    @Param('id') id: string,
    @CurrentUser() user: RequestUser,
    @Body() body: { title: string; order?: number },
  ) {
    return this.coursesService.addModule(id, body.title, body.order, user.id);
  }

  @Post('modules/:moduleId/lessons')
  @Roles(Role.TRAINER, Role.ADMIN)
  @ApiOperation({ summary: 'Trainer: Add lesson with drip release and duration' })
  async addLesson(
    @Param('moduleId') moduleId: string,
    @CurrentUser() user: RequestUser,
    @Body() dto: AddLessonDto,
  ) {
    return this.coursesService.addLesson(moduleId, dto, user.id);
  }

  @Post(':id/enroll')
  @Roles(Role.TRAINEE)
  @ApiOperation({ summary: 'Trainee: Enroll in published course (checks duplicates, capacity, status)' })
  async enroll(
    @Param('id') id: string,
    @CurrentUser() user: RequestUser,
  ) {
    return this.coursesService.enroll(id, user.id);
  }

  @Post(':id/lessons/:lessonId/progress')
  @Roles(Role.TRAINEE)
  @ApiOperation({ summary: 'Trainee: Record lesson completion progress and compute completion percentage' })
  async recordLesson(
    @Param('id') id: string,
    @Param('lessonId') lessonId: string,
    @CurrentUser() user: RequestUser,
  ) {
    return this.coursesService.recordLessonProgress(id, lessonId, user.id);
  }

  @Get('trainee/my-enrollments')
  @Roles(Role.TRAINEE)
  @ApiOperation({ summary: 'Trainee: Get personal enrolled courses, stages, and progress' })
  async getMyEnrollments(@CurrentUser() user: RequestUser) {
    return this.coursesService.getUserEnrollments(user.id);
  }

  @Get('trainer/my-courses')
  @Roles(Role.TRAINER, Role.ADMIN)
  @ApiOperation({ summary: 'Trainer: Get all authored courses across draft, submitted, and published' })
  async getMyAuthoredCourses(@CurrentUser() user: RequestUser) {
    return this.coursesService.getTrainerCourses(user.id);
  }

  @Get('trainer/analytics')
  @Roles(Role.TRAINER, Role.ADMIN)
  @ApiOperation({ summary: 'Trainer: actual enrolment, completion, and assessment performance totals' })
  async getTrainerAnalytics(@CurrentUser() user: RequestUser) {
    return this.coursesService.getTrainerAnalytics(user.id);
  }
}
