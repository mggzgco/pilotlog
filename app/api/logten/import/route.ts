import { NextResponse } from "next/server";
import { prisma } from "@/app/lib/db";
import { getCurrentUser } from "@/app/lib/auth/session";
import type { LogTenRowNormalized } from "@/app/lib/logten/sync";
import { computeTotalTimeHours } from "@/app/lib/logbook/compute";

export const runtime = "nodejs";

function jsonError(message: string, status = 400) {
  return NextResponse.json({ error: message }, { status });
}

export async function POST(request: Request) {
  const { user, session } = await getCurrentUser();
  if (!user || !session || user.status !== "ACTIVE") {
    return jsonError("Unauthorized.", 401);
  }

  const body = await request.json().catch(() => null);
  if (!body || !Array.isArray(body.rows)) {
    return jsonError("Invalid payload. Expected { rows: [...] }.");
  }

  const rows = body.rows as LogTenRowNormalized[];
  if (rows.length === 0) {
    return NextResponse.json({ ok: true, imported: 0, skipped: 0 });
  }

  let imported = 0;
  let skipped = 0;

  for (const row of rows) {
    const externalId = row.externalId ?? row.fingerprint;
    const existing = await prisma.logbookEntry.findFirst({
      where: {
        userId: user.id,
        OR: [
          { externalSource: "LOGTEN", externalId },
          { externalSource: "LOGTEN", externalFingerprint: row.fingerprint }
        ]
      },
      select: { id: true }
    });
    if (existing) {
      skipped++;
      continue;
    }

    const totalTime = computeTotalTimeHours({
      hobbsOut: row.hobbsOut,
      hobbsIn: row.hobbsIn,
      timeOut: row.timeOut,
      timeIn: row.timeIn,
      picTime: row.picTime,
      sicTime: row.sicTime,
      dualReceivedTime: row.dualReceivedTime,
      soloTime: row.soloTime,
      nightTime: row.nightTime,
      xcTime: row.xcTime,
      simulatedInstrumentTime: row.simulatedInstrumentTime,
      instrumentTime: row.instrumentTime,
      groundTime: row.groundTime,
      simulatorTime: row.simulatorTime
    });
    const resolvedTotalTime = row.totalTime ?? totalTime;

    const date = new Date(row.date);
    if (Number.isNaN(date.getTime())) {
      skipped++;
      continue;
    }

    await prisma.logbookEntry.create({
      data: {
        userId: user.id,
        flightId: null,
        date,
        status: "OPEN",
        tailNumberSnapshot: row.tailNumberSnapshot,
        origin: row.origin,
        destination: row.destination || null,
        timeOut: row.timeOut,
        timeIn: row.timeIn,
        hobbsOut: row.hobbsOut,
        hobbsIn: row.hobbsIn,
        totalTime: resolvedTotalTime,
        picTime: row.picTime,
        sicTime: row.sicTime,
        dualReceivedTime: row.dualReceivedTime,
        soloTime: row.soloTime,
        nightTime: row.nightTime,
        xcTime: row.xcTime,
        simulatedInstrumentTime: row.simulatedInstrumentTime,
        instrumentTime: row.instrumentTime,
        simulatorTime: row.simulatorTime,
        groundTime: row.groundTime,
        dayTakeoffs: row.dayTakeoffs,
        dayLandings: row.dayLandings,
        nightTakeoffs: row.nightTakeoffs,
        nightLandings: row.nightLandings,
        remarks: row.remarks,
        externalSource: "LOGTEN",
        externalId,
        externalFingerprint: row.fingerprint,
        externalUpdatedAt: row.externalUpdatedAt ? new Date(row.externalUpdatedAt) : null
      }
    });
    imported++;
  }

  return NextResponse.json({ ok: true, imported, skipped });
}

