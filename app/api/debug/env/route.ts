import { NextResponse } from "next/server";

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

  return NextResponse.json({
    ADSB_PROVIDER: process.env.ADSB_PROVIDER,
    AEROAPI_KEY_PRESENT: Boolean(process.env.AEROAPI_KEY),
    PRISMA_MIGRATE_ON_STARTUP: process.env.PRISMA_MIGRATE_ON_STARTUP,
    NEXT_RUNTIME: process.env.NEXT_RUNTIME,
    NODE_ENV: process.env.NODE_ENV,
    DATABASE: db
  });
}
