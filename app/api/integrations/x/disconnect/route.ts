import { NextResponse } from "next/server";
import { prisma } from "@/app/lib/db";
import { requireUser } from "@/app/lib/auth/session";
import { validateRequestCsrf } from "@/app/lib/auth/csrf";
import { buildRedirectUrl } from "@/app/lib/http";

export async function POST(request: Request) {
  const csrf = validateRequestCsrf(request);
  const redirectWithToast = (message: string, toastType: "success" | "error") => {
    const url = buildRedirectUrl(request, "/profile");
    url.searchParams.set("toast", message);
    url.searchParams.set("toastType", toastType);
    return NextResponse.redirect(url, { status: 303 });
  };

  if (!csrf.ok) {
    return redirectWithToast(csrf.error ?? "CSRF validation failed.", "error");
  }

  const user = await requireUser();
  await prisma.xAccount.deleteMany({ where: { userId: user.id } });
  return redirectWithToast("X account disconnected.", "success");
}

