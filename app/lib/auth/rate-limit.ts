const LOGIN_LIMIT = 5;
const WINDOW_MS = 15 * 60 * 1000;

type RateLimitState = { count: number; resetAt: number };

const loginAttempts = new Map<string, RateLimitState>();

// NOTE: For production, replace this in-memory limiter with Redis or another shared store.
export function consumeLoginAttempt(key: string) {
  const now = Date.now();
  const entry = loginAttempts.get(key);

  if (!entry || entry.resetAt <= now) {
    loginAttempts.set(key, { count: 1, resetAt: now + WINDOW_MS });
    return { allowed: true, remaining: LOGIN_LIMIT - 1, resetAt: now + WINDOW_MS };
  }

  if (entry.count >= LOGIN_LIMIT) {
    return { allowed: false, remaining: 0, resetAt: entry.resetAt };
  }

  entry.count += 1;
  loginAttempts.set(key, entry);
  return { allowed: true, remaining: LOGIN_LIMIT - entry.count, resetAt: entry.resetAt };
}

export function resetLoginAttempts(key: string) {
  loginAttempts.delete(key);
}

export function formatRateLimitError(resetAt: number) {
  const remainingMs = Math.max(0, resetAt - Date.now());
  const minutes = Math.max(1, Math.ceil(remainingMs / 60000));
  return `Too many login attempts. Try again in ${minutes} minute${minutes === 1 ? "" : "s"}.`;
}
