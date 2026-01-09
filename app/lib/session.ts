import { cookies } from "next/headers";
import { lucia } from "@/app/lib/auth";

export async function getCurrentSession() {
  const sessionId = cookies().get(lucia.sessionCookieName)?.value ?? null;
  if (!sessionId) {
    return { session: null, user: null };
  }

  const result = await lucia.validateSession(sessionId);
  try {
    if (result.session && result.session.fresh) {
      const sessionCookie = lucia.createSessionCookie(result.session.id);
      cookies().set(sessionCookie.name, sessionCookie.value, sessionCookie.attributes);
    }
    if (!result.session) {
      const sessionCookie = lucia.createBlankSessionCookie();
      cookies().set(sessionCookie.name, sessionCookie.value, sessionCookie.attributes);
    }
  } catch {
    // ignore cookie write errors in edge cases
  }

  return result;
}

export async function requireUser() {
  const { user } = await getCurrentSession();
  if (!user) {
    // NFR-SEC-001: block unauthenticated access
    throw new Error("Unauthorized");
  }
  return user;
}
