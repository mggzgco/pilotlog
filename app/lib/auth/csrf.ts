import { headers } from "next/headers";

// Prefer the public host (app URL) so CSRF works behind proxies that rewrite Host.
const PUBLIC_APP_URL =
  process.env.NEXT_PUBLIC_APP_URL ??
  process.env.APP_URL ??
  (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : null);

function normalizeHost(host: string | null) {
  if (!host) return null;
  try {
    // Proxies sometimes send a comma-separated chain; we want the original.
    const first = host.split(",")[0]?.trim();
    if (!first) return null;
    // Handle bare host without protocol by coercing into a URL.
    const asUrl = first.includes("://") ? first : `http://${first}`;
    const url = new URL(asUrl);
    const hostname = url.hostname.toLowerCase();
    // Treat default ports as equivalent to no port.
    const port = url.port;
    if (!port || port === "80" || port === "443") return hostname;
    return `${hostname}:${port}`;
  } catch {
    return null;
  }
}

function checkOrigin(origin: string | null, referer: string | null, host: string | null) {
  const allowedHosts = [
    normalizeHost(PUBLIC_APP_URL ?? null),
    normalizeHost(host),
  ].filter(Boolean) as string[];

  if (!allowedHosts.length) {
    return { ok: false, error: "Missing host header." };
  }

  try {
    const normalizedOrigin = origin && origin !== "null" ? origin : null;
    const source = normalizedOrigin ?? referer ?? null;
    if (!source) {
      return { ok: false, error: "Missing origin header." };
    }
    const originHost = normalizeHost(source);
    if (!originHost) {
      return { ok: false, error: "Invalid request origin." };
    }
    if (!allowedHosts.includes(originHost)) {
      return { ok: false, error: "Invalid request origin." };
    }
  } catch {
    return { ok: false, error: "Invalid request origin." };
  }

  return { ok: true };
}

export function validateCsrf() {
  const headerList = headers();
  const origin = headerList.get("origin");
  const referer = headerList.get("referer");
  const host = headerList.get("x-forwarded-host") ?? headerList.get("host");
  return checkOrigin(origin, referer, host);
}

export function validateRequestCsrf(request: Request) {
  const origin = request.headers.get("origin");
  const referer = request.headers.get("referer");
  const host = request.headers.get("x-forwarded-host") ?? request.headers.get("host");
  return checkOrigin(origin, referer, host);
}
