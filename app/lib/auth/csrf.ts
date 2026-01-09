import { headers } from "next/headers";

function checkOrigin(origin: string | null, host: string | null) {
  if (!origin || !host) {
    return { ok: false, error: "Missing origin header." };
  }

  try {
    const originHost = new URL(origin).host;
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
  const host = headerList.get("x-forwarded-host") ?? headerList.get("host");
  return checkOrigin(origin, host);
}

export function validateRequestCsrf(request: Request) {
  const origin = request.headers.get("origin");
  const host = request.headers.get("x-forwarded-host") ?? request.headers.get("host");
  return checkOrigin(origin, host);
}
