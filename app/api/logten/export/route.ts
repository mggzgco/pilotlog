import { NextResponse } from "next/server";
import { prisma } from "@/app/lib/db";
import { getCurrentUser } from "@/app/lib/auth/session";
import { toCsv } from "@/app/lib/logten/csv";

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
  if (!body || !Array.isArray(body.ids)) {
    return jsonError("Invalid payload. Expected { ids: [...] }.");
  }

  const ids = body.ids as string[];
  if (ids.length === 0) {
    return jsonError("No ids provided.");
  }

  const entries = await prisma.logbookEntry.findMany({
    where: { userId: user.id, id: { in: ids } },
    orderBy: { date: "asc" },
    select: {
      date: true,
      tailNumberSnapshot: true,
      origin: true,
      destination: true,
      timeOut: true,
      timeIn: true,
      hobbsOut: true,
      hobbsIn: true,
      picTime: true,
      sicTime: true,
      dualReceivedTime: true,
      soloTime: true,
      nightTime: true,
      xcTime: true,
      simulatedInstrumentTime: true,
      instrumentTime: true,
      simulatorTime: true,
      groundTime: true,
      dayTakeoffs: true,
      dayLandings: true,
      nightTakeoffs: true,
      nightLandings: true,
      remarks: true
    }
  });

  const headers = [
    "Date",
    "Aircraft",
    "From",
    "To",
    "Out",
    "In",
    "Hobbs Out",
    "Hobbs In",
    "PIC",
    "SIC",
    "Dual Received",
    "Solo",
    "Night",
    "XC",
    "Sim Inst",
    "Actual Inst",
    "Simulator",
    "Ground",
    "Day T/O",
    "Day LDG",
    "Night T/O",
    "Night LDG",
    "Remarks"
  ];

  const rows = entries.map((e) => ({
    Date: e.date.toISOString().slice(0, 10),
    Aircraft: e.tailNumberSnapshot ?? "",
    From: e.origin ?? "",
    To: e.destination ?? "",
    Out: e.timeOut ?? "",
    In: e.timeIn ?? "",
    "Hobbs Out": e.hobbsOut ? String(e.hobbsOut) : "",
    "Hobbs In": e.hobbsIn ? String(e.hobbsIn) : "",
    PIC: e.picTime ? String(e.picTime) : "",
    SIC: e.sicTime ? String(e.sicTime) : "",
    "Dual Received": e.dualReceivedTime ? String(e.dualReceivedTime) : "",
    Solo: e.soloTime ? String(e.soloTime) : "",
    Night: e.nightTime ? String(e.nightTime) : "",
    XC: e.xcTime ? String(e.xcTime) : "",
    "Sim Inst": e.simulatedInstrumentTime ? String(e.simulatedInstrumentTime) : "",
    "Actual Inst": e.instrumentTime ? String(e.instrumentTime) : "",
    Simulator: e.simulatorTime ? String(e.simulatorTime) : "",
    Ground: e.groundTime ? String(e.groundTime) : "",
    "Day T/O": e.dayTakeoffs !== null && e.dayTakeoffs !== undefined ? String(e.dayTakeoffs) : "",
    "Day LDG": e.dayLandings !== null && e.dayLandings !== undefined ? String(e.dayLandings) : "",
    "Night T/O":
      e.nightTakeoffs !== null && e.nightTakeoffs !== undefined ? String(e.nightTakeoffs) : "",
    "Night LDG":
      e.nightLandings !== null && e.nightLandings !== undefined ? String(e.nightLandings) : "",
    Remarks: e.remarks ?? ""
  }));

  const csv = toCsv(headers, rows, ",");
  return new NextResponse(csv, {
    headers: {
      "content-type": "text/csv; charset=utf-8",
      "content-disposition": `attachment; filename="pilotlog-logten-export.csv"`
    }
  });
}

