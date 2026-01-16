const LOGIN_LIMIT = 5;
const PASSWORD_RESET_LIMIT = 3;
const REGISTER_LIMIT = 3;
const RESEND_VERIFICATION_LIMIT = 3;
const WINDOW_MS = 15 * 60 * 1000;

type RateLimitState = { count: number; resetAt: number };

type RateLimitResult = {
  allowed: boolean;
  remaining: number;
  resetAt: number;
};

const loginAttempts = new Map<string, RateLimitState>();
const passwordResetAttempts = new Map<string, RateLimitState>();
const registrationAttempts = new Map<string, RateLimitState>();
const resendAttempts = new Map<string, RateLimitState>();

function consumeAttempt(
  map: Map<string, RateLimitState>,
  key: string,
  limit: number
): RateLimitResult {
  const now = Date.now();
  const entry = map.get(key);

  if (!entry || entry.resetAt <= now) {
    const resetAt = now + WINDOW_MS;
    map.set(key, { count: 1, resetAt });
    return { allowed: true, remaining: limit - 1, resetAt };
  }

  if (entry.count >= limit) {
    return { allowed: false, remaining: 0, resetAt: entry.resetAt };
  }

  entry.count += 1;
  map.set(key, entry);
  return { allowed: true, remaining: limit - entry.count, resetAt: entry.resetAt };
}

function formatRemainingMinutes(resetAt: number) {
  const remainingMs = Math.max(0, resetAt - Date.now());
  const minutes = Math.max(1, Math.ceil(remainingMs / 60000));
  return { minutes, label: minutes === 1 ? "minute" : "minutes" };
}

// NOTE: For production, replace this in-memory limiter with Redis or another shared store.
export function consumeLoginAttempt(key: string) {
  return consumeAttempt(loginAttempts, key, LOGIN_LIMIT);
}

export function resetLoginAttempts(key: string) {
  loginAttempts.delete(key);
}

export function formatRateLimitError(resetAt: number) {
  const { minutes, label } = formatRemainingMinutes(resetAt);
  return `Too many login attempts. Try again in ${minutes} ${label}.`;
}

export function formatPasswordResetRateLimitError(resetAt: number) {
  const { minutes, label } = formatRemainingMinutes(resetAt);
  return `Too many reset requests. Try again in ${minutes} ${label}.`;
}

export function consumeRegistrationAttempt({
  ipAddress,
  email
}: {
  ipAddress: string;
  email: string;
}) {
  const ipKey = `ip:${ipAddress}`;
  const emailKey = `email:${email}`;
  const ipResult = consumeAttempt(registrationAttempts, ipKey, REGISTER_LIMIT);
  const emailResult = consumeAttempt(registrationAttempts, emailKey, REGISTER_LIMIT);
  if (!ipResult.allowed || !emailResult.allowed) {
    const resetAt = Math.max(ipResult.resetAt ?? 0, emailResult.resetAt ?? 0);
    return { allowed: false, resetAt };
  }
  return { allowed: true, resetAt: Math.max(ipResult.resetAt, emailResult.resetAt) };
}

export function formatRegistrationRateLimitError(resetAt: number) {
  const { minutes, label } = formatRemainingMinutes(resetAt);
  return `Too many registration attempts. Try again in ${minutes} ${label}.`;
}

export function consumeResendVerificationAttempt({
  ipAddress,
  email
}: {
  ipAddress: string;
  email: string;
}) {
  const ipKey = `ip:${ipAddress}`;
  const emailKey = `email:${email}`;
  const ipResult = consumeAttempt(resendAttempts, ipKey, RESEND_VERIFICATION_LIMIT);
  const emailResult = consumeAttempt(resendAttempts, emailKey, RESEND_VERIFICATION_LIMIT);
  if (!ipResult.allowed || !emailResult.allowed) {
    const resetAt = Math.max(ipResult.resetAt ?? 0, emailResult.resetAt ?? 0);
    return { allowed: false, resetAt };
  }
  return { allowed: true, resetAt: Math.max(ipResult.resetAt, emailResult.resetAt) };
}

export function formatResendVerificationRateLimitError(resetAt: number) {
  const { minutes, label } = formatRemainingMinutes(resetAt);
  return `Too many verification emails. Try again in ${minutes} ${label}.`;
}

export function consumePasswordResetAttempt({
  ipAddress,
  email
}: {
  ipAddress: string;
  email: string;
}) {
  const ipKey = `ip:${ipAddress}`;
  const emailKey = `email:${email}`;
  const ipResult = consumeAttempt(passwordResetAttempts, ipKey, PASSWORD_RESET_LIMIT);
  const emailResult = consumeAttempt(passwordResetAttempts, emailKey, PASSWORD_RESET_LIMIT);

  if (!ipResult.allowed || !emailResult.allowed) {
    const resetAt = Math.max(ipResult.resetAt ?? 0, emailResult.resetAt ?? 0);
    return { allowed: false, resetAt };
  }

  return { allowed: true, resetAt: Math.max(ipResult.resetAt, emailResult.resetAt) };
}
