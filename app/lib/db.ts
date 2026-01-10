import { execSync } from "node:child_process";
import { PrismaClient } from "@prisma/client";

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    log: process.env.NODE_ENV === "development" ? ["query", "error"] : ["error"]
  });

const shouldRunMigrations =
  process.env.NEXT_RUNTIME !== "edge" &&
  process.env.PRISMA_MIGRATE_ON_STARTUP !== "false";

if (shouldRunMigrations) {
  try {
    execSync("npx prisma migrate deploy", {
      stdio: "inherit",
      env: {
        ...process.env,
        PRISMA_HIDE_UPDATE_MESSAGE: "true"
      }
    });
  } catch (error) {
    console.error("Failed to run Prisma migrations on startup.", error);
  }
}

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
}
