"use server";

import { redirect } from "next/navigation";
import { prisma } from "@/app/lib/db";
import { requireUser } from "@/app/lib/session";
import { logbookSchema } from "@/app/lib/validation";
import { computeTotalTimeHours } from "@/app/lib/logbook/compute";

export async function createLogbookEntryAction(formData: FormData) {
  const raw = Object.fromEntries(formData.entries());
  const parsed = logbookSchema.safeParse(raw);
  if (!parsed.success) {
    return { error: "Invalid logbook data." };
  }

  const user = await requireUser();
  const flightId = parsed.data.flightId?.trim() || "";
  const flight = flightId
    ? await prisma.flight.findFirst({
        where: { id: flightId, userId: user.id },
        select: { id: true }
      })
    : null;
  if (flightId && !flight) {
    return { error: "Flight not found." };
  }
  const linkedFlightId = flight?.id ?? null;

  const computedTotalTime = computeTotalTimeHours({
    hobbsOut: parsed.data.hobbsOut,
    hobbsIn: parsed.data.hobbsIn,
    timeOut: parsed.data.timeOut,
    timeIn: parsed.data.timeIn,
    picTime: parsed.data.picTime,
    sicTime: parsed.data.sicTime,
    dualReceivedTime: parsed.data.dualReceivedTime,
    soloTime: parsed.data.soloTime,
    groundTime: parsed.data.groundTime,
    simulatorTime: parsed.data.simulatorTime
  });

  const toNumberOrNull = (value?: string) => {
    if (!value) return null;
    const numeric = Number(value);
    return Number.isFinite(numeric) ? numeric : null;
  };

  const toIntOrNull = (value?: string) => {
    if (!value) return null;
    const numeric = Number(value);
    return Number.isFinite(numeric) ? Math.trunc(numeric) : null;
  };

  const data = {
    userId: user.id,
    date: new Date(parsed.data.date),
    timeOut: parsed.data.timeOut?.trim() || null,
    timeIn: parsed.data.timeIn?.trim() || null,
    hobbsOut: toNumberOrNull(parsed.data.hobbsOut),
    hobbsIn: toNumberOrNull(parsed.data.hobbsIn),
    totalTime: computedTotalTime,
    picTime: toNumberOrNull(parsed.data.picTime),
    sicTime: toNumberOrNull(parsed.data.sicTime),
    dualReceivedTime: toNumberOrNull(parsed.data.dualReceivedTime),
    soloTime: toNumberOrNull(parsed.data.soloTime),
    nightTime: toNumberOrNull(parsed.data.nightTime),
    xcTime: toNumberOrNull(parsed.data.xcTime),
    simulatedInstrumentTime: toNumberOrNull(parsed.data.simulatedInstrumentTime),
    instrumentTime: toNumberOrNull(parsed.data.instrumentTime),
    simulatorTime: toNumberOrNull(parsed.data.simulatorTime),
    groundTime: toNumberOrNull(parsed.data.groundTime),
    dayTakeoffs: toIntOrNull(parsed.data.dayTakeoffs),
    dayLandings: toIntOrNull(parsed.data.dayLandings),
    nightTakeoffs: toIntOrNull(parsed.data.nightTakeoffs),
    nightLandings: toIntOrNull(parsed.data.nightLandings),
    remarks: parsed.data.remarks ?? null,
    flightId: linkedFlightId
  };

  if (linkedFlightId) {
    const existingEntry = await prisma.logbookEntry.findFirst({
      where: { userId: user.id, flightId: linkedFlightId }
    });

    if (existingEntry) {
      await prisma.logbookEntry.update({
        where: { id: existingEntry.id },
        data
      });
    } else {
      await prisma.logbookEntry.create({ data });
    }
  } else {
    await prisma.logbookEntry.create({ data });
  }

  // LOG-001: capture pilot logbook entries
  redirect("/logbook");
}
