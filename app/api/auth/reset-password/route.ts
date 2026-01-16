import { NextRequest, NextResponse } from "next/server";
import { resetPasswordSchema } from "@/app/lib/validation";
import { resetPassword } from "@/app/lib/auth/password-reset";
import { validateRequestCsrf } from "@/app/lib/auth/csrf";

export async function POST(request: NextRequest) {
  const csrf = validateRequestCsrf(request);
  if (!csrf.ok) {
    return NextResponse.json({ error: csrf.error ?? "CSRF validation failed." }, { status: 403 });
  }
  const payload = await request.json().catch(() => null);
  const parsed = resetPasswordSchema.safeParse(payload);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid reset data." }, { status: 400 });
  }

  const result = await resetPassword({
    token: parsed.data.token,
    password: parsed.data.password,
    ipAddress: request.headers.get("x-real-ip") ?? request.headers.get("x-forwarded-for") ?? undefined,
    userAgent: request.headers.get("user-agent") ?? undefined
  });

  if ("error" in result) {
    return NextResponse.json({ error: result.error }, { status: 400 });
  }

  return NextResponse.json({ success: result.success });
}
