import {
  Controller,
  Get,
  Patch,
  Body,
  Param,
  Query,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { UsersService } from './users.service';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { Role, UserStatus } from '@capacity-connect/shared';
import { PaginationDto } from '../../common/dto/pagination.dto';
import { NotificationService } from '../../common/services/notification.service';
import { AuditLogInterceptor } from '../../common/interceptors/audit-log.interceptor';
import { IsEnum, IsNotEmpty, IsOptional, IsString } from 'class-validator';

export class ApproveUserDto {
  @IsEnum(Role)
  role: Role;

  @IsOptional()
  @IsString()
  department?: string;
}

export class RejectUserDto {
  @IsOptional()
  @IsString()
  reason?: string;
}

export class UpdateRoleDto {
  @IsEnum(Role)
  role: Role;
}

@ApiTags('Admin: User Governance & Approval Gate')
@ApiBearerAuth()
@Roles(Role.ADMIN)
@UseGuards(RolesGuard)
@UseInterceptors(AuditLogInterceptor)
@Controller('admin/users')
export class AdminUsersController {
  constructor(
    private readonly usersService: UsersService,
    private readonly notificationService: NotificationService,
  ) {}

  @Get()
  @ApiOperation({ summary: 'Admin: List users with filter by status, role, and keyword' })
  async getUsers(
    @Query() pagination: PaginationDto,
    @Query('status') status?: UserStatus,
    @Query('role') role?: Role,
  ) {
    return this.usersService.findAllAdmin(pagination, status, role);
  }

  @Patch(':id/approve')
  @ApiOperation({ summary: 'Admin: Approve a pending user and assign a role and department' })
  async approveUser(
    @Param('id') id: string,
    @Body() dto: ApproveUserDto,
  ) {
    const updated = await this.usersService.updateUserStatusAndRole(
      id,
      UserStatus.ACTIVE,
      dto.role,
      dto.department,
    );

    // Trigger notification
    await this.notificationService.sendApprovalEmail(
      updated.email,
      updated.name,
      dto.role,
    );

    return updated;
  }

  @Patch(':id/reject')
  @ApiOperation({ summary: 'Admin: Reject user application' })
  async rejectUser(
    @Param('id') id: string,
    @Body() dto: RejectUserDto,
  ) {
    const updated = await this.usersService.updateUserStatusAndRole(
      id,
      UserStatus.REJECTED,
      undefined,
      undefined,
    );

    await this.notificationService.sendRejectionEmail(
      updated.email,
      updated.name,
      dto.reason,
    );

    return updated;
  }

  @Patch(':id/role')
  @ApiOperation({ summary: 'Admin: Change active user role' })
  async changeRole(
    @Param('id') id: string,
    @Body() dto: UpdateRoleDto,
  ) {
    return this.usersService.updateUserStatusAndRole(
      id,
      UserStatus.ACTIVE,
      dto.role,
    );
  }

  @Patch(':id/deactivate')
  @ApiOperation({ summary: 'Admin: Deactivate user account' })
  async deactivateUser(@Param('id') id: string) {
    return this.usersService.updateUserStatusAndRole(
      id,
      UserStatus.DEACTIVATED,
    );
  }
}
