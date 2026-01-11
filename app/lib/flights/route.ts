export function formatFlightRouteLabel({
  origin,
  stops,
  destination
}: {
  origin: string;
  stops: Array<{ label: string }> | string[];
  destination: string | null;
}) {
  const stopLabels = Array.isArray(stops)
    ? (stops as any[]).map((s) => (typeof s === "string" ? s : s?.label)).filter(Boolean)
    : [];
  const parts = [origin, ...stopLabels, destination ?? "—"].filter(Boolean);
  return parts.join(" → ");
}

