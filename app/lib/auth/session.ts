import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { lucia } from "@/app/lib/auth/lucia";
import { prisma } from "@/app/lib/db";

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
  emailVerifiedAt?: string | Date | null;
  deletedAt?: string | Date | null;
};

export async function getCurrentUser(): Promise<{ session: any; user: AppUser | null }> {
  const sessionId = cookies().get(lucia.sessionCookieName)?.value ?? null;
  if (!sessionId) {
    return { session: null, user: null };
  }

  const result = await lucia.validateSession(sessionId);
  try {
    // SESSION-001: rolling session expiration ("idle timeout") via DB expiresAt + cookie refresh
    if (result.session) {
      const idleMinutes = Number(process.env.SESSION_IDLE_MINUTES ?? 120);
      const idleMs =
        Number.isFinite(idleMinutes) && idleMinutes > 0
          ? idleMinutes * 60 * 1000
          : 120 * 60 * 1000;
      const nextExpiresAt = new Date(Date.now() + idleMs);
      // Best-effort: extend expiry; if this fails we still keep the current session.
      try {
        await prisma.session.update({
          where: { id: result.session.id },
          data: { expiresAt: nextExpiresAt }
        });
      } catch {
        // ignore
      }
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

  if (user.deletedAt) {
    try {
      await lucia.invalidateSession(session.id);
      const sessionCookie = lucia.createBlankSessionCookie();
      cookies().set(sessionCookie.name, sessionCookie.value, sessionCookie.attributes);
    } catch {
      // ignore cookie write errors in edge cases
    }
    redirect("/account-disabled");
  }

  if (user.status !== "ACTIVE") {
    try {
      await lucia.invalidateSession(session.id);
      const sessionCookie = lucia.createBlankSessionCookie();
      cookies().set(sessionCookie.name, sessionCookie.value, sessionCookie.attributes);
    } catch {
      // ignore cookie write errors in edge cases
    }
    redirect(user.status === "DISABLED" ? "/account-disabled" : "/account-pending");
  }

  if (!user.emailVerifiedAt) {
    try {
      await lucia.invalidateSession(session.id);
      const sessionCookie = lucia.createBlankSessionCookie();
      cookies().set(sessionCookie.name, sessionCookie.value, sessionCookie.attributes);
    } catch {
      // ignore cookie write errors in edge cases
    }
    redirect("/account-pending");
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
