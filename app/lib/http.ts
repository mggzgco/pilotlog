export function getRequestOrigin(request: Request) {
  const proto = request.headers.get("x-forwarded-proto") ?? "http";
  const host =
    request.headers.get("x-forwarded-host") ??
    request.headers.get("host") ??
    null;
  if (host) {
    return `${proto}://${host}`;
  }
  return new URL(request.url).origin;
}

export function buildRedirectUrl(request: Request, path: string) {
  return new URL(path, getRequestOrigin(request));
}

