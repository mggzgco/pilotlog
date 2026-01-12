import { Lucia } from "lucia";
import { PrismaAdapter } from "@lucia-auth/adapter-prisma";
import { prisma } from "@/app/lib/db";

const adapter = new PrismaAdapter(prisma.session, prisma.user);

function resolveSessionCookieSecureFlag() {
  // In production we default to Secure cookies.
  // While ACM/HTTPS is still being validated, you may temporarily run over plain HTTP.
  // Set AUTH_COOKIE_SECURE=false in that case, then remove it once HTTPS is enabled.
  const override = process.env.AUTH_COOKIE_SECURE?.trim();
  if (override) return override.toLowerCase() !== "false";
  return process.env.NODE_ENV === "production";
}

export const lucia = new Lucia(adapter, {
  sessionCookie: {
    attributes: {
      // AUTH-011: secure session cookies
      // NFR-SEC-002: HttpOnly + SameSite session enforcement
      secure: resolveSessionCookieSecureFlag(),
      sameSite: "lax"
    }
  },
  getUserAttributes: (attributes) => {
    return {
      email: attributes.email,
      firstName: attributes.firstName,
      lastName: attributes.lastName,
      name: attributes.name,
      phone: attributes.phone,
      role: attributes.role,
      status: attributes.status
    };
  }
});
