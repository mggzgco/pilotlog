"use client";

import { useEffect, useMemo, useRef } from "react";
import {
  ArcElement,
  Chart,
  DoughnutController,
  Legend,
  Tooltip
} from "chart.js";

Chart.register(ArcElement, Tooltip, Legend, DoughnutController);

export type CostPieSlice = {
  label: string;
  valueCents: number;
  color: string;
};

export function CostPieChart({
  slices,
  height = 220
}: {
  slices: CostPieSlice[];
  height?: number;
}) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  const data = useMemo(() => {
    const filtered = slices.filter((s) => s.valueCents > 0);
    return {
      labels: filtered.map((s) => s.label),
      values: filtered.map((s) => s.valueCents / 100),
      colors: filtered.map((s) => s.color)
    };
  }, [slices]);

  useEffect(() => {
    if (!canvasRef.current) return;
    if (data.values.length === 0) return;

    const chart = new Chart(canvasRef.current, {
      type: "doughnut",
      data: {
        labels: data.labels,
        datasets: [
          {
            data: data.values,
            backgroundColor: data.colors,
            borderWidth: 0
          }
        ]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        cutout: "62%",
        plugins: {
          legend: { display: false },
          tooltip: {
            callbacks: {
              label: (ctx) => {
                const label = ctx.label ?? "Category";
                const value = Number(ctx.parsed);
                const dollars = value.toLocaleString(undefined, {
                  style: "currency",
                  currency: "USD"
                });
                return `${label}: ${dollars}`;
              }
            }
          }
        }
      }
    });

    return () => chart.destroy();
  }, [data.labels, data.values, data.colors]);

  if (data.values.length === 0) {
    return (
      <div className="flex h-[220px] items-center justify-center rounded-lg border border-slate-200 bg-white text-sm text-slate-600 dark:border-slate-800 dark:bg-slate-950/30 dark:text-slate-400">
        No costs logged this month.
      </div>
    );
  }

  return (
    <div className="relative" style={{ height }}>
      <canvas ref={canvasRef} />
    </div>
  );
}

