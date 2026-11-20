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
export const familyCodeSchema = z.string().regex(/^\d{4,8}$/, 'Mã gia đình gồm 4–8 chữ số');
export const familyNameSchema = z
  .string()
  .trim()
  .min(2, 'Tên gia đình cần ít nhất 2 ký tự')
  .max(40, 'Tên gia đình tối đa 40 ký tự')
  .regex(/[\p{L}\p{N}]/u, 'Tên gia đình cần có chữ hoặc số');
/** Đăng nhập gia đình: tên + (mã gia đình HOẶC PIN phụ huynh). */
export const familyLoginSchema = z
  .object({ name: z.string().trim().min(1).max(40), code: familyCodeSchema.optional(), pin: pinSchema.optional() })
  .refine((v) => (v.code === undefined) !== (v.pin === undefined) || (v.code === undefined && v.pin === undefined), 'Chỉ nhập mã gia đình hoặc PIN');
export const familyRegisterSchema = z.object({
  name: familyNameSchema,
  code: familyCodeSchema,
  pin: pinSchema.optional(),
  invite: z.string().trim().max(100).optional(),
});
export const setFamilyCodeSchema = z.object({ code: familyCodeSchema });
export const renameFamilySchema = z.object({ name: familyNameSchema });
export const changePinSchema = z.object({ currentPin: pinSchema, newPin: pinSchema });

export const settingsSchema = z
  .object({
    soundEnabled: z.boolean().optional(),
    reducedMotion: z.boolean().optional(),
    ageGroup: z.enum(['preschool', 'primary']).optional(),
  })
  .refine((v) => v.soundEnabled !== undefined || v.reducedMotion !== undefined || v.ageGroup !== undefined, 'Không có thay đổi');

export const resetSchema = z.object({ confirm: z.literal('XOA') });

export const historyQuerySchema = z.object({
  page: z.coerce.number().int().min(1).max(10_000).default(1),
  pageSize: z.coerce.number().int().min(1).max(50).default(10),
  chapterId: z.string().min(1).max(64).optional(),
});

export const uuidSchema = z.uuid();

// ---------- Nhóm 5–9 tuổi ----------
export const challengeCompleteSchema = z.object({
  answers: z
    .array(z.object({ questionId: z.string().min(1).max(16), value: z.number().int().min(0).max(99_999) }))
    .max(200),
});
export const redeemSchema = z.object({ redemptionId: z.uuid(), rewardId: z.uuid() });
export const shopRewardSchema = z.object({
  name: z.string().trim().min(1, 'Hãy nhập tên món quà').max(60),
  cost: z.number().int().min(1).max(100_000),
});
