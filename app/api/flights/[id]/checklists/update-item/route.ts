import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/app/lib/db";
import { requireUser } from "@/app/lib/session";
import { isChecklistLocked, isChecklistAvailable } from "@/app/lib/checklists/lock";

const updateSchema = z.object({
  itemId: z.string().min(1),
  notes: z.string().optional(),
  valueText: z.string().optional(),
  valueNumber: z.string().optional(),
  valueYesNo: z.string().optional(),
  valueCheck: z.string().optional(),
  complete: z.string().optional()
});

export async function POST(
  request: Request,
  { params }: { params: { id: string } }
) {
  const user = await requireUser();
  const redirectUrl = new URL(`/flights/${params.id}`, request.url);
  const wantsJson =
    request.headers.get("x-checklist-autosave") === "true" ||
    request.headers.get("accept")?.includes("application/json");
  const formData = await request.formData();
  const raw = Object.fromEntries(formData.entries());
  const parsed = updateSchema.safeParse(raw);
  if (!parsed.success) {
    if (wantsJson) {
      return NextResponse.json(
        { status: "error", message: "Invalid checklist item." },
        { status: 400 }
      );
    }
    redirectUrl.searchParams.set("toast", "Invalid checklist item.");
    redirectUrl.searchParams.set("toastType", "error");
    return NextResponse.redirect(redirectUrl);
  }

  const item = await prisma.flightChecklistItem.findFirst({
    where: {
      id: parsed.data.itemId,
      checklistRun: {
        flightId: params.id,
        flight: { userId: user.id }
      }
    },
    include: { checklistRun: true }
  });

  if (!item) {
    if (wantsJson) {
      return NextResponse.json(
        { status: "error", message: "Checklist item not found." },
        { status: 404 }
      );
    }
    redirectUrl.searchParams.set("toast", "Checklist item not found.");
    redirectUrl.searchParams.set("toastType", "error");
    return NextResponse.redirect(redirectUrl);
  }

  if (!isChecklistAvailable(item.checklistRun)) {
    if (wantsJson) {
      return NextResponse.json(
        { status: "error", message: "Checklist not available." },
        { status: 409 }
      );
    }
    redirectUrl.searchParams.set("toast", "Checklist not available.");
    redirectUrl.searchParams.set("toastType", "error");
    return NextResponse.redirect(redirectUrl);
  }

  if (isChecklistLocked(item.checklistRun)) {
    if (wantsJson) {
      return NextResponse.json(
        { status: "error", message: "Checklist is signed and locked." },
        { status: 409 }
      );
    }
    redirectUrl.searchParams.set("toast", "Checklist is signed and locked.");
    redirectUrl.searchParams.set("toastType", "error");
    return NextResponse.redirect(redirectUrl);
  }

  const updates: {
    notes?: string | null;
    valueText?: string | null;
    valueNumber?: number | null;
    valueYesNo?: boolean | null;
    completed?: boolean;
    completedAt?: Date | null;
  } = {
    notes: parsed.data.notes ? String(parsed.data.notes) : null
  };

  if (item.inputType === "CHECK") {
    updates.valueYesNo = Boolean(parsed.data.valueCheck);
  }

  if (item.inputType === "YES_NO") {
    if (parsed.data.valueYesNo === "yes") {
      updates.valueYesNo = true;
    } else if (parsed.data.valueYesNo === "no") {
      updates.valueYesNo = false;
    } else {
      updates.valueYesNo = null;
    }
  }

  if (item.inputType === "NUMBER") {
    if (parsed.data.valueNumber) {
      const parsedNumber = Number(parsed.data.valueNumber);
      if (Number.isNaN(parsedNumber)) {
        if (wantsJson) {
          return NextResponse.json(
            { status: "error", message: "Invalid number value." },
            { status: 400 }
          );
        }
        redirectUrl.searchParams.set("toast", "Invalid number value.");
        redirectUrl.searchParams.set("toastType", "error");
        return NextResponse.redirect(redirectUrl);
      }
      updates.valueNumber = parsedNumber;
    } else {
      updates.valueNumber = null;
    }
  }

  if (item.inputType === "TEXT") {
    updates.valueText = parsed.data.valueText ? String(parsed.data.valueText) : null;
  }

  if (parsed.data.complete) {
    updates.completed = true;
    if (!item.completedAt) {
      updates.completedAt = new Date();
    }
  }

  await prisma.flightChecklistItem.update({
    where: { id: item.id },
    data: updates
  });

  if (wantsJson) {
    return NextResponse.json({ status: "ok" });
  }
  redirectUrl.searchParams.set("toast", "Checklist item saved.");
  redirectUrl.searchParams.set("toastType", "success");
  return NextResponse.redirect(redirectUrl);
}
