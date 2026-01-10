import { NextResponse } from "next/server";
import { prisma } from "@/app/lib/db";
import { getCurrentUser } from "@/app/lib/auth/session";
import { validateRequestCsrf } from "@/app/lib/auth/csrf";
import { logbookSchema } from "@/app/lib/validation";
import { computeTotalTimeHours } from "@/app/lib/logbook/compute";

export async function POST(request: Request) {
  const redirectWithToast = (message: string, toastType: "success" | "error") => {
    const redirectUrl = new URL("/logbook", request.url);
    redirectUrl.searchParams.set("toast", message);
    redirectUrl.searchParams.set("toastType", toastType);
    return NextResponse.redirect(redirectUrl);
  };

  const csrf = validateRequestCsrf(request);
  if (!csrf.ok) {
    return redirectWithToast(csrf.error, "error");
  }

  const { user, session } = await getCurrentUser();
  if (!user || !session || user.status !== "ACTIVE") {
    return redirectWithToast("Unauthorized.", "error");
  }

  const formData = await request.formData();
  const raw = Object.fromEntries(formData.entries());
  const parsed = logbookSchema.safeParse(raw);
  if (!parsed.success) {
    return redirectWithToast("Invalid logbook data.", "error");
  }

  const flightId = parsed.data.flightId?.trim() || "";
  const flight = flightId
    ? await prisma.flight.findFirst({
        where: { id: flightId, userId: user.id },
        select: { id: true, tailNumberSnapshot: true, tailNumber: true, origin: true, destination: true }
      })
    : null;
  if (flightId && !flight) {
    return redirectWithToast("Flight not found.", "error");
  }
  const linkedFlightId = flight?.id ?? null;

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

  const data = {
    userId: user.id,
    flightId: linkedFlightId,
    date: new Date(parsed.data.date),
    tailNumberSnapshot:
      flight?.tailNumberSnapshot ?? flight?.tailNumber ?? null,
    origin: flight?.origin ?? null,
    destination: flight?.destination ?? null,
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
    remarks: parsed.data.remarks?.trim() || null
  };

  if (linkedFlightId) {
    const existingEntry = await prisma.logbookEntry.findFirst({
      where: { userId: user.id, flightId: linkedFlightId }
    });
    if (existingEntry) {
      await prisma.logbookEntry.update({ where: { id: existingEntry.id }, data });
    } else {
      await prisma.logbookEntry.create({ data });
    }
  } else {
    await prisma.logbookEntry.create({ data });
  }

  return redirectWithToast("Logbook entry saved.", "success");
}

