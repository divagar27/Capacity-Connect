import {
  Controller,
  Post,
  Get,
  Param,
  Body,
  UseGuards,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { FeedbackService } from './feedback.service';
import { RolesGuard } from '../../common/guards/roles.guard';
import { CurrentUser, RequestUser } from '../../common/decorators/current-user.decorator';
import { Public } from '../../common/decorators/roles.decorator';
import { IsInt, IsNotEmpty, IsOptional, IsString, Max, Min } from 'class-validator';

export class SubmitFeedbackDto {
  @IsNotEmpty()
  @IsString()
  courseId: string;

  @IsInt()
  @Min(1)
  @Max(5)
  rating: number;

  @IsOptional()
  @IsString()
  comments?: string;
}

@ApiTags('Feedback & Ratings')
@Controller('feedback')
export class FeedbackController {
  constructor(private readonly feedbackService: FeedbackService) {}

  @ApiBearerAuth()
  @UseGuards(RolesGuard)
  @Post()
  @ApiOperation({ summary: 'Trainee: Submit rating & review for enrolled course (one per target)' })
  async submitFeedback(
    @CurrentUser() user: RequestUser,
    @Body() dto: SubmitFeedbackDto,
  ) {
    return this.feedbackService.submitFeedback(
      user.id,
      dto.courseId,
      dto.rating,
      dto.comments,
    );
  }

  @Public()
  @Get('trainer/:trainerId/rating')
  @ApiOperation({ summary: 'Public: Get average feedback rating of a trainer' })
  async getTrainerRating(@Param('trainerId') trainerId: string) {
    const avg = await this.feedbackService.getTrainerAverageRating(trainerId);
    return { trainerId, averageRating: avg };
  }
}
