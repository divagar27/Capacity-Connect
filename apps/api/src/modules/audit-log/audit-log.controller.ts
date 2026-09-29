import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { AuditLogService } from './audit-log.service';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { Role } from '@capacity-connect/shared';
import { PaginationDto } from '../../common/dto/pagination.dto';

@ApiTags('Application Audit Logs')
@ApiBearerAuth()
@UseGuards(RolesGuard)
@Controller('audit-logs')
export class AuditLogController {
  constructor(private readonly auditLogService: AuditLogService) {}

  @Get()
  @Roles(Role.ADMIN)
  @ApiOperation({ summary: 'Admin: Retrieve recorded application audit events' })
  async getLogs(@Query() pagination: PaginationDto) {
    return this.auditLogService.getAuditLogs(pagination.page, pagination.limit);
  }
}
