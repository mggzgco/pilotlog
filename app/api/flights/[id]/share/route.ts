import { NextResponse } from "next/server";
import { prisma } from "@/app/lib/db";
import { requireUser } from "@/app/lib/auth/session";
import { getAppUrlFromEnv, isXConfigured } from "@/app/lib/integrations/x";
import { buildFlightShareText, getOrCreateFlightShareToken } from "@/app/lib/sharing/flight-share";

export async function GET(_request: Request, { params }: { params: { id: string } }) {
  const user = await requireUser();

  const flight = await prisma.flight.findFirst({
    where: { id: params.id, userId: user.id },
    select: {
      id: true,
      tailNumber: true,
      tailNumberSnapshot: true,
      origin: true,
      destination: true,
      startTime: true,
      endTime: true,
      durationMinutes: true,
      distanceNm: true,
      trackPoints: { select: { altitudeFeet: true, groundspeedKt: true } }
    }
  });

  if (!flight) {
    return NextResponse.json({ error: "Not found." }, { status: 404 });
  }

  const token = await getOrCreateFlightShareToken({ userId: user.id, flightId: flight.id });
  const appUrl = getAppUrlFromEnv() || "https://app.flighttraks.com";
  const shareUrl = `${appUrl}/share/flight/${token}`;

  const maxAltitudeFt = (() => {
    const vals = flight.trackPoints
      .map((p) => p.altitudeFeet)
      .filter((n): n is number => typeof n === "number" && Number.isFinite(n));
    return vals.length ? Math.max(...vals) : null;
  })();
  const maxSpeedKt = (() => {
    const vals = flight.trackPoints
      .map((p) => p.groundspeedKt)
      .filter((n): n is number => typeof n === "number" && Number.isFinite(n));
    return vals.length ? Math.max(...vals) : null;
  })();

  const tail = (flight.tailNumberSnapshot ?? flight.tailNumber).trim();
  const routeLabel = `${flight.origin} → ${flight.destination ?? "TBD"}`;

  const text = buildFlightShareText({
    tailNumber: tail,
    routeLabel,
    durationMinutes: flight.durationMinutes ?? null,
    distanceNm: flight.distanceNm ?? null,
    maxAltitudeFt,
    maxSpeedKt,
    shareUrl
  });

  const composerUrl = `https://x.com/intent/post?text=${encodeURIComponent(text)}`;

  const xAccount = await prisma.xAccount.findFirst({
    where: { userId: user.id },
    select: { username: true }
  });

  return NextResponse.json({
    shareUrl,
    imageUrl: `${appUrl}/api/share/flight/${token}/card.png`,
    defaultText: text,
    composerUrl,
    x: {
      configured: isXConfigured(),
      connected: Boolean(xAccount),
      username: xAccount?.username ?? null,
      connectUrl: "/api/integrations/x/start"
    }
  });
}

