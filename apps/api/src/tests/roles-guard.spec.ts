import { Test, TestingModule } from '@nestjs/testing';
import { ForbiddenException } from '@nestjs/common';
import { RolesGuard } from '../common/guards/roles.guard';
import { Reflector } from '@nestjs/core';
import { Role, UserStatus } from '@capacity-connect/shared';

describe('RolesGuard (Role Escalation Protection)', () => {
  let guard: RolesGuard;
  let reflector: Reflector;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        RolesGuard,
        {
          provide: Reflector,
          useValue: {
            getAllAndOverride: jest.fn(),
          },
        },
      ],
    }).compile();

    guard = module.get<RolesGuard>(RolesGuard);
    reflector = module.get<Reflector>(Reflector);
  });

  const createMockContext = (user: any) => ({
    getHandler: () => ({}),
    getClass: () => ({}),
    switchToHttp: () => ({
      getRequest: () => ({ user }),
    }),
  } as any);

  it('blocks trainee from accessing admin routes', () => {
    jest.spyOn(reflector, 'getAllAndOverride').mockReturnValue([Role.ADMIN]);
    const context = createMockContext({
      role: Role.TRAINEE,
      status: UserStatus.ACTIVE,
    });

    expect(() => guard.canActivate(context)).toThrow(ForbiddenException);
  });

  it('allows admin on admin endpoints', () => {
    jest.spyOn(reflector, 'getAllAndOverride').mockReturnValue([Role.ADMIN]);
    const context = createMockContext({
      role: Role.ADMIN,
      status: UserStatus.ACTIVE,
    });

    expect(guard.canActivate(context)).toBe(true);
  });

  it('blocks pending users even if they claim a privileged role', () => {
    jest.spyOn(reflector, 'getAllAndOverride').mockReturnValue([Role.TRAINER]);
    const context = createMockContext({
      role: Role.TRAINER,
      status: UserStatus.PENDING,
    });

    expect(() => guard.canActivate(context)).toThrow(ForbiddenException);
  });
});
