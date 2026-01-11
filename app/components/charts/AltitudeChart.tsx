"use client";

import { useEffect, useMemo, useRef } from "react";
import {
  Chart,
  CategoryScale,
  LinearScale,
  LineElement,
  PointElement,
  Tooltip,
  Filler,
  LineController
} from "chart.js";

Chart.register(
  CategoryScale,
  LinearScale,
  LineElement,
  PointElement,
  Tooltip,
  Filler,
  LineController
);

type AltitudePoint = {
  recordedAt: string;
  altitudeFeet: number | null;
  groundspeedKt?: number | null;
};

export function AltitudeChart({ points }: { points: AltitudePoint[] }) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const labels = useMemo(
    () =>
      points.map((point) =>
        new Date(point.recordedAt).toLocaleTimeString([], {
          hour: "2-digit",
          minute: "2-digit",
          hour12: false
        })
      ),
    [points]
  );

  useEffect(() => {
    if (!canvasRef.current) {
      return;
    }

    const chart = new Chart(canvasRef.current, {
      type: "line",
      data: {
        labels,
        datasets: [
          {
            label: "Altitude (ft)",
            data: points.map((point) => point.altitudeFeet),
            borderColor: "#38bdf8",
            backgroundColor: "rgba(56, 189, 248, 0.2)",
            tension: 0.3,
            pointRadius: 0,
            fill: true,
            yAxisID: "yAltitude"
          },
          {
            label: "Ground speed (kt)",
            data: points.map((point) => point.groundspeedKt ?? null),
            borderColor: "#f59e0b",
            backgroundColor: "rgba(245, 158, 11, 0.12)",
            tension: 0.3,
            pointRadius: 0,
            fill: false,
            yAxisID: "ySpeed"
          }
        ]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        scales: {
          x: {
            ticks: { color: "#94a3b8" },
            grid: { color: "rgba(148, 163, 184, 0.2)" }
          },
          yAltitude: {
            type: "linear",
            position: "left",
            ticks: { color: "#94a3b8" },
            grid: { color: "rgba(148, 163, 184, 0.2)" },
            title: {
              display: true,
              text: "Feet",
              color: "#94a3b8"
            }
          },
          ySpeed: {
            type: "linear",
            position: "right",
            ticks: { color: "#94a3b8" },
            grid: { drawOnChartArea: false },
            title: {
              display: true,
              text: "Knots",
              color: "#94a3b8"
            }
          }
        },
        plugins: {
          legend: { labels: { color: "#e2e8f0" } },
          tooltip: { enabled: true }
        }
      }
    });

    return () => chart.destroy();
  }, [labels, points]);

  return (
    <div className="h-64">
      <canvas ref={canvasRef} />
    </div>
  );
}
