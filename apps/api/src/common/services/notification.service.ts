import { Injectable, Logger } from '@nestjs/common';

@Injectable()
export class NotificationService {
  private readonly logger = new Logger(NotificationService.name);

  async sendEmail(to: string, subject: string, body: string): Promise<boolean> {
    void to; void subject; void body;
    this.logger.warn('Email provider is not configured; no email was sent.');
    return false;
  }

  async notifyAdmins(subject: string, message: string): Promise<void> {
    void message;
    this.logger.warn(`Admin notification was not delivered because no notification provider is configured. Subject: ${subject}`);
  }

  async sendApprovalEmail(userEmail: string, userName: string, role: string): Promise<void> {
    await this.sendEmail(
      userEmail,
      'Capacity Connect — Account Approved',
      `Dear ${userName},\n\nYour account on the IMD Capacity Connect portal has been approved with role: ${role}.\nYou may now log in to access the platform.`,
    );
  }

  async sendRejectionEmail(userEmail: string, userName: string, reason?: string): Promise<void> {
    await this.sendEmail(
      userEmail,
      'Capacity Connect — Registration Update',
      `Dear ${userName},\n\nYour registration request could not be approved at this time.\nReason: ${reason || 'Details could not be verified'}.\nPlease contact support if you have questions.`,
    );
  }
}
