"use client";

import dynamic from "next/dynamic";

interface FlightMapProps {
  polyline?: string | null;
  track?: Array<{ latitude: number; longitude: number }> | null;
}

const FlightMapImpl = dynamic(() => import("./flight-map-impl").then((m) => m.FlightMapImpl), {
  ssr: false,
  loading: () => (
    <div className="h-72 w-full rounded-lg bg-slate-100 dark:bg-slate-900" />
  )
});

export function FlightMap({ polyline, track }: FlightMapProps) {
  // Keep some light work here so SSR never touches Leaflet, but we still normalize inputs.
  const normalizedTrack =
    track && track.length > 0
      ? track.map((point) => ({ latitude: point.latitude, longitude: point.longitude }))
      : [];

  // Pass through to the real Leaflet implementation (client-only).
  return <FlightMapImpl polyline={polyline} track={normalizedTrack} />;
}
