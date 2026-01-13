"use server";

import { redirect } from "next/navigation";
import { prisma } from "@/app/lib/db";
import { requireUser } from "@/app/lib/session";

const checklistPhases = new Set(["PREFLIGHT", "POSTFLIGHT"]);

function redirectWithToast(
  path: string,
  message: string,
  toastType: "success" | "error" | "info"
) {
  const separator = path.includes("?") ? "&" : "?";
  redirect(
    `${path}${separator}toast=${encodeURIComponent(message)}&toastType=${toastType}`
  );
}

export async function createAircraftAction(formData: FormData) {
  const tailNumber = String(formData.get("tailNumber") || "").trim();
  const manufacturer = String(formData.get("manufacturer") || "").trim();
  const model = String(formData.get("model") || "").trim();
  const category = String(formData.get("category") || "").trim();
  const aircraftTypeId = String(formData.get("aircraftTypeId") || "").trim();
  const newTypeName = String(formData.get("newTypeName") || "").trim();

  if (!tailNumber) {
    redirectWithToast("/aircraft", "Tail number is required.", "error");
  }

  const user = await requireUser();
  const resolvedTypeId = await resolveAircraftTypeId({
    userId: user.id,
    aircraftTypeId,
    newTypeName
  });

  const resolvedCategory = toAircraftCategory(category);

  const created = await prisma.aircraft.create({
    data: {
      userId: user.id,
      tailNumber,
      manufacturer: manufacturer || null,
      model: model || null,
      category: resolvedCategory,
      aircraftTypeId: resolvedTypeId
    },
    select: { id: true, tailNumber: true }
  });

  // Backfill: link existing flights (including ADS-B imported) that match this tail number,
  // so flight details can show aircraft photo/manufacturer/model.
  await prisma.flight.updateMany({
    where: {
      userId: user.id,
      aircraftId: null,
      OR: [
        { tailNumber: { equals: created.tailNumber, mode: "insensitive" } },
        { tailNumberSnapshot: { equals: created.tailNumber, mode: "insensitive" } }
      ]
    },
    data: { aircraftId: created.id }
  });

  redirectWithToast("/aircraft", "Aircraft created.", "success");
}

export async function updateAircraftDetailsAction(formData: FormData) {
  const aircraftId = String(formData.get("aircraftId") || "").trim();
  const tailNumber = String(formData.get("tailNumber") || "").trim();
  const manufacturer = String(formData.get("manufacturer") || "").trim();
  const model = String(formData.get("model") || "").trim();
  const category = String(formData.get("category") || "").trim();

  if (!aircraftId) {
    redirectWithToast("/aircraft", "Aircraft is required.", "error");
  }
  if (!tailNumber) {
    redirectWithToast(`/aircraft/${aircraftId}`, "Tail number is required.", "error");
  }

  const user = await requireUser();
  const aircraft = await prisma.aircraft.findFirst({
    where: { id: aircraftId, userId: user.id },
    select: { id: true }
  });
  if (!aircraft) {
    redirectWithToast("/aircraft", "Aircraft not found.", "error");
  }

  const dup = await prisma.aircraft.findFirst({
    where: { userId: user.id, tailNumber, NOT: { id: aircraftId } },
    select: { id: true }
  });
  if (dup) {
    redirectWithToast(
      `/aircraft/${aircraftId}`,
      "That tail number already exists.",
      "error"
    );
  }

  const updated = await prisma.aircraft.update({
    where: { id: aircraftId },
    data: {
      tailNumber,
      manufacturer: manufacturer || null,
      model: model || null,
      category: toAircraftCategory(category)
    },
    select: { id: true, tailNumber: true }
  });

  // Backfill: if the tail number was edited, link any unassigned flights that match it.
  await prisma.flight.updateMany({
    where: {
      userId: user.id,
      aircraftId: null,
      OR: [
        { tailNumber: { equals: updated.tailNumber, mode: "insensitive" } },
        { tailNumberSnapshot: { equals: updated.tailNumber, mode: "insensitive" } }
      ]
    },
    data: { aircraftId: updated.id }
  });

  redirectWithToast(`/aircraft/${aircraftId}`, "Aircraft updated.", "success");
}

export async function updateAircraftDetailsFromFlightAction(formData: FormData) {
  const flightId = String(formData.get("flightId") || "").trim();
  const aircraftId = String(formData.get("aircraftId") || "").trim();
  const tailNumber = String(formData.get("tailNumber") || "").trim();
  const manufacturer = String(formData.get("manufacturer") || "").trim();
  const model = String(formData.get("model") || "").trim();
  const category = String(formData.get("category") || "").trim();

  if (!flightId) {
    redirectWithToast("/flights", "Flight is required.", "error");
  }
  if (!aircraftId) {
    redirectWithToast(`/flights/${flightId}`, "Aircraft is required.", "error");
  }
  if (!tailNumber) {
    redirectWithToast(`/flights/${flightId}`, "Tail number is required.", "error");
  }

  const user = await requireUser();

  const flight = await prisma.flight.findFirst({
    where: { id: flightId, userId: user.id },
    select: { id: true }
  });
  if (!flight) {
    redirectWithToast("/flights", "Flight not found.", "error");
  }

  const aircraft = await prisma.aircraft.findFirst({
    where: { id: aircraftId, userId: user.id },
    select: { id: true }
  });
  if (!aircraft) {
    redirectWithToast(`/flights/${flightId}`, "Aircraft not found.", "error");
  }

  const dup = await prisma.aircraft.findFirst({
    where: { userId: user.id, tailNumber, NOT: { id: aircraftId } },
    select: { id: true }
  });
  if (dup) {
    redirectWithToast(
      `/flights/${flightId}`,
      "That tail number already exists.",
      "error"
    );
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

  redirectWithToast(`/flights/${flightId}#stats`, "Aircraft updated.", "success");
}

export async function updateAircraftTypeAction(formData: FormData) {
  const aircraftId = String(formData.get("aircraftId") || "").trim();
  const aircraftTypeId = String(formData.get("aircraftTypeId") || "").trim();
  const newTypeName = String(formData.get("newTypeName") || "").trim();

  if (!aircraftId) {
    redirectWithToast("/aircraft", "Aircraft is required.", "error");
  }

  const user = await requireUser();
  const aircraft = await prisma.aircraft.findFirst({
    where: { id: aircraftId, userId: user.id },
    select: { id: true }
  });

  if (!aircraft) {
    redirectWithToast("/aircraft", "Aircraft not found.", "error");
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

  redirectWithToast(`/aircraft/${aircraftId}`, "Aircraft type updated.", "success");
}

export async function assignAircraftChecklistAction(formData: FormData) {
  const aircraftId = String(formData.get("aircraftId") || "").trim();
  const templateId = String(formData.get("templateId") || "").trim();
  const phase = String(formData.get("phase") || "").trim();
  const scope = String(formData.get("scope") || "").trim();

  if (!aircraftId || !checklistPhases.has(phase) || !["aircraft", "type"].includes(scope)) {
    redirectWithToast("/aircraft", "Invalid checklist assignment.", "error");
    return;
  }

  const user = await requireUser();
  const aircraft = await prisma.aircraft.findFirst({
    where: { id: aircraftId, userId: user.id },
    select: { id: true, aircraftTypeId: true }
  });

  if (!aircraft) {
    redirectWithToast("/aircraft", "Aircraft not found.", "error");
    return;
  }

  const assignmentId = templateId || null;
  if (assignmentId) {
    const template = await prisma.checklistTemplate.findFirst({
      where: { id: assignmentId, userId: user.id },
      select: { id: true }
    });
    if (!template) {
      redirectWithToast(
        `/aircraft/${aircraftId}`,
        "Checklist template not found.",
        "error"
      );
      return;
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

  redirectWithToast(`/aircraft/${aircraftId}`, "Checklist assignment updated.", "success");
}

export async function createChecklistFromAircraftAction(formData: FormData) {
  const aircraftId = String(formData.get("aircraftId") || "").trim();
  const name = String(formData.get("name") || "").trim();
  const phase = String(formData.get("phase") || "").trim();
  const scope = String(formData.get("scope") || "").trim();

  if (!aircraftId || !name || !checklistPhases.has(phase)) {
    redirectWithToast("/aircraft", "Checklist details are required.", "error");
    return;
  }

  const user = await requireUser();
  const aircraft = await prisma.aircraft.findFirst({
    where: { id: aircraftId, userId: user.id },
    select: { id: true, aircraftTypeId: true }
  });

  if (!aircraft) {
    redirectWithToast("/aircraft", "Aircraft not found.", "error");
    return;
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

  redirectWithToast(`/aircraft/${aircraftId}`, "Checklist created.", "success");
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
