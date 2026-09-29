import { Test, TestingModule } from '@nestjs/testing';
import { ForbiddenException, UnauthorizedException } from '@nestjs/common';
import { StatusGuard } from '../common/guards/status.guard';
import { Reflector } from '@nestjs/core';
import { UserStatus } from '@capacity-connect/shared';

describe('StatusGuard (Security & Approval Gate)', () => {
  let guard: StatusGuard;
  let reflector: Reflector;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        StatusGuard,
        {
          provide: Reflector,
          useValue: {
            getAllAndOverride: jest.fn(),
          },
        },
      ],
    }).compile();

    guard = module.get<StatusGuard>(StatusGuard);
    reflector = module.get<Reflector>(Reflector);
  });

  const createMockContext = (user: any) => ({
    getHandler: () => ({}),
    getClass: () => ({}),
    switchToHttp: () => ({
      getRequest: () => ({ user }),
    }),
  } as any);

  it('allows active users to proceed', () => {
    jest.spyOn(reflector, 'getAllAndOverride').mockReturnValue(false);
    const context = createMockContext({ status: UserStatus.ACTIVE });
    expect(guard.canActivate(context)).toBe(true);
  });

  it('rejects pending users trying to access protected endpoints', () => {
    jest.spyOn(reflector, 'getAllAndOverride').mockReturnValue(false);
    const context = createMockContext({ status: UserStatus.PENDING });
    expect(() => guard.canActivate(context)).toThrow(ForbiddenException);
  });

  it('permits pending users on routes decorated with @AllowPending()', () => {
    jest.spyOn(reflector, 'getAllAndOverride').mockImplementation((key) => {
      return key === 'allowPending';
    });
    const context = createMockContext({ status: UserStatus.PENDING });
    expect(guard.canActivate(context)).toBe(true);
  });

  it('rejects rejected users with ForbiddenException', () => {
    jest.spyOn(reflector, 'getAllAndOverride').mockReturnValue(false);
    const context = createMockContext({ status: UserStatus.REJECTED });
    expect(() => guard.canActivate(context)).toThrow(ForbiddenException);
  });

  it('rejects deactivated users with ForbiddenException', () => {
    jest.spyOn(reflector, 'getAllAndOverride').mockReturnValue(false);
    const context = createMockContext({ status: UserStatus.DEACTIVATED });
    expect(() => guard.canActivate(context)).toThrow(ForbiddenException);
  });
});
