import { prisma } from "@/app/lib/db";

function normalizeCode(raw: string) {
  return raw.trim().toUpperCase();
}

export type AirportLookupResult = {
  id: string;
  icao: string;
  iata: string | null;
  name: string | null;
  timeZone: string;
};

export async function lookupAirportByCode(rawCode: string): Promise<AirportLookupResult | null> {
  const code = normalizeCode(rawCode);
  if (!code) return null;

  // Prefer ICAO if it looks like ICAO.
  if (code.length === 4) {
    const byIcao = await prisma.airport.findUnique({
      where: { icao: code },
      select: { id: true, icao: true, iata: true, name: true, timeZone: true }
    });
    if (byIcao) return byIcao;
  }

  // Fallback to IATA.
  if (code.length === 3) {
    const byIata = await prisma.airport.findFirst({
      where: { iata: code },
      select: { id: true, icao: true, iata: true, name: true, timeZone: true }
    });
    if (byIata) return byIata;
  }

  // Last-chance: try ICAO exact even if not 4 (some special/private codes).
  const byIcaoLoose = await prisma.airport.findFirst({
    where: { icao: code },
    select: { id: true, icao: true, iata: true, name: true, timeZone: true }
  });
  return byIcaoLoose ?? null;
}

