import { NextResponse } from "next/server";
import { prisma } from "@/app/lib/db";
import { requireUser } from "@/app/lib/session";
import { computeReportSummary } from "@/app/lib/reports/compute";

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

  const [logbookEntries, costItems] = await Promise.all([
    prisma.logbookEntry.findMany({
      where: {
        userId: user.id,
        ...(dateFilter ? { date: dateFilter } : {})
      },
      include: {
        flight: {
          select: {
            durationMinutes: true,
            originAirport: { select: { latitude: true, longitude: true } },
            destinationAirport: { select: { latitude: true, longitude: true } },
            stops: { select: { airport: { select: { latitude: true, longitude: true } } } }
          }
        }
      }
    }),
    prisma.costItem.findMany({
      where: {
        userId: user.id,
        ...(dateFilter ? { date: dateFilter } : {})
      }
    })
  ]);

  const summary = computeReportSummary(logbookEntries, costItems);

  return NextResponse.json({ summary });
}
