import { ImageResponse } from "next/og";
import { prisma } from "@/app/lib/db";

export const runtime = "nodejs";

function downsample<T>(arr: T[], max: number) {
  if (arr.length <= max) return arr;
  const step = arr.length / max;
  const out: T[] = [];
  for (let i = 0; i < max; i++) {
    out.push(arr[Math.floor(i * step)]!);
  }
  return out;
}

function normalizePoints(points: Array<{ latitude: number; longitude: number }>) {
  const lats = points.map((p) => p.latitude);
  const lons = points.map((p) => p.longitude);
  const minLat = Math.min(...lats);
  const maxLat = Math.max(...lats);
  const minLon = Math.min(...lons);
  const maxLon = Math.max(...lons);

  const spanLat = maxLat - minLat || 1;
  const spanLon = maxLon - minLon || 1;

  return points.map((p) => ({
    x: (p.longitude - minLon) / spanLon,
    y: 1 - (p.latitude - minLat) / spanLat
  }));
}

function polylinePoints(points: Array<{ x: number; y: number }>, w: number, h: number, pad = 12) {
  if (points.length === 0) return "";
  return points
    .map(
      (p) =>
        `${(pad + p.x * (w - pad * 2)).toFixed(1)},${(pad + p.y * (h - pad * 2)).toFixed(1)}`
    )
    .join(" ");
}

export async function GET(_req: Request, { params }: { params: { token: string } }) {
  const share = await prisma.flightShareLink.findFirst({
    where: { token: params.token, revokedAt: null },
    select: {
      token: true,
      flight: {
        select: {
          tailNumber: true,
          tailNumberSnapshot: true,
          origin: true,
          destination: true,
          startTime: true,
          durationMinutes: true,
          distanceNm: true,
          trackPoints: {
            orderBy: { recordedAt: "asc" },
            select: { latitude: true, longitude: true, altitudeFeet: true, groundspeedKt: true }
          }
        }
      }
    }
  });

  if (!share) {
    return new ImageResponse(
      <div
        style={{
          height: "100%",
          width: "100%",
          background: "#0b1220",
          color: "white",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          fontSize: 32,
          fontWeight: 700
        }}
      >
        FlightTraks · Share not found
      </div>,
      { width: 1200, height: 630 }
    );
  }

  const flight = share.flight;
  const tail = (flight.tailNumberSnapshot ?? flight.tailNumber).trim();
  const route = `${flight.origin} → ${flight.destination ?? "TBD"}`;

  const pts = downsample(flight.trackPoints, 180);
  const routePts = pts.map((p) => ({ latitude: p.latitude, longitude: p.longitude }));
  const normalized = routePts.length >= 2 ? normalizePoints(routePts) : [];
  const mapW = 640;
  const mapH = 360;
  const routePolyline = polylinePoints(normalized, mapW, mapH);

  const altitudeVals = pts.map((p) => p.altitudeFeet).filter((v): v is number => typeof v === "number");
  const speedVals = pts.map((p) => p.groundspeedKt).filter((v): v is number => typeof v === "number");
  const maxAlt = altitudeVals.length ? Math.max(...altitudeVals) : null;
  const maxSpd = speedVals.length ? Math.max(...speedVals) : null;

  const chartW = 520;
  const chartH = 140;
  const chart = (vals: number[], color: string) => {
    if (vals.length < 2) return null;
    const min = Math.min(...vals);
    const max = Math.max(...vals);
    const span = max - min || 1;
    const sample = downsample(vals, 120);
    const ptsStr = sample
      .map((v, i) => {
        const x = (i / (sample.length - 1)) * chartW;
        const y = chartH - ((v - min) / span) * chartH;
        return `${x.toFixed(1)},${y.toFixed(1)}`;
      })
      .join(" ");
    return { ptsStr, color };
  };
  const altChart = chart(altitudeVals, "#38bdf8");
  const spdChart = chart(speedVals, "#a78bfa");

  const durationLabel = flight.durationMinutes !== null ? `${flight.durationMinutes} min` : "—";
  const distanceLabel = flight.distanceNm !== null ? `${flight.distanceNm} nm` : "—";
  const maxAltLabel = maxAlt !== null ? `${maxAlt.toLocaleString()} ft` : "—";
  const maxSpdLabel = maxSpd !== null ? `${maxSpd} kt` : "—";

  const dateLabel = flight.startTime.toISOString().slice(0, 10);

  const firstPt = routePolyline ? routePolyline.split(" ")[0] : null;
  const lastPt = routePolyline ? routePolyline.split(" ").slice(-1)[0] : null;
  const firstXY = firstPt ? firstPt.split(",").map(Number) : null;
  const lastXY = lastPt ? lastPt.split(",").map(Number) : null;

  return new ImageResponse(
    <div
      style={{
        height: "100%",
        width: "100%",
        background: "linear-gradient(135deg, #0b1220 0%, #0f172a 55%, #111827 100%)",
        color: "white",
        padding: 44,
        display: "flex",
        gap: 28,
        fontFamily:
          'ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, Helvetica, Arial, "Apple Color Emoji", "Segoe UI Emoji"'
      }}
    >
      <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: 18 }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <div>
            <div style={{ fontSize: 40, fontWeight: 800, lineHeight: 1.1 }}>{tail}</div>
            <div style={{ marginTop: 6, fontSize: 22, color: "#cbd5e1" }}>{route}</div>
          </div>
          <div style={{ textAlign: "right" }}>
            <div style={{ fontSize: 16, color: "#94a3b8" }}>FlightTraks</div>
            <div style={{ fontSize: 14, color: "#64748b" }}>{dateLabel}</div>
          </div>
        </div>

        <div
          style={{
            borderRadius: 22,
            border: "1px solid rgba(148,163,184,0.25)",
            background: "rgba(2,6,23,0.55)",
            padding: 18,
            display: "flex",
            gap: 14
          }}
        >
          {[
            ["Duration", durationLabel],
            ["Distance", distanceLabel],
            ["Max alt", maxAltLabel],
            ["Max spd", maxSpdLabel]
          ].map(([k, v]) => (
            <div
              key={k}
              style={{
                flex: 1,
                padding: 14,
                borderRadius: 16,
                background: "rgba(15,23,42,0.7)",
                border: "1px solid rgba(148,163,184,0.15)"
              }}
            >
              <div style={{ fontSize: 13, color: "#94a3b8" }}>{k}</div>
              <div style={{ marginTop: 6, fontSize: 20, fontWeight: 800 }}>{v}</div>
            </div>
          ))}
        </div>

        <div style={{ display: "flex", gap: 14 }}>
          <div
            style={{
              flex: 1,
              borderRadius: 22,
              border: "1px solid rgba(148,163,184,0.25)",
              background: "rgba(2,6,23,0.55)",
              padding: 16
            }}
          >
            <div style={{ fontSize: 14, color: "#94a3b8", marginBottom: 10 }}>Altitude</div>
            <svg width={chartW} height={chartH} viewBox={`0 0 ${chartW} ${chartH}`}>
              <rect width={chartW} height={chartH} rx="14" fill="rgba(15,23,42,0.7)" />
              {altChart ? (
                <polyline
                  points={altChart.ptsStr}
                  fill="none"
                  stroke={altChart.color}
                  strokeWidth="3"
                  strokeLinejoin="round"
                  strokeLinecap="round"
                />
              ) : null}
            </svg>
          </div>

          <div
            style={{
              flex: 1,
              borderRadius: 22,
              border: "1px solid rgba(148,163,184,0.25)",
              background: "rgba(2,6,23,0.55)",
              padding: 16
            }}
          >
            <div style={{ fontSize: 14, color: "#94a3b8", marginBottom: 10 }}>Speed</div>
            <svg width={chartW} height={chartH} viewBox={`0 0 ${chartW} ${chartH}`}>
              <rect width={chartW} height={chartH} rx="14" fill="rgba(15,23,42,0.7)" />
              {spdChart ? (
                <polyline
                  points={spdChart.ptsStr}
                  fill="none"
                  stroke={spdChart.color}
                  strokeWidth="3"
                  strokeLinejoin="round"
                  strokeLinecap="round"
                />
              ) : null}
            </svg>
          </div>
        </div>
      </div>

      <div style={{ width: 640, display: "flex", flexDirection: "column", gap: 14 }}>
        <div
          style={{
            borderRadius: 22,
            border: "1px solid rgba(148,163,184,0.25)",
            background: "rgba(2,6,23,0.55)",
            padding: 16
          }}
        >
          <div style={{ fontSize: 14, color: "#94a3b8", marginBottom: 10 }}>Route</div>
          <svg width={mapW} height={mapH} viewBox={`0 0 ${mapW} ${mapH}`}>
            <rect width={mapW} height={mapH} rx="18" fill="rgba(15,23,42,0.7)" />
            {Array.from({ length: 8 }).map((_, i) => (
              <line
                key={`v${i}`}
                x1={((i + 1) * mapW) / 9}
                x2={((i + 1) * mapW) / 9}
                y1={0}
                y2={mapH}
                stroke="rgba(148,163,184,0.08)"
                strokeWidth="1"
              />
            ))}
            {Array.from({ length: 5 }).map((_, i) => (
              <line
                key={`h${i}`}
                y1={((i + 1) * mapH) / 6}
                y2={((i + 1) * mapH) / 6}
                x1={0}
                x2={mapW}
                stroke="rgba(148,163,184,0.08)"
                strokeWidth="1"
              />
            ))}
            {routePolyline ? (
              <>
                <polyline
                  points={routePolyline}
                  fill="none"
                  stroke="rgba(56,189,248,0.9)"
                  strokeWidth="4"
                  strokeLinejoin="round"
                  strokeLinecap="round"
                />
                {firstXY ? <circle cx={firstXY[0]} cy={firstXY[1]} r="6" fill="#22c55e" /> : null}
                {lastXY ? <circle cx={lastXY[0]} cy={lastXY[1]} r="6" fill="#ef4444" /> : null}
              </>
            ) : (
              <text x="50%" y="50%" fill="#94a3b8" fontSize="16" textAnchor="middle">
                No track points
              </text>
            )}
          </svg>
        </div>

        <div style={{ fontSize: 12, color: "#64748b" }}>
          Shared via FlightTraks · {params.token.slice(0, 8)}
        </div>
      </div>
    </div>,
    { width: 1200, height: 630 }
  );
}

