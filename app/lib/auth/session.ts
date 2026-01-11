import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { lucia } from "@/app/lib/auth/lucia";

export type AppUserRole = "USER" | "ADMIN";
export type AppUserStatus = "PENDING" | "ACTIVE" | "DISABLED";

export type AppUser = {
  id: string;
  email: string;
  firstName: string | null;
  lastName: string | null;
  name: string | null;
  phone: string | null;
  role: AppUserRole;
  status: AppUserStatus;
};

export async function getCurrentUser(): Promise<{ session: any; user: AppUser | null }> {
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

  return { session: result.session, user: (result.user as any) ?? null };
}

export async function requireUser(): Promise<AppUser> {
  const { user, session } = await getCurrentUser();
  if (!user || !session) {
    // NFR-SEC-001: block unauthenticated access
    redirect("/login");
  }

  if (user.status !== "ACTIVE") {
    try {
      await lucia.invalidateSession(session.id);
      const sessionCookie = lucia.createBlankSessionCookie();
      cookies().set(sessionCookie.name, sessionCookie.value, sessionCookie.attributes);
    } catch {
      // ignore cookie write errors in edge cases
    }
    redirect("/login");
  }

  return user;
}

export async function requireAdmin() {
  const user = await requireUser();
  if (user.role !== "ADMIN") {
    redirect("/dashboard");
  }

  return user;
}
