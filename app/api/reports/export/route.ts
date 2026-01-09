import { NextResponse } from "next/server";
import { prisma } from "@/app/lib/db";
import { requireUser } from "@/app/lib/session";
import { computeReportFlightRows } from "@/app/lib/reports/compute";

function parseDateRange(searchParams: URLSearchParams) {
  const start = searchParams.get("start");
  const end = searchParams.get("end");
  const startDate = start ? new Date(start) : null;
  const endDate = end ? new Date(`${end}T23:59:59.999Z`) : null;
  if (startDate && Number.isNaN(startDate.getTime())) {
    return { error: "Invalid start date." };
  }
  if (endDate && Number.isNaN(endDate.getTime())) {
    return { error: "Invalid end date." };
  }

  return { startDate, endDate };
}

function csvEscape(value: string | number | null) {
  if (value === null || value === undefined) {
    return "";
  }
  const raw = String(value);
  if (/[",\n]/.test(raw)) {
    return `"${raw.replace(/"/g, "\"\"")}"`;
  }
  return raw;
}

export async function GET(request: Request) {
  const user = await requireUser();
  const parsed = parseDateRange(new URL(request.url).searchParams);
  if ("error" in parsed) {
    return NextResponse.json({ error: parsed.error }, { status: 400 });
  }

  const dateFilter =
    parsed.startDate || parsed.endDate
      ? {
          ...(parsed.startDate ? { gte: parsed.startDate } : {}),
          ...(parsed.endDate ? { lte: parsed.endDate } : {})
        }
      : undefined;

  const flights = await prisma.flight.findMany({
    where: {
      userId: user.id,
      ...(dateFilter ? { startTime: dateFilter } : {})
    },
    orderBy: { startTime: "desc" },
    include: {
      logbookEntries: true,
      costItems: {
        where: dateFilter ? { date: dateFilter } : undefined
      }
    }
  });

  const categories = Array.from(
    new Set(
      flights.flatMap((flight) => flight.costItems.map((item) => item.category))
    )
  ).sort((a, b) => a.localeCompare(b));

  const rows = computeReportFlightRows(flights, categories);

  const headers = [
    "Date",
    "Tail Number",
    "Origin",
    "Destination",
    "Total Time (hrs)",
    "PIC Time (hrs)",
    "Dual Received (hrs)",
    "Night Time (hrs)",
    "XC Time (hrs)",
    "Distance (nm)",
    "Cost Total",
    ...categories.map((category) => `Cost ${category}`)
  ];

  const lines = [
    headers.map(csvEscape).join(","),
    ...rows.map((row) =>
      [
        row.date.toISOString().split("T")[0],
        row.tailNumber,
        row.origin,
        row.destination ?? "",
        row.totalTime.toFixed(1),
        row.picTime.toFixed(1),
        row.dualReceivedTime.toFixed(1),
        row.nightTime.toFixed(1),
        row.xcTime.toFixed(1),
        row.distanceNm ?? "",
        (row.costTotalCents / 100).toFixed(2),
        ...categories.map((category) =>
          ((row.costByCategory[category] ?? 0) / 100).toFixed(2)
        )
      ]
        .map(csvEscape)
        .join(",")
    )
  ];

  const csv = lines.join("\r\n");

  return new NextResponse(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": 'attachment; filename="reports.csv"'
    }
  });
}
