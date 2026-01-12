import { z } from "zod";
import { costCategoryValues } from "@/app/lib/costs/categories";
import { normalizeTimeOfDay } from "@/app/lib/time";

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
  phone: z.string().optional(),
  homeAirport: z.string().optional(),
  homeTimeZone: z.string().optional()
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
  category: z.enum(costCategoryValues),
  amount: z.string().min(1),
  vendor: z.string().optional(),
  notes: z.string().optional(),
  date: z.string().min(1),
  flightId: z.string().min(1)
});

export const logbookSchema = z.object({
  id: z.string().optional(),
  status: z.enum(["OPEN", "CLOSED"]).optional(),
  date: z.string().min(1),
  flightId: z.string().optional(),
  totalTime: z.string().optional(),
  picTime: z.string().optional(),
  sicTime: z.string().optional(),
  dualReceivedTime: z.string().optional(),
  soloTime: z.string().optional(),
  nightTime: z.string().optional(),
  xcTime: z.string().optional(),
  simulatedInstrumentTime: z.string().optional(),
  instrumentTime: z.string().optional(),
  simulatorTime: z.string().optional(),
  groundTime: z.string().optional(),
  timeOut: z.preprocess(
    (v) => {
      if (v === null || v === undefined) return undefined;
      const raw = String(v).trim();
      if (!raw) return undefined;
      return normalizeTimeOfDay(raw) ?? raw;
    },
    z
      .string()
      .regex(/^([01]\d|2[0-3]):[0-5]\d$/, "Time must be HH:MM (or HHMM).")
      .optional()
  ),
  timeIn: z.preprocess(
    (v) => {
      if (v === null || v === undefined) return undefined;
      const raw = String(v).trim();
      if (!raw) return undefined;
      return normalizeTimeOfDay(raw) ?? raw;
    },
    z
      .string()
      .regex(/^([01]\d|2[0-3]):[0-5]\d$/, "Time must be HH:MM (or HHMM).")
      .optional()
  ),
  hobbsOut: z.string().optional(),
  hobbsIn: z.string().optional(),
  dayTakeoffs: z.string().optional(),
  dayLandings: z.string().optional(),
  nightTakeoffs: z.string().optional(),
  nightLandings: z.string().optional(),
  remarks: z.string().optional()
});

export const importSchema = z.object({
  tailNumber: z.string().min(3),
  start: z.string().min(1),
  end: z.string().min(1)
});
