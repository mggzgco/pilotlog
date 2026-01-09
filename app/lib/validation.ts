import { z } from "zod";

export const passwordSchema = z
  .string()
  .min(10)
  .regex(/[a-z]/, "Password must include a lowercase letter.")
  .regex(/[A-Z]/, "Password must include an uppercase letter.")
  .regex(/[0-9]/, "Password must include a number.");

// AUTH-002: validate registration inputs with strong password rules
export const registerSchema = z.object({
  email: z.string().email(),
  name: z.string().min(2),
  phone: z.string().min(7),
  // AUTH-012: enforce minimum password length
  password: passwordSchema
});

export const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1)
});

export const forgotPasswordSchema = z.object({
  email: z.string().email()
});

export const resetPasswordSchema = z
  .object({
    token: z.string().min(10),
    password: passwordSchema,
    confirmPassword: z.string().min(1)
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: "Passwords do not match.",
    path: ["confirmPassword"]
  });

export const changePasswordSchema = z
  .object({
    currentPassword: z.string().min(1),
    newPassword: passwordSchema,
    confirmPassword: z.string().min(1)
  })
  .refine((data) => data.newPassword === data.confirmPassword, {
    message: "Passwords do not match.",
    path: ["confirmPassword"]
  });

export const updateProfileSchema = z.object({
  firstName: z.string().optional(),
  lastName: z.string().optional(),
  phone: z.string().optional()
});

export const flightSchema = z.object({
  tailNumber: z.string().min(3),
  origin: z.string().min(3),
  destination: z.string().min(3).optional(),
  startTime: z.string().min(1),
  endTime: z.string().optional(),
  durationMinutes: z.number().int().positive().optional()
});

export const costSchema = z.object({
  amount: z.string().min(1),
  currency: z.string().min(3).default("USD"),
  description: z.string().optional(),
  date: z.string().min(1)
});

export const logbookSchema = z.object({
  date: z.string().min(1),
  totalTime: z.string().optional(),
  picTime: z.string().optional(),
  sicTime: z.string().optional(),
  nightTime: z.string().optional(),
  instrumentTime: z.string().optional(),
  remarks: z.string().optional()
});

export const importSchema = z.object({
  tailNumber: z.string().min(3),
  start: z.string().min(1),
  end: z.string().min(1)
});
