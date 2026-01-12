import { NextResponse } from "next/server";

// ALB health checks should hit this endpoint.
// It must be:
// - unauthenticated
// - fast
// - non-redirecting
// - not dependent on DATABASE_URL (optional deep checks should be separate)
export async function GET() {
  return NextResponse.json(
    { ok: true },
    {
      status: 200,
      headers: {
        "Cache-Control": "no-store, max-age=0"
      }
    }
  );
}

