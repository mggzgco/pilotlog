"use server";

import { redirect } from "next/navigation";
import { prisma } from "@/app/lib/db";
import { requireUser } from "@/app/lib/session";
import { logbookSchema } from "@/app/lib/validation";

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

  const data = {
    userId: user.id,
    date: new Date(parsed.data.date),
    totalTime: parsed.data.totalTime ? Number(parsed.data.totalTime) : null,
    picTime: parsed.data.picTime ? Number(parsed.data.picTime) : null,
    sicTime: parsed.data.sicTime ? Number(parsed.data.sicTime) : null,
    nightTime: parsed.data.nightTime ? Number(parsed.data.nightTime) : null,
    instrumentTime: parsed.data.instrumentTime
      ? Number(parsed.data.instrumentTime)
      : null,
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
