import { Module } from '@nestjs/common';
import { UsersService } from './users.service';
import { AdminUsersController } from './admin-users.controller';
import { MeController } from './me.controller';

@Module({
  controllers: [AdminUsersController, MeController],
  providers: [UsersService],
  exports: [UsersService],
})
export class UsersModule {}
