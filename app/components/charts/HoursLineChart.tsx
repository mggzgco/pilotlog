"use client";

import { useEffect, useMemo, useRef } from "react";
import {
  CategoryScale,
  Chart,
  Filler,
  LineController,
  LineElement,
  LinearScale,
  PointElement,
  Tooltip
} from "chart.js";

Chart.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  LineController,
  Tooltip,
  Filler
);

export function HoursLineChart({
  labels,
  values,
  height = 200
}: {
  labels: string[];
  values: number[];
  height?: number;
}) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  const data = useMemo(() => {
    const safeLabels = labels.slice(0, values.length);
    const safeValues = values.slice(0, labels.length);
    return { labels: safeLabels, values: safeValues };
  }, [labels, values]);

  useEffect(() => {
    if (!canvasRef.current) return;
    if (data.values.length === 0) return;

    const chart = new Chart(canvasRef.current, {
      type: "line",
      data: {
        labels: data.labels,
        datasets: [
          {
            data: data.values,
            borderColor: "rgba(14,165,233,0.95)",
            backgroundColor: "rgba(14,165,233,0.12)",
            borderWidth: 2,
            pointRadius: 0,
            tension: 0.35,
            fill: true
          }
        ]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: { display: false },
          tooltip: {
            callbacks: {
              label: (ctx) => {
                const v = Number(ctx.parsed.y);
                return `${v.toFixed(1)}h`;
              }
            }
          }
        },
        scales: {
          x: {
            grid: { display: false },
            ticks: { maxTicksLimit: 6 }
          },
          y: {
            beginAtZero: true,
            grid: { color: "rgba(148,163,184,0.18)" },
            ticks: { maxTicksLimit: 5 },
            suggestedMax: Math.max(1, Math.max(...data.values) * 1.15)
          }
        }
      }
    });

    return () => chart.destroy();
  }, [data.labels, data.values]);

  const hasAny = data.values.some((v) => v > 0);
  if (!hasAny) {
    return (
      <div className="flex h-[200px] items-center justify-center rounded-lg border border-slate-200 bg-white text-sm text-slate-600 dark:border-slate-800 dark:bg-slate-950/30 dark:text-slate-400">
        No hours logged in this range.
      </div>
    );
  }

  return (
    <div className="relative" style={{ height }}>
      <canvas ref={canvasRef} />
    </div>
  );
}

