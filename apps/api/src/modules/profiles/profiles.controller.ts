import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  UseGuards,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { ProfilesService } from './profiles.service';
import { RolesGuard } from '../../common/guards/roles.guard';
import { CurrentUser, RequestUser } from '../../common/decorators/current-user.decorator';
import { Public } from '../../common/decorators/roles.decorator';
import { IsInt, IsNotEmpty, IsNumber, IsOptional, IsString, Max, Min } from 'class-validator';

export class AddQualificationDto {
  @IsNotEmpty()
  @IsString()
  degree: string;

  @IsNotEmpty()
  @IsString()
  field: string;

  @IsNotEmpty()
  @IsString()
  institution: string;

  @IsNumber()
  year: number;
}

export class AddExperienceDto {
  @IsNotEmpty()
  @IsString()
  title: string;

  @IsOptional()
  @IsString()
  organization?: string;

  @IsNumber()
  startYear: number;

  @IsOptional()
  @IsNumber()
  endYear?: number;

  @IsOptional()
  @IsString()
  description?: string;
}

export class AddCertificateDto {
  @IsNotEmpty()
  @IsString()
  title: string;

  @IsNotEmpty()
  @IsString()
  issuingBody: string;

  @IsNumber()
  issueYear: number;

  @IsNotEmpty()
  @IsString()
  fileUrl: string;
}

export class SetSkillDto {
  @IsNotEmpty()
  @IsString()
  skillId: string;

  @IsInt()
  @Min(1)
  @Max(5)
  proficiency: number;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(5)
  targetProficiency?: number;
}

@ApiTags('Profiles & Skills Taxonomy')
@ApiBearerAuth()
@UseGuards(RolesGuard)
@Controller('profiles')
export class ProfilesController {
  constructor(private readonly profilesService: ProfilesService) {}

  @Get('me')
  @ApiOperation({ summary: 'Get full profile, qualifications, work experiences, and skills' })
  async getMyProfile(@CurrentUser() user: RequestUser) {
    return this.profilesService.getProfile(user.id);
  }

  @Post('qualifications')
  @ApiOperation({ summary: 'Add educational qualification' })
  async addQualification(
    @CurrentUser() user: RequestUser,
    @Body() dto: AddQualificationDto,
  ) {
    return this.profilesService.addQualification(user.id, dto);
  }

  @Post('experiences')
  @ApiOperation({ summary: 'Add work experience record' })
  async addExperience(
    @CurrentUser() user: RequestUser,
    @Body() dto: AddExperienceDto,
  ) {
    return this.profilesService.addWorkExperience(user.id, dto);
  }

  @Post('certificates')
  @ApiOperation({ summary: 'Add earned certificate record' })
  async addCertificate(
    @CurrentUser() user: RequestUser,
    @Body() dto: AddCertificateDto,
  ) {
    return this.profilesService.addCertificate(user.id, dto);
  }

  @Public()
  @Get('skills/taxonomy')
  @ApiOperation({ summary: 'Public: List hierarchical skills taxonomy' })
  async getSkillsTaxonomy() {
    return this.profilesService.getSkillsTaxonomy();
  }

  @Post('skills')
  @ApiOperation({ summary: 'Set user skill proficiency level (1-5 scale)' })
  async setSkill(
    @CurrentUser() user: RequestUser,
    @Body() dto: SetSkillDto,
  ) {
    return this.profilesService.setUserSkill(user.id, dto.skillId, dto.proficiency, dto.targetProficiency);
  }
}
