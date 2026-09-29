import { z } from 'zod';
import { Role, UserStatus, CourseStatus, AssessmentStatus } from '../enums';

export const GoogleAuthSchema = z.object({
  code: z.string().min(1, 'Authorization code is required'),
  codeVerifier: z.string().min(1, 'Code verifier (PKCE) is required'),
  redirectUri: z.string().url('Invalid redirect URI').optional(),
});
export type GoogleAuthInput = z.infer<typeof GoogleAuthSchema>;

export const OnboardingSchema = z.object({
  requestedRole: z.nativeEnum(Role),
  department: z.string().min(2, 'Department is required'),
  designation: z.string().min(2, 'Designation is required'),
  employeeId: z.string().min(2, 'Employee ID is required'),
  phone: z.string().regex(/^[0-9+ -]{8,15}$/, 'Valid phone number is required'),
});
export type OnboardingInput = z.infer<typeof OnboardingSchema>;

export const UpdateUserStatusSchema = z.object({
  status: z.nativeEnum(UserStatus),
  role: z.nativeEnum(Role).optional(),
  department: z.string().optional(),
  reason: z.string().max(500).optional(),
});
export type UpdateUserStatusInput = z.infer<typeof UpdateUserStatusSchema>;

export const CreateCourseSchema = z.object({
  title: z.string().min(3).max(200),
  description: z.string().min(10),
  subjectId: z.string().uuid(),
  level: z.enum(['BEGINNER', 'INTERMEDIATE', 'ADVANCED']).default('BEGINNER'),
  capacity: z.number().int().min(1).default(100),
  thumbnailUrl: z.string().url().optional(),
});
export type CreateCourseInput = z.infer<typeof CreateCourseSchema>;

export const SubmitQuizAttemptSchema = z.object({
  answers: z.array(
    z.object({
      questionId: z.string().uuid(),
      selectedOptionId: z.string().uuid().optional(),
    })
  ),
});
export type SubmitQuizAttemptInput = z.infer<typeof SubmitQuizAttemptSchema>;

export const CreateFeedbackSchema = z.object({
  courseId: z.string().uuid(),
  trainerId: z.string().uuid().optional(),
  rating: z.number().int().min(1).max(5),
  comments: z.string().max(1000).optional(),
});
export type CreateFeedbackInput = z.infer<typeof CreateFeedbackSchema>;

export const CreateAnnouncementSchema = z.object({
  title: z.string().min(3).max(200),
  content: z.string().min(10),
  type: z.enum(['NOTICE', 'ACHIEVEMENT', 'NEW_CONTENT']),
  pinned: z.boolean().default(false),
  expireAt: z.string().datetime().optional(),
});
export type CreateAnnouncementInput = z.infer<typeof CreateAnnouncementSchema>;
