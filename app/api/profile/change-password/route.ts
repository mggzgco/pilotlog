import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { lucia } from "@/app/lib/auth/lucia";
import { validateRequestCsrf } from "@/app/lib/auth/csrf";
import { getCurrentUser } from "@/app/lib/auth/session";
import { prisma } from "@/app/lib/db";
import { hashPassword, verifyPassword } from "@/app/lib/password";
import { changePasswordSchema } from "@/app/lib/validation";
import { recordAuditEvent } from "@/app/lib/audit";

export async function POST(request: Request) {
  const csrf = validateRequestCsrf(request);
  if (!csrf.ok) {
    return NextResponse.json({ error: csrf.error }, { status: 403 });
  }

  const { user, session } = await getCurrentUser();
  if (!user || !session || user.status !== "ACTIVE") {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }

  const formData = await request.formData();
  const raw = Object.fromEntries(formData.entries());
  const parsed = changePasswordSchema.safeParse(raw);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid password data." }, { status: 400 });
  }

  const account = await prisma.user.findUnique({
    where: { id: user.id },
    select: { passwordHash: true }
  });

  if (!account) {
    return NextResponse.json({ error: "User not found." }, { status: 404 });
  }

  const valid = await verifyPassword(account.passwordHash, parsed.data.currentPassword);
  if (!valid) {
    return NextResponse.json({ error: "Current password is incorrect." }, { status: 400 });
  }

  const passwordHash = await hashPassword(parsed.data.newPassword);
  await prisma.user.update({
    where: { id: user.id },
    data: { passwordHash }
  });

  await lucia.invalidateUserSessions(user.id);
  const sessionCookie = lucia.createBlankSessionCookie();
  cookies().set(sessionCookie.name, sessionCookie.value, sessionCookie.attributes);

  await recordAuditEvent({
    userId: user.id,
    action: "auth.password_changed",
    entityType: "User",
    entityId: user.id
  });

  return NextResponse.redirect(new URL("/login", request.url));
}
