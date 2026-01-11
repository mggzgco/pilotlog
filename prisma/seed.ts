import {
  ChecklistInputType,
  ChecklistPhase,
  PrismaClient,
  UserRole
} from "@prisma/client";
import { hashPassword } from "../app/lib/password";

const prisma = new PrismaClient();

async function main() {
  await seedAirports();
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

async function seedAirports() {
  // Minimal curated seed to enable timezone-aware entry immediately.
  // You can expand this later (e.g., bulk import) without changing app logic.
  const airports: Array<{
    icao: string;
    iata?: string;
    name: string;
    city?: string;
    region?: string;
    country?: string;
    latitude?: number;
    longitude?: number;
    timeZone: string;
  }> = [
    // User-requested example: Wings Field (Philadelphia area)
    {
      icao: "KLOM",
      iata: "LOM",
      name: "Wings Field",
      city: "Philadelphia",
      region: "PA",
      country: "US",
      latitude: 40.1375,
      longitude: -75.2651,
      timeZone: "America/New_York"
    },
    { icao: "KJFK", iata: "JFK", name: "John F. Kennedy International", city: "New York", region: "NY", country: "US", timeZone: "America/New_York" },
    { icao: "KLAX", iata: "LAX", name: "Los Angeles International", city: "Los Angeles", region: "CA", country: "US", timeZone: "America/Los_Angeles" },
    { icao: "KSFO", iata: "SFO", name: "San Francisco International", city: "San Francisco", region: "CA", country: "US", timeZone: "America/Los_Angeles" },
    { icao: "KORD", iata: "ORD", name: "Chicago O'Hare International", city: "Chicago", region: "IL", country: "US", timeZone: "America/Chicago" },
    { icao: "KDEN", iata: "DEN", name: "Denver International", city: "Denver", region: "CO", country: "US", timeZone: "America/Denver" },
    { icao: "PHNL", iata: "HNL", name: "Daniel K. Inouye International", city: "Honolulu", region: "HI", country: "US", timeZone: "Pacific/Honolulu" },
    { icao: "EGLL", iata: "LHR", name: "London Heathrow", city: "London", country: "GB", timeZone: "Europe/London" },
    { icao: "LFPG", iata: "CDG", name: "Paris Charles de Gaulle", city: "Paris", country: "FR", timeZone: "Europe/Paris" },
    { icao: "RJTT", iata: "HND", name: "Tokyo Haneda", city: "Tokyo", country: "JP", timeZone: "Asia/Tokyo" }
  ];

  for (const airport of airports) {
    await prisma.airport.upsert({
      where: { icao: airport.icao },
      create: {
        icao: airport.icao,
        iata: airport.iata ?? null,
        name: airport.name,
        city: airport.city ?? null,
        region: airport.region ?? null,
        country: airport.country ?? null,
        latitude: airport.latitude ?? null,
        longitude: airport.longitude ?? null,
        timeZone: airport.timeZone
      },
      update: {
        iata: airport.iata ?? null,
        name: airport.name,
        city: airport.city ?? null,
        region: airport.region ?? null,
        country: airport.country ?? null,
        latitude: airport.latitude ?? null,
        longitude: airport.longitude ?? null,
        timeZone: airport.timeZone
      }
    });
  }
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
