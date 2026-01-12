import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/app/lib/db";
import { getCurrentUser } from "@/app/lib/auth/session";
import { validateRequestCsrf } from "@/app/lib/auth/csrf";
import { Prisma } from "@prisma/client";
import { buildRedirectUrl } from "@/app/lib/http";
import { normalizeTimeOfDay } from "@/app/lib/time";

const emptyToNull = (value: unknown) =>
  value === "" || value === undefined ? null : value;

const logbookSchema = z.object({
  date: z.coerce.date(),
  status: z.enum(["OPEN", "CLOSED"]).default("OPEN"),
  totalTime: z.preprocess(emptyToNull, z.number().min(0).nullable()),
  picTime: z.preprocess(emptyToNull, z.number().min(0).nullable()),
  sicTime: z.preprocess(emptyToNull, z.number().min(0).nullable()),
  dualReceivedTime: z.preprocess(emptyToNull, z.number().min(0).nullable()),
  soloTime: z.preprocess(emptyToNull, z.number().min(0).nullable()),
  nightTime: z.preprocess(emptyToNull, z.number().min(0).nullable()),
  xcTime: z.preprocess(emptyToNull, z.number().min(0).nullable()),
  simulatedInstrumentTime: z.preprocess(emptyToNull, z.number().min(0).nullable()),
  instrumentTime: z.preprocess(emptyToNull, z.number().min(0).nullable()),
  simulatorTime: z.preprocess(emptyToNull, z.number().min(0).nullable()),
  groundTime: z.preprocess(emptyToNull, z.number().min(0).nullable()),
  timeOut: z.preprocess((v) => {
    const value = emptyToNull(v);
    if (value === null) return null;
    const raw = String(value).trim();
    if (!raw) return null;
    return normalizeTimeOfDay(raw) ?? raw;
  }, z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/).max(5).nullable()),
  timeIn: z.preprocess((v) => {
    const value = emptyToNull(v);
    if (value === null) return null;
    const raw = String(value).trim();
    if (!raw) return null;
    return normalizeTimeOfDay(raw) ?? raw;
  }, z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/).max(5).nullable()),
  hobbsOut: z.preprocess(emptyToNull, z.number().min(0).nullable()),
  hobbsIn: z.preprocess(emptyToNull, z.number().min(0).nullable()),
  dayTakeoffs: z.preprocess(emptyToNull, z.number().int().min(0).nullable()),
  dayLandings: z.preprocess(emptyToNull, z.number().int().min(0).nullable()),
  nightTakeoffs: z.preprocess(emptyToNull, z.number().int().min(0).nullable()),
  nightLandings: z.preprocess(emptyToNull, z.number().int().min(0).nullable()),
  remarks: z.preprocess(emptyToNull, z.string().max(2000).nullable())
});

export async function POST(
  request: Request,
  { params }: { params: { id: string } }
) {
  const redirectWithToast = (message: string, toastType: "success" | "error") => {
    const redirectUrl = buildRedirectUrl(request, `/flights/${params.id}/logbook`);
    redirectUrl.searchParams.set("toast", message);
    redirectUrl.searchParams.set("toastType", toastType);
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

    const flight = await prisma.flight.findFirst({
      where: { id: params.id, userId: user.id },
      select: { id: true }
    });

    if (!flight) {
      return redirectWithToast("Not found.", "error");
    }

    const formData = await request.formData();
    const raw = Object.fromEntries(formData.entries());
    const participantId = formData.get("participantId");
    if (!participantId || typeof participantId !== "string") {
      return redirectWithToast("Participant selection is required.", "error");
    }
    const participant = await prisma.flightParticipant.findFirst({
      where: { id: participantId, flightId: flight.id }
    });
    if (!participant) {
      return redirectWithToast("Participant not found.", "error");
    }

    const toNumber = (value: FormDataEntryValue | undefined) =>
      value === "" || value === undefined ? undefined : Number(value);
    const parsed = logbookSchema.safeParse({
      ...raw,
      status: raw.status ?? "OPEN",
      totalTime: toNumber(raw.totalTime as FormDataEntryValue | undefined),
      picTime: toNumber(raw.picTime as FormDataEntryValue | undefined),
      sicTime: toNumber(raw.sicTime as FormDataEntryValue | undefined),
      dualReceivedTime: toNumber(raw.dualReceivedTime as FormDataEntryValue | undefined),
      soloTime: toNumber(raw.soloTime as FormDataEntryValue | undefined),
      nightTime: toNumber(raw.nightTime as FormDataEntryValue | undefined),
      xcTime: toNumber(raw.xcTime as FormDataEntryValue | undefined),
      simulatedInstrumentTime: toNumber(
        raw.simulatedInstrumentTime as FormDataEntryValue | undefined
      ),
      instrumentTime: toNumber(raw.instrumentTime as FormDataEntryValue | undefined),
      simulatorTime: toNumber(raw.simulatorTime as FormDataEntryValue | undefined),
      groundTime: toNumber(raw.groundTime as FormDataEntryValue | undefined),
      hobbsOut: toNumber(raw.hobbsOut as FormDataEntryValue | undefined),
      hobbsIn: toNumber(raw.hobbsIn as FormDataEntryValue | undefined),
      dayTakeoffs: toNumber(raw.dayTakeoffs as FormDataEntryValue | undefined),
      dayLandings: toNumber(raw.dayLandings as FormDataEntryValue | undefined),
      nightTakeoffs: toNumber(raw.nightTakeoffs as FormDataEntryValue | undefined),
      nightLandings: toNumber(raw.nightLandings as FormDataEntryValue | undefined),
      remarks: raw.remarks ?? undefined
    });

    if (!parsed.success) {
      return redirectWithToast("Invalid logbook data.", "error");
    }

    const existingEntry = await prisma.logbookEntry.findFirst({
      where: { flightId: flight.id, userId: participant.userId }
    });

    const data = {
      date: parsed.data.date,
      status: parsed.data.status,
      totalTime: parsed.data.totalTime,
      picTime: parsed.data.picTime,
      sicTime: parsed.data.sicTime,
      dualReceivedTime: parsed.data.dualReceivedTime,
      soloTime: parsed.data.soloTime,
      nightTime: parsed.data.nightTime,
      xcTime: parsed.data.xcTime,
      simulatedInstrumentTime: parsed.data.simulatedInstrumentTime,
      instrumentTime: parsed.data.instrumentTime,
      simulatorTime: parsed.data.simulatorTime,
      groundTime: parsed.data.groundTime,
      timeOut: parsed.data.timeOut,
      timeIn: parsed.data.timeIn,
      hobbsOut: parsed.data.hobbsOut,
      hobbsIn: parsed.data.hobbsIn,
      dayTakeoffs: parsed.data.dayTakeoffs,
      dayLandings: parsed.data.dayLandings,
      nightTakeoffs: parsed.data.nightTakeoffs,
      nightLandings: parsed.data.nightLandings,
      remarks: parsed.data.remarks
    };

    const saved = existingEntry
      ? await prisma.logbookEntry.update({ where: { id: existingEntry.id }, data })
      : await prisma.logbookEntry.create({
          data: { ...data, userId: participant.userId, flightId: flight.id }
        });

    // If the logbook entry is closed, mark the flight completed.
    if (saved.status === "CLOSED") {
      await prisma.flight.update({
        where: { id: flight.id },
        data: { status: "COMPLETED" }
      });
    }

    const redirectUrl = new URL(`/flights/${flight.id}/logbook`, request.url);
    redirectUrl.searchParams.set("participantId", participant.id);
    redirectUrl.searchParams.set("toast", `Logbook updated. (${saved.id.slice(0, 6)})`);
    redirectUrl.searchParams.set("toastType", "success");
    return NextResponse.redirect(redirectUrl, { status: 303 });
  } catch (error) {
    console.error("flight.update-logbook failed", error);
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
      return "Failed to save logbook.";
    })();
    return redirectWithToast(message, "error");
  }
}
