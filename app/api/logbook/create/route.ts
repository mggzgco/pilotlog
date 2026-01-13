import { NextResponse } from "next/server";
import { prisma } from "@/app/lib/db";
import { getCurrentUser } from "@/app/lib/auth/session";
import { validateRequestCsrf } from "@/app/lib/auth/csrf";
import { logbookSchema } from "@/app/lib/validation";
import { Prisma } from "@prisma/client";
import { buildRedirectUrl } from "@/app/lib/http";
import { normalizeTimeOfDay } from "@/app/lib/time";

export async function POST(request: Request) {
  const redirectWithToast = (message: string, toastType: "success" | "error") => {
    const redirectUrl = buildRedirectUrl(request, "/logbook");
    redirectUrl.searchParams.set("toast", message);
    redirectUrl.searchParams.set("toastType", toastType);
    // 303 forces a GET, avoiding browser quirks around POST-redirect behavior
    return NextResponse.redirect(redirectUrl, { status: 303 });
  };

  try {
    const csrf = validateRequestCsrf(request);
  if (!csrf.ok) {
    return redirectWithToast(csrf.error ?? "CSRF validation failed.", "error");
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
    const status = (parsed.data.status === "CLOSED" ? "CLOSED" : "OPEN") as "OPEN" | "CLOSED";
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

    const data = {
      userId: user.id,
      flightId: linkedFlightId,
      date: new Date(parsed.data.date),
      status: status as any,
      tailNumberSnapshot: flight?.tailNumberSnapshot ?? flight?.tailNumber ?? null,
      origin: flight?.origin ?? null,
      destination: flight?.destination ?? null,
      timeOut: normalizeTimeOfDay(parsed.data.timeOut?.trim() || "") || null,
      timeIn: normalizeTimeOfDay(parsed.data.timeIn?.trim() || "") || null,
      hobbsOut: toNumberOrNull(parsed.data.hobbsOut),
      hobbsIn: toNumberOrNull(parsed.data.hobbsIn),
      totalTime: (() => {
        const explicit = toNumberOrNull(parsed.data.totalTime);
        if (explicit !== null) return explicit;
        const hobbsOut = toNumberOrNull(parsed.data.hobbsOut);
        const hobbsIn = toNumberOrNull(parsed.data.hobbsIn);
        if (hobbsOut !== null && hobbsIn !== null) {
          const diff = hobbsIn - hobbsOut;
          if (Number.isFinite(diff) && diff >= 0) {
            return Math.round(diff * 10) / 10;
          }
        }
        return null;
      })(),
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
    let savedStatus: "OPEN" | "CLOSED" = status;
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
      savedStatus = updated.status;
    } else if (linkedFlightId) {
      const existingEntry = await prisma.logbookEntry.findFirst({
        where: { userId: user.id, flightId: linkedFlightId }
      });
      if (existingEntry) {
        const updated = await prisma.logbookEntry.update({ where: { id: existingEntry.id }, data });
        savedId = updated.id;
        savedStatus = updated.status;
      } else {
        const created = await prisma.logbookEntry.create({ data });
        savedId = created.id;
        savedStatus = created.status;
      }
    } else {
      const created = await prisma.logbookEntry.create({ data });
      savedId = created.id;
      savedStatus = created.status;
    }

    // If a logbook entry tied to a flight is closed, mark the flight completed.
    if (linkedFlightId && savedStatus === "CLOSED") {
      await prisma.flight.update({
        where: { id: linkedFlightId },
        data: { status: "COMPLETED" }
      });
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

