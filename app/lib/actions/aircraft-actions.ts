"use server";

import { redirect } from "next/navigation";
import { prisma } from "@/app/lib/db";
import { requireUser } from "@/app/lib/session";

const checklistPhases = new Set(["PREFLIGHT", "POSTFLIGHT"]);

export async function createAircraftAction(formData: FormData) {
  const tailNumber = String(formData.get("tailNumber") || "").trim();
  const manufacturer = String(formData.get("manufacturer") || "").trim();
  const model = String(formData.get("model") || "").trim();
  const category = String(formData.get("category") || "").trim();
  const aircraftTypeId = String(formData.get("aircraftTypeId") || "").trim();
  const newTypeName = String(formData.get("newTypeName") || "").trim();

  if (!tailNumber) {
    return { error: "Tail number is required." };
  }

  const user = await requireUser();
  const resolvedTypeId = await resolveAircraftTypeId({
    userId: user.id,
    aircraftTypeId,
    newTypeName
  });

  const resolvedCategory = toAircraftCategory(category);

  await prisma.aircraft.create({
    data: {
      userId: user.id,
      tailNumber,
      manufacturer: manufacturer || null,
      model: model || null,
      category: resolvedCategory,
      aircraftTypeId: resolvedTypeId
    }
  });

  redirect("/aircraft");
}

export async function updateAircraftDetailsAction(formData: FormData) {
  const aircraftId = String(formData.get("aircraftId") || "").trim();
  const tailNumber = String(formData.get("tailNumber") || "").trim();
  const manufacturer = String(formData.get("manufacturer") || "").trim();
  const model = String(formData.get("model") || "").trim();
  const category = String(formData.get("category") || "").trim();

  if (!aircraftId) {
    return { error: "Aircraft is required." };
  }
  if (!tailNumber) {
    return { error: "Tail number is required." };
  }

  const user = await requireUser();
  const aircraft = await prisma.aircraft.findFirst({
    where: { id: aircraftId, userId: user.id },
    select: { id: true }
  });
  if (!aircraft) {
    return { error: "Aircraft not found." };
  }

  const dup = await prisma.aircraft.findFirst({
    where: { userId: user.id, tailNumber, NOT: { id: aircraftId } },
    select: { id: true }
  });
  if (dup) {
    return { error: "That tail number already exists." };
  }

  await prisma.aircraft.update({
    where: { id: aircraftId },
    data: {
      tailNumber,
      manufacturer: manufacturer || null,
      model: model || null,
      category: toAircraftCategory(category)
    }
  });

  redirect(`/aircraft/${aircraftId}`);
}

export async function updateAircraftTypeAction(formData: FormData) {
  const aircraftId = String(formData.get("aircraftId") || "").trim();
  const aircraftTypeId = String(formData.get("aircraftTypeId") || "").trim();
  const newTypeName = String(formData.get("newTypeName") || "").trim();

  if (!aircraftId) {
    return { error: "Aircraft is required." };
  }

  const user = await requireUser();
  const aircraft = await prisma.aircraft.findFirst({
    where: { id: aircraftId, userId: user.id },
    select: { id: true }
  });

  if (!aircraft) {
    return { error: "Aircraft not found." };
  }

  const resolvedTypeId = await resolveAircraftTypeId({
    userId: user.id,
    aircraftTypeId,
    newTypeName
  });

  await prisma.aircraft.update({
    where: { id: aircraftId },
    data: { aircraftTypeId: resolvedTypeId }
  });

  redirect(`/aircraft/${aircraftId}`);
}

export async function assignAircraftChecklistAction(formData: FormData) {
  const aircraftId = String(formData.get("aircraftId") || "").trim();
  const templateId = String(formData.get("templateId") || "").trim();
  const phase = String(formData.get("phase") || "").trim();
  const scope = String(formData.get("scope") || "").trim();

  if (!aircraftId || !checklistPhases.has(phase) || !["aircraft", "type"].includes(scope)) {
    return { error: "Invalid checklist assignment." };
  }

  const user = await requireUser();
  const aircraft = await prisma.aircraft.findFirst({
    where: { id: aircraftId, userId: user.id },
    select: { id: true, aircraftTypeId: true }
  });

  if (!aircraft) {
    return { error: "Aircraft not found." };
  }

  const assignmentId = templateId || null;
  if (assignmentId) {
    const template = await prisma.checklistTemplate.findFirst({
      where: { id: assignmentId, userId: user.id },
      select: { id: true }
    });
    if (!template) {
      return { error: "Checklist template not found." };
    }
  }

  if (scope === "aircraft") {
    await prisma.aircraft.update({
      where: { id: aircraftId },
      data:
        phase === "PREFLIGHT"
          ? { preflightChecklistTemplateId: assignmentId }
          : { postflightChecklistTemplateId: assignmentId }
    });
  } else if (aircraft.aircraftTypeId) {
    await prisma.aircraftType.update({
      where: { id: aircraft.aircraftTypeId },
      data:
        phase === "PREFLIGHT"
          ? { defaultPreflightTemplateId: assignmentId }
          : { defaultPostflightTemplateId: assignmentId }
    });
  }

  redirect(`/aircraft/${aircraftId}`);
}

export async function createChecklistFromAircraftAction(formData: FormData) {
  const aircraftId = String(formData.get("aircraftId") || "").trim();
  const name = String(formData.get("name") || "").trim();
  const phase = String(formData.get("phase") || "").trim();
  const scope = String(formData.get("scope") || "").trim();

  if (!aircraftId || !name || !checklistPhases.has(phase)) {
    return { error: "Checklist details are required." };
  }

  const user = await requireUser();
  const aircraft = await prisma.aircraft.findFirst({
    where: { id: aircraftId, userId: user.id },
    select: { id: true, aircraftTypeId: true }
  });

  if (!aircraft) {
    return { error: "Aircraft not found." };
  }

  const template = await prisma.checklistTemplate.create({
    data: {
      userId: user.id,
      name,
      phase: phase as "PREFLIGHT" | "POSTFLIGHT",
      isDefault: false
    }
  });

  if (scope === "type" && aircraft.aircraftTypeId) {
    await prisma.aircraftType.update({
      where: { id: aircraft.aircraftTypeId },
      data:
        phase === "PREFLIGHT"
          ? { defaultPreflightTemplateId: template.id }
          : { defaultPostflightTemplateId: template.id }
    });
  } else {
    await prisma.aircraft.update({
      where: { id: aircraftId },
      data:
        phase === "PREFLIGHT"
          ? { preflightChecklistTemplateId: template.id }
          : { postflightChecklistTemplateId: template.id }
    });
  }

  redirect(`/aircraft/${aircraftId}`);
}

async function resolveAircraftTypeId({
  userId,
  aircraftTypeId,
  newTypeName
}: {
  userId: string;
  aircraftTypeId: string;
  newTypeName: string;
}) {
  if (newTypeName) {
    const existingType = await prisma.aircraftType.findFirst({
      where: { userId, name: newTypeName },
      select: { id: true }
    });
    if (existingType) {
      return existingType.id;
    }

    const createdType = await prisma.aircraftType.create({
      data: { userId, name: newTypeName }
    });
    return createdType.id;
  }

  if (aircraftTypeId === "new") {
    return null;
  }

  return aircraftTypeId || null;
}

function toAircraftCategory(value: string) {
  switch (value) {
    case "SINGLE_ENGINE_PISTON":
    case "MULTI_ENGINE_PISTON":
    case "SINGLE_ENGINE_TURBINE":
    case "MULTI_ENGINE_TURBINE":
    case "JET":
    case "GLIDER":
    case "HELICOPTER":
    case "OTHER":
      return value;
    default:
      return "OTHER";
  }
}
