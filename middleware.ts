import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

// AWS ALB terminates TLS and forwards requests to the app with x-forwarded-proto.
// In production, we want to:
// - redirect HTTP -> HTTPS for real users
// - allow ALB health checks over HTTP
//
// Toggle with FORCE_HTTPS=true in production once ACM is issued.
export function middleware(req: NextRequest) {
  const forceHttps = (process.env.FORCE_HTTPS ?? "").toLowerCase() === "true";
  if (!forceHttps) return NextResponse.next();

  const forwardedProto = req.headers.get("x-forwarded-proto");
  const isHttps = forwardedProto === "https" || req.nextUrl.protocol === "https:";

  // Always allow health checks without redirect loops.
  if (req.nextUrl.pathname === "/api/health") return NextResponse.next();

  if (!isHttps) {
    const url = req.nextUrl.clone();
    url.protocol = "https:";
    // nextUrl may not include the port in production; keep host as-is.
    return NextResponse.redirect(url, 308);
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    // Apply to all paths except Next.js internals.
    "/((?!_next/static|_next/image|favicon.ico).*)"
  ]
};

