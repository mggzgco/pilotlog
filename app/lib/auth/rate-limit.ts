const LOGIN_LIMIT = 5;
const PASSWORD_RESET_LIMIT = 3;
const WINDOW_MS = 15 * 60 * 1000;

type RateLimitState = { count: number; resetAt: number };

const loginAttempts = new Map<string, RateLimitState>();
const passwordResetAttempts = new Map<string, RateLimitState>();

function consumeAttempt(map: Map<string, RateLimitState>, key: string, limit: number) {
  const now = Date.now();
  const entry = map.get(key);

  if (!entry || entry.resetAt <= now) {
    map.set(key, { count: 1, resetAt: now + WINDOW_MS });
    return { allowed: true, remaining: limit - 1, resetAt: now + WINDOW_MS };
  }

  if (entry.count >= limit) {
    return { allowed: false, remaining: 0, resetAt: entry.resetAt };
  }

  entry.count += 1;
  map.set(key, entry);
  return { allowed: true, remaining: limit - entry.count, resetAt: entry.resetAt };
}

// NOTE: For production, replace this in-memory limiter with Redis or another shared store.
export function consumeLoginAttempt(key: string) {
  return consumeAttempt(loginAttempts, key, LOGIN_LIMIT);
}

export function resetLoginAttempts(key: string) {
  loginAttempts.delete(key);
}

export function formatRateLimitError(resetAt: number) {
  const remainingMs = Math.max(0, resetAt - Date.now());
  const minutes = Math.max(1, Math.ceil(remainingMs / 60000));
  return `Too many login attempts. Try again in ${minutes} minute${minutes === 1 ? "" : "s"}.`;
}

export function formatPasswordResetRateLimitError(resetAt: number) {
  const remainingMs = Math.max(0, resetAt - Date.now());
  const minutes = Math.max(1, Math.ceil(remainingMs / 60000));
  return `Too many reset requests. Try again in ${minutes} minute${minutes === 1 ? "" : "s"}.`;
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
