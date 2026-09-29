import { Controller, Get, Post, Param, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { CertificatesService } from './certificates.service';
import { Public, Roles } from '../../common/decorators/roles.decorator';
import { RolesGuard } from '../../common/guards/roles.guard';
import { CurrentUser, RequestUser } from '../../common/decorators/current-user.decorator';
import { Role } from '@capacity-connect/shared';

@ApiTags('Certificates & Verification')
@Controller()
export class CertificatesController {
  constructor(private readonly certificatesService: CertificatesService) {}

  @ApiBearerAuth()
  @UseGuards(RolesGuard)
  @Post('certificates/issue/:enrollmentId')
  @Roles(Role.TRAINEE, Role.ADMIN)
  @ApiOperation({ summary: 'Issue a platform training record after course completion and a passing course assessment' })
  async issue(
    @Param('enrollmentId') enrollmentId: string,
    @CurrentUser() user: RequestUser,
  ) {
    return this.certificatesService.generateCertificate(enrollmentId, user.id, user.role as Role);
  }

  @Public()
  @Get('verify/:serial')
  @ApiOperation({ summary: 'Public: Look up a saved platform training record by serial number' })
  async verify(@Param('serial') serial: string) {
    return this.certificatesService.verifyBySerial(serial);
  }
}
