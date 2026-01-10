import { NextResponse } from "next/server";

export async function GET() {
  return NextResponse.json({
    ADSB_PROVIDER: process.env.ADSB_PROVIDER,
    AEROAPI_KEY_PRESENT: Boolean(process.env.AEROAPI_KEY),
  });
}
