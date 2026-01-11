import { NextResponse } from "next/server";
import { prisma } from "@/app/lib/db";
import { getCurrentUser } from "@/app/lib/auth/session";
import { parseCsv } from "@/app/lib/logten/csv";
import { guessLogTenMapping } from "@/app/lib/logten/mapping";
import { normalizeLogTenRows, fingerprintForLogbookLikeEntry } from "@/app/lib/logten/sync";

export const runtime = "nodejs";

function jsonError(message: string, status = 400) {
  return NextResponse.json({ error: message }, { status });
}

export async function POST(request: Request) {
  const { user, session } = await getCurrentUser();
  if (!user || !session || user.status !== "ACTIVE") {
    return jsonError("Unauthorized.", 401);
  }

  const formData = await request.formData();
  const file = formData.get("file");
  if (!(file instanceof File)) {
    return jsonError("Missing file.");
  }
  const text = await file.text();
  const parsed = parseCsv(text);
  const mapping = guessLogTenMapping(parsed.headers);
  if (!mapping) {
    return jsonError(
      `Could not auto-detect LogTen columns. Found headers: ${parsed.headers.join(", ")}`
    );
  }

  const logtenRows = normalizeLogTenRows(parsed.rows, mapping);
  if (logtenRows.length === 0) {
    return NextResponse.json({
      ok: true,
      mapping,
      stats: { logtenCount: 0, pilotlogCount: 0, missingInPilotlog: 0, missingInLogten: 0 },
      missingInPilotlog: [],
      missingInLogten: []
    });
  }

  const logtenByFingerprint = new Map<string, (typeof logtenRows)[number]>();
  for (const row of logtenRows) {
    logtenByFingerprint.set(row.fingerprint, row);
  }

  // Load FlightTraks entries in a broad date window (LogTen exports can include mixed ranges)
  const pilotlogEntries = await prisma.logbookEntry.findMany({
    where: { userId: user.id },
    select: {
      id: true,
      date: true,
      tailNumberSnapshot: true,
      origin: true,
      destination: true,
      timeOut: true,
      timeIn: true,
      hobbsOut: true,
      hobbsIn: true,
      totalTime: true,
      externalSource: true,
      externalId: true,
      externalFingerprint: true
    },
    orderBy: { date: "desc" }
  });

  const pilotlogFingerprints = new Set<string>();
  const pilotlogByFingerprint = new Map<string, (typeof pilotlogEntries)[number]>();
  for (const entry of pilotlogEntries) {
    const date = entry.date.toISOString().slice(0, 10);
    const tail = entry.tailNumberSnapshot ?? "";
    const origin = entry.origin ?? "";
    const destination = entry.destination ?? "";
    const timeOut = entry.timeOut ?? null;
    const timeIn = entry.timeIn ?? null;
    const hobbsOut = entry.hobbsOut ? Number(entry.hobbsOut) : null;
    const hobbsIn = entry.hobbsIn ? Number(entry.hobbsIn) : null;
    const totalTime = entry.totalTime ? Number(entry.totalTime) : null;
    const fp =
      entry.externalFingerprint ??
      fingerprintForLogbookLikeEntry({
        date,
        tailNumberSnapshot: tail,
        origin,
        destination,
        timeOut,
        timeIn,
        hobbsOut,
        hobbsIn,
        totalTime
      });
    pilotlogFingerprints.add(fp);
    pilotlogByFingerprint.set(fp, entry);
  }

  const missingInPilotlog = logtenRows.filter((row) => !pilotlogFingerprints.has(row.fingerprint));

  // "Missing in LogTen" means FlightTraks entries that are not represented in the uploaded LogTen export.
  // We only consider entries with enough fields to generate a stable fingerprint (tail+origin).
  const logtenFingerprints = new Set(logtenRows.map((r) => r.fingerprint));
  const missingInLogten = pilotlogEntries
    .map((entry) => {
      const date = entry.date.toISOString().slice(0, 10);
      const tail = entry.tailNumberSnapshot ?? "";
      const origin = entry.origin ?? "";
      const destination = entry.destination ?? "";
      if (!tail || !origin) return null;
      const timeOut = entry.timeOut ?? null;
      const timeIn = entry.timeIn ?? null;
      const hobbsOut = entry.hobbsOut ? Number(entry.hobbsOut) : null;
      const hobbsIn = entry.hobbsIn ? Number(entry.hobbsIn) : null;
      const totalTime = entry.totalTime ? Number(entry.totalTime) : null;
      const fp = fingerprintForLogbookLikeEntry({
        date,
        tailNumberSnapshot: tail,
        origin,
        destination,
        timeOut,
        timeIn,
        hobbsOut,
        hobbsIn,
        totalTime
      });
      return logtenFingerprints.has(fp)
        ? null
        : {
            id: entry.id,
            date,
            tailNumberSnapshot: tail,
            origin,
            destination,
            timeOut,
            timeIn,
            hobbsOut,
            hobbsIn,
            totalTime,
            fingerprint: fp
          };
    })
    .filter(Boolean) as Array<{
    id: string;
    date: string;
    tailNumberSnapshot: string;
    origin: string;
    destination: string | null;
    timeOut: string | null;
    timeIn: string | null;
    hobbsOut: number | null;
    hobbsIn: number | null;
    totalTime: number | null;
    fingerprint: string;
  }>;

  return NextResponse.json({
    ok: true,
    mapping,
    stats: {
      logtenCount: logtenRows.length,
      pilotlogCount: pilotlogEntries.length,
      missingInPilotlog: missingInPilotlog.length,
      missingInLogten: missingInLogten.length
    },
    missingInPilotlog,
    missingInLogten
  });
}

