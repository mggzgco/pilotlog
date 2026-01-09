"use server";

import { redirect } from "next/navigation";
import { prisma } from "@/app/lib/db";
import { requireUser } from "@/app/lib/session";
import { flightSchema, importSchema } from "@/app/lib/validation";
import { importAdsbFlights } from "@/app/lib/adsb";

export async function createFlightAction(formData: FormData) {
  const raw = Object.fromEntries(formData.entries());
  const parsed = flightSchema.safeParse({
    ...raw,
    durationMins: raw.durationMins ? Number(raw.durationMins) : undefined
  });

  if (!parsed.success) {
    return { error: "Invalid flight details." };
  }

  const user = await requireUser();
  const { tailNumber, origin, destination, departAt, arriveAt, durationMins } =
    parsed.data;

  // FLIGHT-001: create a flight record with basic metadata
  await prisma.flight.create({
    data: {
      userId: user.id,
      tailNumber,
      origin,
      destination,
      departAt: new Date(departAt),
      arriveAt: arriveAt ? new Date(arriveAt) : null,
      durationMins: durationMins ?? null
    }
  });

  redirect("/flights");
}

export async function importFlightsAction(formData: FormData) {
  const raw = Object.fromEntries(formData.entries());
  const parsed = importSchema.safeParse(raw);
  if (!parsed.success) {
    return { error: "Invalid import request." };
  }

  const user = await requireUser();

  // IMPORT-001: import ADS-B flights by tail number and date/time window
  await importAdsbFlights(
    user.id,
    parsed.data.tailNumber,
    new Date(parsed.data.start),
    new Date(parsed.data.end)
  );

  redirect("/flights");
}
