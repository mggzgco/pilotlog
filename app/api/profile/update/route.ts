import { NextResponse } from "next/server";
import { validateRequestCsrf } from "@/app/lib/auth/csrf";
import { getCurrentUser } from "@/app/lib/auth/session";
import { prisma } from "@/app/lib/db";
import { updateProfileSchema } from "@/app/lib/validation";
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
  const parsed = updateProfileSchema.safeParse(raw);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid profile data." }, { status: 400 });
  }

  const firstName = String(parsed.data.firstName ?? "").trim();
  const lastName = String(parsed.data.lastName ?? "").trim();
  const phone = String(parsed.data.phone ?? "").trim();
  const nameValue = [firstName, lastName].filter(Boolean).join(" ");

  await prisma.user.update({
    where: { id: user.id },
    data: {
      firstName: firstName || null,
      lastName: lastName || null,
      name: nameValue || null,
      phone: phone || null
    }
  });

  await recordAuditEvent({
    userId: user.id,
    action: "profile.updated",
    entityType: "User",
    entityId: user.id
  });

  return NextResponse.redirect(new URL("/profile", request.url));
}
