import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/app/lib/db";
import { requireUser } from "@/app/lib/session";
import { computeTotalTimeHours } from "@/app/lib/logbook/compute";

const emptyToNull = (value: unknown) =>
  value === "" || value === undefined ? null : value;

const logbookSchema = z.object({
  date: z.coerce.date(),
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
  timeOut: z.preprocess(emptyToNull, z.string().max(5).nullable()),
  timeIn: z.preprocess(emptyToNull, z.string().max(5).nullable()),
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
  const user = await requireUser();
  const flight = await prisma.flight.findFirst({
    where: { id: params.id, userId: user.id },
    select: { id: true }
  });

  if (!flight) {
    return NextResponse.json({ error: "Not found." }, { status: 404 });
  }

  const formData = await request.formData();
  const raw = Object.fromEntries(formData.entries());
  const participantId = formData.get("participantId");
  if (!participantId || typeof participantId !== "string") {
    return NextResponse.json(
      { error: "Participant selection is required." },
      { status: 400 }
    );
  }
  const participant = await prisma.flightParticipant.findFirst({
    where: { id: participantId, flightId: flight.id }
  });
  if (!participant) {
    return NextResponse.json({ error: "Participant not found." }, { status: 404 });
  }
  const toNumber = (value: FormDataEntryValue | undefined) =>
    value === "" || value === undefined ? undefined : Number(value);
  const parsed = logbookSchema.safeParse({
    ...raw,
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
    return NextResponse.json({ error: "Invalid logbook data." }, { status: 400 });
  }

  const existingEntry = await prisma.logbookEntry.findFirst({
    where: { flightId: flight.id, userId: participant.userId }
  });

  const data = {
    date: parsed.data.date,
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
    totalTime: computeTotalTimeHours({
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
    }),
    remarks: parsed.data.remarks
  };
  if (data.totalTime !== null) {
    if (participant.role === "PIC" && data.picTime === null) {
      data.picTime = data.totalTime;
    }
    if (participant.role === "SIC" && data.sicTime === null) {
      data.sicTime = data.totalTime;
    }
  }

  if (existingEntry) {
    await prisma.logbookEntry.update({
      where: { id: existingEntry.id },
      data
    });
  } else {
    await prisma.logbookEntry.create({
      data: {
        ...data,
        userId: participant.userId,
        flightId: flight.id
      }
    });
  }

  const redirectUrl = new URL(`/flights/${flight.id}`, request.url);
  redirectUrl.searchParams.set("participantId", participant.id);
  redirectUrl.searchParams.set("toast", "Logbook updated.");
  redirectUrl.searchParams.set("toastType", "success");
  return NextResponse.redirect(redirectUrl);
}
