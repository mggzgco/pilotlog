import { NextResponse } from "next/server";
import { getCurrentUser } from "@/app/lib/auth/session";
import { prisma } from "@/app/lib/db";

export async function GET(request: Request) {
  const { user, session } = await getCurrentUser();
  if (!user || !session || user.status !== "ACTIVE") {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }

  const url = new URL(request.url);
  const q = (url.searchParams.get("q") || "").trim().toUpperCase();
  if (q.length < 2) {
    return NextResponse.json({ airports: [] });
  }

  const airports = await prisma.airport.findMany({
    where: {
      OR: [{ icao: { startsWith: q } }, { iata: { startsWith: q } }, { name: { contains: q, mode: "insensitive" } }]
    },
    select: { id: true, icao: true, iata: true, name: true, city: true, region: true, country: true, timeZone: true },
    take: 20,
    orderBy: [{ icao: "asc" }]
  });

  return NextResponse.json({ airports });
}

