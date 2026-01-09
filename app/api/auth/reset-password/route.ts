import { NextRequest, NextResponse } from "next/server";
import { resetPasswordSchema } from "@/app/lib/validation";
import { resetPassword } from "@/app/lib/auth/password-reset";

export async function POST(request: NextRequest) {
  const payload = await request.json().catch(() => null);
  const parsed = resetPasswordSchema.safeParse(payload);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid reset data." }, { status: 400 });
  }

  const result = await resetPassword({
    token: parsed.data.token,
    password: parsed.data.password
  });

  if (result.error) {
    return NextResponse.json({ error: result.error }, { status: 400 });
  }

  return NextResponse.json({ success: result.success });
}
