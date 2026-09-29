import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { LibraryService } from './library.service';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { CurrentUser, RequestUser } from '../../common/decorators/current-user.decorator';
import { Role, MediaVisibility, ResourceType } from '@capacity-connect/shared';
import { IsEnum, IsInt, IsNotEmpty, IsOptional, IsString } from 'class-validator';

export class RequestUploadUrlDto {
  @IsNotEmpty()
  @IsString()
  filename: string;

  @IsNotEmpty()
  @IsString()
  mimeType: string;

  @IsInt()
  fileSize: number;
}

export class ConfirmLibraryDto {
  @IsNotEmpty()
  @IsString()
  title: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsString()
  subjectId?: string;

  @IsOptional()
  @IsString()
  courseId?: string;

  @IsOptional()
  @IsEnum(ResourceType)
  resourceType?: ResourceType;

  @IsOptional()
  tags?: string[];

  @IsNotEmpty()
  @IsString()
  fileKey: string;

  @IsOptional()
  @IsInt()
  fileSize?: number;

  @IsOptional()
  @IsString()
  mimeType?: string;

  @IsOptional()
  @IsEnum(MediaVisibility)
  visibility?: MediaVisibility;
}

@ApiTags('Trainer Library & Media')
@ApiBearerAuth()
@UseGuards(RolesGuard)
@Controller('library')
export class LibraryController {
  constructor(private readonly libraryService: LibraryService) {}

  @Post('upload-url')
  @Roles(Role.TRAINER, Role.ADMIN)
  @ApiOperation({ summary: 'Trainer: Validate size/type and get signed upload location' })
  async getUploadUrl(@Body() dto: RequestUploadUrlDto) {
    return this.libraryService.getUploadUrl(dto.filename, dto.mimeType, dto.fileSize);
  }

  @Post('confirm')
  @Roles(Role.TRAINER, Role.ADMIN)
  @ApiOperation({ summary: 'Trainer: Confirm upload and index library metadata with visibility' })
  async confirmUpload(
    @CurrentUser() user: RequestUser,
    @Body() dto: ConfirmLibraryDto,
  ) {
    return this.libraryService.confirmUpload(user.id, user.role as Role, dto);
  }

  @Get()
  @ApiOperation({ summary: 'Search library by title, tags, or subject' })
  async search(
    @Query('q') q?: string,
    @Query('subjectId') subjectId?: string,
    @Query('courseId') courseId?: string,
    @CurrentUser() user?: RequestUser,
  ) {
    return this.libraryService.searchLibrary(q, subjectId, courseId, user?.id, user?.role as Role);
  }

  @Get(':id/stream-url')
  @ApiOperation({ summary: 'Get signed stream/view URL gated by visibility (public, enrolled, private)' })
  async getStreamUrl(
    @Param('id') id: string,
    @CurrentUser() user?: RequestUser,
  ) {
    return this.libraryService.getItemStreamUrl(id, user?.id, user?.role as Role);
  }
}
