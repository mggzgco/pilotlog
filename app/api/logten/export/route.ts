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
      // NOTE: we don't currently store Aircraft Type; leave blank for LogTen import
      origin: true,
      destination: true,
      timeOut: true,
      timeIn: true,
      hobbsOut: true,
      hobbsIn: true,
      totalTime: true,
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
    "Aircraft ID",
    "Aircraft Type",
    "From",
    "Route",
    "To",
    "Hobbs Out",
    "Hobbs In",
    "Out",
    "In",
    "Total Time",
    "Night",
    "PIC",
    "Dual Rcvd",
    "Solo",
    "XC",
    "Sim Inst",
    "Actual Inst",
    "Simulator",
    "Ground",
    "PIC/P1 Crew",
    "Student",
    "Instructor",
    "Day T/O",
    "Day Ldg",
    "Night T/O",
    "Night Ldg",
    "Approach 1",
    "Approach 2",
    "Holds",
    "Remarks",
    "Flight Review"
  ];

  const hhmm = (value: string | null) => (value ? value.replace(":", "") : "");

  const rows = entries.map((e) => ({
    Date: e.date.toISOString().slice(0, 10),
    "Aircraft ID": e.tailNumberSnapshot ?? "",
    "Aircraft Type": "",
    From: e.origin ?? "",
    Route: "",
    To: e.destination ?? "",
    "Hobbs Out": e.hobbsOut ? String(e.hobbsOut) : "",
    "Hobbs In": e.hobbsIn ? String(e.hobbsIn) : "",
    Out: hhmm(e.timeOut ?? null),
    In: hhmm(e.timeIn ?? null),
    "Total Time": e.totalTime ? String(e.totalTime) : "",
    PIC: e.picTime ? String(e.picTime) : "",
    SIC: e.sicTime ? String(e.sicTime) : "",
    "Dual Rcvd": e.dualReceivedTime ? String(e.dualReceivedTime) : "",
    Solo: e.soloTime ? String(e.soloTime) : "",
    Night: e.nightTime ? String(e.nightTime) : "",
    XC: e.xcTime ? String(e.xcTime) : "",
    "Sim Inst": e.simulatedInstrumentTime ? String(e.simulatedInstrumentTime) : "",
    "Actual Inst": e.instrumentTime ? String(e.instrumentTime) : "",
    Simulator: e.simulatorTime ? String(e.simulatorTime) : "",
    Ground: e.groundTime ? String(e.groundTime) : "",
    "Day T/O": e.dayTakeoffs !== null && e.dayTakeoffs !== undefined ? String(e.dayTakeoffs) : "",
    "Day Ldg": e.dayLandings !== null && e.dayLandings !== undefined ? String(e.dayLandings) : "",
    "Night T/O":
      e.nightTakeoffs !== null && e.nightTakeoffs !== undefined ? String(e.nightTakeoffs) : "",
    "Night Ldg":
      e.nightLandings !== null && e.nightLandings !== undefined ? String(e.nightLandings) : "",
    "PIC/P1 Crew": "",
    Student: "",
    Instructor: "",
    "Approach 1": "",
    "Approach 2": "",
    Holds: "",
    Remarks: e.remarks ?? "",
    "Flight Review": ""
  }));

  // LogTen "Export Flights (Tab)" is typically tab-delimited; emit TSV for best compatibility.
  const tsv = toCsv(headers, rows, "\t");
  return new NextResponse(tsv, {
    headers: {
      "content-type": "text/tab-separated-values; charset=utf-8",
      "content-disposition": `attachment; filename="pilotlog-logten-export.tsv"`
    }
  });
}

