import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { lucia } from "@/app/lib/auth/lucia";
import { recordAuditEvent } from "@/app/lib/audit";
import { validateRequestCsrf } from "@/app/lib/auth/csrf";

export async function POST(request: Request) {
  const csrf = validateRequestCsrf(request);
  if (!csrf.ok) {
    return NextResponse.json({ error: csrf.error ?? "CSRF validation failed." }, { status: 403 });
  }

  const sessionId = cookies().get(lucia.sessionCookieName)?.value;
  const sessionInfo = sessionId ? await lucia.validateSession(sessionId) : null;
  if (sessionId) {
    await lucia.invalidateSession(sessionId);
  }
  const sessionCookie = lucia.createBlankSessionCookie();
  cookies().set(sessionCookie.name, sessionCookie.value, sessionCookie.attributes);

  await recordAuditEvent({
    userId: sessionInfo?.user?.id ?? null,
    action: "AUTH_LOGOUT",
    ipAddress: request.headers.get("x-real-ip") ?? request.headers.get("x-forwarded-for") ?? null,
    userAgent: request.headers.get("user-agent")
  });

  return NextResponse.json({ success: true });
}
