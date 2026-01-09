"use server";

import { redirect } from "next/navigation";
import { prisma } from "@/app/lib/db";
import { requireUser } from "@/app/lib/session";
import { flightSchema } from "@/app/lib/validation";

export async function createFlightAction(formData: FormData) {
  const raw = Object.fromEntries(formData.entries());
  const parsed = flightSchema.safeParse({
    ...raw,
    durationMinutes: raw.durationMinutes ? Number(raw.durationMinutes) : undefined
  });

  if (!parsed.success) {
    return { error: "Invalid flight details." };
  }

  const user = await requireUser();
  const { tailNumber, origin, destination, startTime, endTime, durationMinutes } =
    parsed.data;

  // FLIGHT-001: create a flight record with basic metadata
  await prisma.flight.create({
    data: {
      userId: user.id,
      tailNumber,
      origin,
      destination,
      startTime: new Date(startTime),
      endTime: endTime ? new Date(endTime) : null,
      durationMinutes: durationMinutes ?? null
    }
  });

  redirect(
    `/flights?toast=${encodeURIComponent("Flight saved.")}&toastType=success`
  );
}
