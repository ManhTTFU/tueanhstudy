import { z } from 'zod';
import { badRequest } from './errors.js';

export function parseBody<T>(schema: z.ZodType<T>, body: unknown): T {
  const result = schema.safeParse(body ?? {});
  if (!result.success) {
    throw badRequest(
      'Dữ liệu gửi lên không hợp lệ',
      result.error.issues.slice(0, 10).map((i) => ({ path: i.path.join('.'), message: i.message })),
    );
  }
  return result.data;
}

const answerValue = z.number().int().min(-1_000_000).max(1_000_000);

export const startQuizSchema = z.object({
  chapterId: z.string().min(1).max(64),
});

export const completeQuizSchema = z.object({
  answers: z
    .array(
      z.object({
        questionId: z.string().min(1).max(128),
        attempts: z.array(answerValue).min(1).max(10),
      }),
    )
    .min(1)
    .max(100),
  clientDurationMs: z.number().int().min(0).max(86_400_000).optional(),
});

export const learningCompleteSchema = z.object({
  chapterId: z.string().min(1).max(64),
});

export const openGiftSchema = z.object({
  giftId: z.uuid(),
});

export const pinSchema = z.string().regex(/^\d{4,6}$/, 'Mã PIN gồm 4–6 chữ số');

export const setupPinSchema = z.object({ pin: pinSchema });
export const loginSchema = z.object({ pin: pinSchema });
export const changePinSchema = z.object({ currentPin: pinSchema, newPin: pinSchema });

export const settingsSchema = z
  .object({
    soundEnabled: z.boolean().optional(),
    reducedMotion: z.boolean().optional(),
  })
  .refine((v) => v.soundEnabled !== undefined || v.reducedMotion !== undefined, 'Không có thay đổi');

export const resetSchema = z.object({ confirm: z.literal('XOA') });

export const historyQuerySchema = z.object({
  page: z.coerce.number().int().min(1).max(10_000).default(1),
  pageSize: z.coerce.number().int().min(1).max(50).default(10),
  chapterId: z.string().min(1).max(64).optional(),
});

export const uuidSchema = z.uuid();
