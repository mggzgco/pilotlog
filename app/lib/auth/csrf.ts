import { headers } from "next/headers";

function checkOrigin(origin: string | null, host: string | null, referer?: string | null) {
  if (!host) {
    return { ok: false, error: "Missing host header." };
  }

  try {
    const normalizedOrigin = origin && origin !== "null" ? origin : null;
    const source = normalizedOrigin ?? referer ?? null;
    if (!source) {
      return { ok: false, error: "Missing origin header." };
    }
    const originHost = new URL(source).host;
    if (originHost !== host) {
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
  return checkOrigin(origin, host, referer);
}

export function validateRequestCsrf(request: Request) {
  const origin = request.headers.get("origin");
  const referer = request.headers.get("referer");
  const host = request.headers.get("x-forwarded-host") ?? request.headers.get("host");
  return checkOrigin(origin, host, referer);
}
