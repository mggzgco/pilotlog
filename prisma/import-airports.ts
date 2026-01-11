import { PrismaClient } from "@prisma/client";
import { readFile } from "fs/promises";
import { parseCsv } from "../app/lib/logten/csv";

const prisma = new PrismaClient();

function pick(row: Record<string, string>, keys: string[]) {
  for (const key of keys) {
    const value = row[key];
    if (typeof value === "string" && value.trim().length > 0) return value.trim();
  }
  return "";
}

async function main() {
  const path = process.env.AIRPORTS_FILE?.trim();
  if (!path) {
    console.error('Missing AIRPORTS_FILE env var (path to CSV/TSV with at least "icao" and "timeZone").');
    process.exit(1);
  }

  const text = await readFile(path, "utf8");
  const parsed = parseCsv(text);

  const rows = parsed.rows;
  if (rows.length === 0) {
    console.log("No rows found in airports file.");
    return;
  }

  let upserted = 0;
  let skipped = 0;

  for (const row of rows) {
    const icao = pick(row, ["icao", "ICAO", "gps_code", "ident"]).toUpperCase();
    const timeZone = pick(row, ["timeZone", "timezone", "tz", "tz_database_time_zone"]);
    if (!icao || !timeZone) {
      skipped += 1;
      continue;
    }

    const iata = pick(row, ["iata", "IATA", "iata_code"]).toUpperCase() || null;
    const name = pick(row, ["name", "airport_name"]) || null;
    const city = pick(row, ["city", "municipality"]) || null;
    const region = pick(row, ["region", "iso_region", "state"]) || null;
    const country = pick(row, ["country", "iso_country"]) || null;

    const latitudeRaw = pick(row, ["latitude", "latitude_deg", "lat"]);
    const longitudeRaw = pick(row, ["longitude", "longitude_deg", "lon", "lng"]);
    const latitude = latitudeRaw ? Number(latitudeRaw) : null;
    const longitude = longitudeRaw ? Number(longitudeRaw) : null;

    await prisma.airport.upsert({
      where: { icao },
      create: {
        icao,
        iata,
        name,
        city,
        region,
        country,
        latitude: Number.isFinite(latitude as number) ? (latitude as number) : null,
        longitude: Number.isFinite(longitude as number) ? (longitude as number) : null,
        timeZone
      },
      update: {
        iata,
        name,
        city,
        region,
        country,
        latitude: Number.isFinite(latitude as number) ? (latitude as number) : null,
        longitude: Number.isFinite(longitude as number) ? (longitude as number) : null,
        timeZone
      }
    });

    upserted += 1;
    if (upserted % 1000 === 0) {
      console.log(`Upserted ${upserted} airports...`);
    }
  }

  console.log(`Done. Upserted ${upserted} airports. Skipped ${skipped} rows (missing icao/timeZone).`);
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

