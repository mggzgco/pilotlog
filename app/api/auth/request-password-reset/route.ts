import { NextRequest, NextResponse } from "next/server";
import { forgotPasswordSchema } from "@/app/lib/validation";
import { requestPasswordReset } from "@/app/lib/auth/password-reset";

function getClientIp(request: NextRequest) {
  const forwarded = request.headers.get("x-forwarded-for");
  if (forwarded) {
    return forwarded.split(",")[0]?.trim() ?? "unknown";
  }
  return request.headers.get("x-real-ip") ?? "unknown";
}

export async function POST(request: NextRequest) {
  const payload = await request.json().catch(() => null);
  const parsed = forgotPasswordSchema.safeParse(payload);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid email." }, { status: 400 });
  }

  const result = await requestPasswordReset({
    email: parsed.data.email,
    ipAddress: getClientIp(request)
  });

  if (result.error) {
    return NextResponse.json({ error: result.error }, { status: 429 });
  }

  return NextResponse.json({ success: result.success });
}
