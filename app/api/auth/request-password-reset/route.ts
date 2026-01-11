import { NextRequest, NextResponse } from "next/server";
import { forgotPasswordSchema } from "@/app/lib/validation";
import { requestPasswordReset } from "@/app/lib/auth/password-reset";
import { handleApiError } from "@/src/lib/security/errors";

function getClientIp(request: NextRequest) {
  const forwarded = request.headers.get("x-forwarded-for");
  if (forwarded) {
    return forwarded.split(",")[0]?.trim() ?? "unknown";
  }
  return request.headers.get("x-real-ip") ?? "unknown";
}

export async function POST(request: NextRequest) {
  try {
    const payload = await request.json().catch(() => null);
    const parsed = forgotPasswordSchema.safeParse(payload);
    if (!parsed.success) {
      return NextResponse.json({ error: "Invalid email." }, { status: 400 });
    }

    const result = await requestPasswordReset({
      email: parsed.data.email,
      ipAddress: getClientIp(request)
    });

    if ("error" in result) {
      return NextResponse.json({ error: result.error }, { status: 429 });
    }

    return NextResponse.json({ success: result.success });
  } catch (error) {
    return handleApiError(error, "auth.password-reset.request");
  }
}
