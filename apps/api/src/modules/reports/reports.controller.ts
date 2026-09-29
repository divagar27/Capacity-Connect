import { Controller, Get, Res, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { Response } from 'express';
import { ReportsService } from './reports.service';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { Role } from '@capacity-connect/shared';

@ApiTags('Admin Statistics & Reports')
@ApiBearerAuth()
@Roles(Role.ADMIN)
@UseGuards(RolesGuard)
@Controller('admin')
export class ReportsController {
  constructor(private readonly reportsService: ReportsService) {}

  @Get('stats')
  @ApiOperation({ summary: 'Admin: Get current aggregate counts and recorded competency data' })
  async getStats() {
    return this.reportsService.getAdminStats();
  }

  @Get('reports/enrollments/csv')
  @ApiOperation({ summary: 'Admin: Export enrollment and completion report as CSV' })
  async exportCsv(@Res() res: Response) {
    const csv = await this.reportsService.exportEnrollmentsCsv();
    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', 'attachment; filename="capacity-connect-enrollment-report.csv"');
    res.send(csv);
  }
}
