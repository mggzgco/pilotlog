import { NextResponse } from "next/server";
import { prisma } from "@/app/lib/db";
import { getCurrentUser } from "@/app/lib/auth/session";
import { validateRequestCsrf } from "@/app/lib/auth/csrf";
import { buildRedirectUrl } from "@/app/lib/http";

export async function POST(
  request: Request,
  { params }: { params: { id: string } }
) {
  const redirectWithToast = (message: string, toastType: "success" | "error") => {
    const redirectUrl = buildRedirectUrl(request, "/costs");
    redirectUrl.searchParams.set("toast", message);
    redirectUrl.searchParams.set("toastType", toastType);
    return NextResponse.redirect(redirectUrl, { status: 303 });
  };

  const csrf = validateRequestCsrf(request);
  if (!csrf.ok) {
    return redirectWithToast(csrf.error ?? "CSRF validation failed.", "error");
  }

  const { user, session } = await getCurrentUser();
  if (!user || !session || user.status !== "ACTIVE") {
    return redirectWithToast("Unauthorized.", "error");
  }

  const cost = await prisma.costItem.findFirst({
    where: { id: params.id, userId: user.id },
    select: { id: true }
  });
  if (!cost) {
    return redirectWithToast("Expense not found.", "error");
  }

  await prisma.costItem.delete({ where: { id: cost.id } });
  return redirectWithToast("Expense deleted.", "success");
}

