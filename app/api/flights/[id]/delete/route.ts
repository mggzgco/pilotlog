import { NextResponse } from "next/server";
import { prisma } from "@/app/lib/db";
import { validateRequestCsrf } from "@/app/lib/auth/csrf";
import { getCurrentUser } from "@/app/lib/auth/session";
import { recordAuditEvent } from "@/app/lib/audit";

export async function POST(
  request: Request,
  { params }: { params: { id: string } }
) {
  const csrf = validateRequestCsrf(request);
  if (!csrf.ok) {
    return NextResponse.json({ error: csrf.error ?? "CSRF validation failed." }, { status: 403 });
  }

  const { user, session } = await getCurrentUser();
  if (!user || !session || user.status !== "ACTIVE") {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }

  const flight = await prisma.flight.findFirst({
    where: { id: params.id, userId: user.id },
    select: {
      id: true,
      tailNumber: true,
      tailNumberSnapshot: true,
      origin: true,
      destination: true,
      startTime: true
    }
  });
  if (!flight) {
    return NextResponse.json({ error: "Not found." }, { status: 404 });
  }

  await prisma.flight.delete({ where: { id: flight.id } });

  await recordAuditEvent({
    userId: user.id,
    action: "flight.deleted",
    entityType: "Flight",
    entityId: flight.id,
    metadata: {
      tailNumber: flight.tailNumberSnapshot ?? flight.tailNumber,
      origin: flight.origin,
      destination: flight.destination ?? null,
      startTime: flight.startTime.toISOString()
    }
  });

  const accept = request.headers.get("accept") ?? "";
  const wantsJson = accept.includes("application/json");
  if (wantsJson) {
    return NextResponse.json({ ok: true });
  }

  const redirectUrl = new URL("/flights", request.url);
  redirectUrl.searchParams.set("toast", "Flight deleted.");
  redirectUrl.searchParams.set("toastType", "success");
  return NextResponse.redirect(redirectUrl, { status: 303 });
}

