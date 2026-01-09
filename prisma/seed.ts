import {
  ChecklistInputType,
  ChecklistPhase,
  PrismaClient,
  UserRole
} from "@prisma/client";
import { hashPassword } from "../app/lib/password";

const prisma = new PrismaClient();

async function main() {
  await seedDefaultChecklists();

  const email = process.env.SEED_ADMIN_EMAIL;
  const password = process.env.SEED_ADMIN_PASSWORD;

  if (!email || !password) {
    console.log("No seed admin credentials provided. Skipping.");
    return;
  }

  const normalizedEmail = email.toLowerCase();
  const existing = await prisma.user.findUnique({ where: { email: normalizedEmail } });
  if (existing) {
    console.log("Admin already exists.");
    return;
  }

  const passwordHash = await hashPassword(password);

  await prisma.user.create({
    data: {
      email: normalizedEmail,
      passwordHash,
      status: "ACTIVE",
      role: UserRole.ADMIN,
      name: "Seed Admin"
    }
  });

  console.log("Seed admin created.");
}

async function seedDefaultChecklists() {
  const existingPreflight = await prisma.checklistTemplate.findFirst({
    where: {
      userId: null,
      phase: ChecklistPhase.PREFLIGHT,
      isDefault: true
    }
  });

  if (!existingPreflight) {
    await prisma.checklistTemplate.create({
      data: {
        name: "Default GA Preflight",
        phase: ChecklistPhase.PREFLIGHT,
        isDefault: true,
        items: {
          create: [
            { order: 1, title: "Documents", details: "AROW onboard", inputType: ChecklistInputType.CHECK },
            { order: 2, title: "Weather briefing", details: "METAR/TAF checked", inputType: ChecklistInputType.CHECK },
            { order: 3, title: "Weight & balance", details: "Within limits", inputType: ChecklistInputType.CHECK },
            { order: 4, title: "Fuel quantity", details: "Sufficient + reserves", inputType: ChecklistInputType.YES_NO },
            { order: 5, title: "Oil quantity", details: "Within limits", inputType: ChecklistInputType.CHECK },
            { order: 6, title: "Control surfaces", details: "Free and correct", inputType: ChecklistInputType.CHECK },
            { order: 7, title: "Pitot cover removed", inputType: ChecklistInputType.CHECK },
            { order: 8, title: "Flight controls check", details: "Full and free", inputType: ChecklistInputType.CHECK },
            { order: 9, title: "Avionics setup", details: "Nav/comm configured", inputType: ChecklistInputType.CHECK },
            { order: 10, title: "Altimeter set", details: "Within 75 ft", inputType: ChecklistInputType.CHECK },
            { order: 11, title: "Briefing", details: "Departure/abort plan", inputType: ChecklistInputType.TEXT },
            { order: 12, title: "Passenger briefing", details: "Belts, exits, sterile cockpit", inputType: ChecklistInputType.CHECK }
          ]
        }
      }
    });
  }

  const existingPostflight = await prisma.checklistTemplate.findFirst({
    where: {
      userId: null,
      phase: ChecklistPhase.POSTFLIGHT,
      isDefault: true
    }
  });

  if (!existingPostflight) {
    await prisma.checklistTemplate.create({
      data: {
        name: "Default GA Postflight",
        phase: ChecklistPhase.POSTFLIGHT,
        isDefault: true,
        items: {
          create: [
            { order: 1, title: "Avionics off", inputType: ChecklistInputType.CHECK },
            { order: 2, title: "Mixture idle cut-off", inputType: ChecklistInputType.CHECK },
            { order: 3, title: "Magnetos off", inputType: ChecklistInputType.CHECK },
            { order: 4, title: "Master switch off", inputType: ChecklistInputType.CHECK },
            { order: 5, title: "Control lock installed", inputType: ChecklistInputType.CHECK },
            { order: 6, title: "Fuel selector off", inputType: ChecklistInputType.CHECK },
            { order: 7, title: "Postflight walk-around", details: "Check for leaks/damage", inputType: ChecklistInputType.CHECK },
            { order: 8, title: "Tie-downs and covers", inputType: ChecklistInputType.CHECK },
            { order: 9, title: "Flight notes", details: "Maintenance items noted", inputType: ChecklistInputType.TEXT }
          ]
        }
      }
    });
  }
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
