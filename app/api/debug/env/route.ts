import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";
export const revalidate = 0;

function resolveCookieSecureFlag() {
  const override = process.env.AUTH_COOKIE_SECURE?.trim();
  if (override) return override.toLowerCase() !== "false";
  return process.env.NODE_ENV === "production";
}

export async function GET() {
  const rawDbUrl = process.env.DATABASE_URL;
  let db: { host?: string; port?: string; database?: string } | null = null;
  try {
    if (rawDbUrl) {
      const url = new URL(rawDbUrl);
      db = {
        host: url.hostname,
        port: url.port || undefined,
        database: url.pathname?.replace(/^\//, "") || undefined
      };
    }
  } catch {
    db = null;
  }

  return NextResponse.json(
    {
    ADSB_PROVIDER: process.env.ADSB_PROVIDER,
    AEROAPI_KEY_PRESENT: Boolean(process.env.AEROAPI_KEY),
    PRISMA_MIGRATE_ON_STARTUP: process.env.PRISMA_MIGRATE_ON_STARTUP,
    NEXT_RUNTIME: process.env.NEXT_RUNTIME,
    NODE_ENV: process.env.NODE_ENV,
    AUTH_COOKIE_SECURE_ENV: process.env.AUTH_COOKIE_SECURE ?? null,
    AUTH_COOKIE_SECURE_EFFECTIVE: resolveCookieSecureFlag(),
    DATABASE_URL_PRESENT: Boolean(process.env.DATABASE_URL),
    DATABASE: db
    },
    {
      headers: {
        "Cache-Control": "no-store, max-age=0"
      }
    }
  );
}
