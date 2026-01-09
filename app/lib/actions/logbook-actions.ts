"use server";

import { redirect } from "next/navigation";
import { prisma } from "@/app/lib/db";
import { requireUser } from "@/app/lib/session";
import { logbookSchema, logbookWithFlightSchema } from "@/app/lib/validation";

export async function createLogbookEntryAction(formData: FormData) {
  const raw = Object.fromEntries(formData.entries());
  const parsed = logbookSchema.safeParse(raw);
  if (!parsed.success) {
    return { error: "Invalid logbook data." };
  }

  const user = await requireUser();

  await prisma.logbookEntry.create({
    data: {
      userId: user.id,
      date: new Date(parsed.data.date),
      totalTime: parsed.data.totalTime ? Number(parsed.data.totalTime) : null,
      picTime: parsed.data.picTime ? Number(parsed.data.picTime) : null,
      sicTime: parsed.data.sicTime ? Number(parsed.data.sicTime) : null,
      nightTime: parsed.data.nightTime ? Number(parsed.data.nightTime) : null,
      instrumentTime: parsed.data.instrumentTime
        ? Number(parsed.data.instrumentTime)
        : null,
      remarks: parsed.data.remarks ?? null
    }
  });

  // LOG-001: capture pilot logbook entries
  redirect("/logbook");
}

export async function createLogbookEntryForFlightAction(formData: FormData) {
  const raw = Object.fromEntries(formData.entries());
  const parsed = logbookWithFlightSchema.safeParse(raw);
  if (!parsed.success) {
    return { error: "Invalid logbook data." };
  }

  const user = await requireUser();

  await prisma.logbookEntry.create({
    data: {
      userId: user.id,
      flightId: parsed.data.flightId,
      date: new Date(parsed.data.date),
      totalTime: parsed.data.totalTime ? Number(parsed.data.totalTime) : null,
      picTime: parsed.data.picTime ? Number(parsed.data.picTime) : null,
      sicTime: parsed.data.sicTime ? Number(parsed.data.sicTime) : null,
      nightTime: parsed.data.nightTime ? Number(parsed.data.nightTime) : null,
      instrumentTime: parsed.data.instrumentTime
        ? Number(parsed.data.instrumentTime)
        : null,
      remarks: parsed.data.remarks ?? null
    }
  });

  // CHK-009: prompt logbook completion after ADS-B association
  redirect("/logbook");
}
