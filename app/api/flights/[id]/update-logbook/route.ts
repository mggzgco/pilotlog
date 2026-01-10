import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/app/lib/db";
import { requireUser } from "@/app/lib/session";

const emptyToNull = (value: unknown) =>
  value === "" || value === undefined ? null : value;

const logbookSchema = z.object({
  date: z.coerce.date(),
  totalTime: z.preprocess(emptyToNull, z.number().min(0).nullable()),
  picTime: z.preprocess(emptyToNull, z.number().min(0).nullable()),
  sicTime: z.preprocess(emptyToNull, z.number().min(0).nullable()),
  nightTime: z.preprocess(emptyToNull, z.number().min(0).nullable()),
  instrumentTime: z.preprocess(emptyToNull, z.number().min(0).nullable()),
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
    totalTime: toNumber(raw.totalTime as FormDataEntryValue | undefined),
    picTime: toNumber(raw.picTime as FormDataEntryValue | undefined),
    sicTime: toNumber(raw.sicTime as FormDataEntryValue | undefined),
    nightTime: toNumber(raw.nightTime as FormDataEntryValue | undefined),
    instrumentTime: toNumber(raw.instrumentTime as FormDataEntryValue | undefined),
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
    totalTime: parsed.data.totalTime,
    picTime: parsed.data.picTime,
    sicTime: parsed.data.sicTime,
    nightTime: parsed.data.nightTime,
    instrumentTime: parsed.data.instrumentTime,
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
