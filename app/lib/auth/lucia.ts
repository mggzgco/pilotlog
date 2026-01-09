import { Lucia } from "lucia";
import { PrismaAdapter } from "@lucia-auth/adapter-prisma";
import { prisma } from "@/app/lib/db";

const adapter = new PrismaAdapter(prisma.session, prisma.user);

export const lucia = new Lucia(adapter, {
  sessionCookie: {
    attributes: {
      // AUTH-011: secure session cookies
      // NFR-SEC-002: HttpOnly + SameSite session enforcement
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      httpOnly: true
    }
  },
  getUserAttributes: (attributes) => {
    return {
      email: attributes.email,
      name: attributes.name,
      phone: attributes.phone,
      role: attributes.role,
      status: attributes.status
    };
  }
});

declare module "lucia" {
  interface Register {
    Lucia: typeof lucia;
    DatabaseUserAttributes: {
      email: string;
      name: string | null;
      phone: string | null;
      role: "USER" | "ADMIN";
      status: "PENDING" | "ACTIVE" | "DISABLED";
    };
  }
}
