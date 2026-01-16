import { NextRequest, NextResponse } from "next/server";
import { forgotPasswordSchema } from "@/app/lib/validation";
import { requestPasswordReset } from "@/app/lib/auth/password-reset";
import { handleApiError } from "@/src/lib/security/errors";
import { validateRequestCsrf } from "@/app/lib/auth/csrf";

function getClientIp(request: NextRequest) {
  const forwarded = request.headers.get("x-forwarded-for");
  if (forwarded) {
    return forwarded.split(",")[0]?.trim() ?? "unknown";
  }
  return request.headers.get("x-real-ip") ?? "unknown";
}

export async function POST(request: NextRequest) {
  try {
    const csrf = validateRequestCsrf(request);
    if (!csrf.ok) {
      return NextResponse.json({ error: csrf.error ?? "CSRF validation failed." }, { status: 403 });
    }
    const payload = await request.json().catch(() => null);
    const parsed = forgotPasswordSchema.safeParse(payload);
    if (!parsed.success) {
      return NextResponse.json({ error: "Invalid email." }, { status: 400 });
    }

    const result = await requestPasswordReset({
      email: parsed.data.email,
      ipAddress: getClientIp(request),
      userAgent: request.headers.get("user-agent") ?? undefined
    });

    if ("error" in result) {
      return NextResponse.json({ success: "If the email exists, a reset link will be sent." });
    }

    return NextResponse.json({ success: result.success });
  } catch (error) {
    return handleApiError(error, "auth.password-reset.request");
  }
}
