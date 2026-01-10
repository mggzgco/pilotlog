import { NextResponse } from "next/server";
import { prisma } from "@/app/lib/db";
import { getCurrentUser } from "@/app/lib/auth/session";
import { validateRequestCsrf } from "@/app/lib/auth/csrf";
import { logbookSchema } from "@/app/lib/validation";
import { computeTotalTimeHours } from "@/app/lib/logbook/compute";
import { Prisma } from "@prisma/client";

export async function POST(request: Request) {
  const redirectWithToast = (message: string, toastType: "success" | "error") => {
    const redirectUrl = new URL("/logbook", request.url);
    redirectUrl.searchParams.set("toast", message);
    redirectUrl.searchParams.set("toastType", toastType);
    // 303 forces a GET, avoiding browser quirks around POST-redirect behavior
    return NextResponse.redirect(redirectUrl, { status: 303 });
  };

  try {
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

    const entryId = parsed.data.id?.trim() || "";
    const flightId = parsed.data.flightId?.trim() || "";
    const flight = flightId
      ? await prisma.flight.findFirst({
          where: { id: flightId, userId: user.id },
          select: {
            id: true,
            tailNumberSnapshot: true,
            tailNumber: true,
            origin: true,
            destination: true
          }
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
      nightTime: parsed.data.nightTime,
      xcTime: parsed.data.xcTime,
      simulatedInstrumentTime: parsed.data.simulatedInstrumentTime,
      instrumentTime: parsed.data.instrumentTime,
      groundTime: parsed.data.groundTime,
      simulatorTime: parsed.data.simulatorTime
    });

    const data = {
      userId: user.id,
      flightId: linkedFlightId,
      date: new Date(parsed.data.date),
      tailNumberSnapshot: flight?.tailNumberSnapshot ?? flight?.tailNumber ?? null,
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

    let savedId: string | null = null;
    if (entryId) {
      const existingById = await prisma.logbookEntry.findFirst({
        where: { id: entryId, userId: user.id }
      });
      if (!existingById) {
        return redirectWithToast("Logbook entry not found.", "error");
      }
      if (linkedFlightId) {
        const otherEntryForFlight = await prisma.logbookEntry.findFirst({
          where: { userId: user.id, flightId: linkedFlightId, NOT: { id: entryId } },
          select: { id: true }
        });
        if (otherEntryForFlight) {
          return redirectWithToast(
            "That flight already has a different logbook entry. Unlink it first.",
            "error"
          );
        }
      }
      const updated = await prisma.logbookEntry.update({ where: { id: entryId }, data });
      savedId = updated.id;
    } else if (linkedFlightId) {
      const existingEntry = await prisma.logbookEntry.findFirst({
        where: { userId: user.id, flightId: linkedFlightId }
      });
      if (existingEntry) {
        const updated = await prisma.logbookEntry.update({ where: { id: existingEntry.id }, data });
        savedId = updated.id;
      } else {
        const created = await prisma.logbookEntry.create({ data });
        savedId = created.id;
      }
    } else {
      const created = await prisma.logbookEntry.create({ data });
      savedId = created.id;
    }

    return redirectWithToast(
      savedId ? `Logbook entry saved. (${savedId.slice(0, 6)})` : "Logbook entry saved.",
      "success"
    );
  } catch (error) {
    console.error("logbook.create failed", error);
    const message = (() => {
      if (error instanceof Prisma.PrismaClientKnownRequestError) {
        return `Database error (${error.code}). Did you run migrations?`;
      }
      if (error instanceof Prisma.PrismaClientValidationError) {
        return "Database schema mismatch. Did you run migrations?";
      }
      const text = error instanceof Error ? error.message : String(error);
      if (/column|does not exist|relation|table|migration/i.test(text)) {
        return "Database schema mismatch. Run migrations and restart.";
      }
      return "Failed to save logbook entry.";
    })();
    return redirectWithToast(message, "error");
  }
}

