"use client";

import { useMemo, useState } from "react";
import { Button } from "@/app/components/ui/button";

type SyncResult = {
  ok: boolean;
  error?: string;
  stats?: {
    logtenCount: number;
    pilotlogCount: number;
    missingInPilotlog: number;
    missingInLogten: number;
  };
  missingInPilotlog?: any[];
  missingInLogten?: any[];
};

export function LogTenSyncClient() {
  const [file, setFile] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<SyncResult | null>(null);

  const missingPilotlogRows = result?.missingInPilotlog ?? [];
  const missingInLogten = result?.missingInLogten ?? [];

  const missingInLogtenIds = useMemo(
    () => missingInLogten.map((r: any) => r.id).filter(Boolean),
    [missingInLogten]
  );

  async function runSync() {
    if (!file) return;
    setBusy(true);
    setResult(null);
    try {
      const fd = new FormData();
      fd.set("file", file);
      const res = await fetch("/api/logten/sync", { method: "POST", body: fd });
      const json = await res.json();
      setResult(json);
    } finally {
      setBusy(false);
    }
  }

  async function importMissing() {
    if (!result?.missingInPilotlog?.length) return;
    setBusy(true);
    try {
      const res = await fetch("/api/logten/import", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ rows: result.missingInPilotlog })
      });
      const json = await res.json();
      alert(`Imported ${json.imported} (skipped ${json.skipped}).`);
    } finally {
      setBusy(false);
    }
  }

  async function downloadExportForLogTen() {
    if (!missingInLogtenIds.length) return;
    setBusy(true);
    try {
      const res = await fetch("/api/logten/export", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ ids: missingInLogtenIds })
      });
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = "pilotlog-logten-export.csv";
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-4">
      <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-950/40">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-sm font-semibold">Upload a LogTen export</p>
            <p className="text-sm text-slate-600 dark:text-slate-400">
              Export from LogTen (CSV/TSV). FlightTraks will compare entries and show what’s missing on each side.
            </p>
          </div>
          <div className="flex gap-2">
            <Button onClick={runSync} disabled={!file || busy}>
              {busy ? "Syncing..." : "Sync"}
            </Button>
          </div>
        </div>

        <div className="mt-4">
          <input
            type="file"
            accept=".csv,.tsv,.txt,text/csv,text/tab-separated-values,text/plain"
            onChange={(e) => setFile(e.target.files?.[0] ?? null)}
          />
        </div>
      </div>

      {result?.error ? (
        <div className="rounded-xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-800 dark:border-rose-500/30 dark:bg-rose-500/10 dark:text-rose-200">
          {result.error}
        </div>
      ) : null}

      {result?.stats ? (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {[
            { label: "LogTen rows", value: result.stats.logtenCount },
            { label: "FlightTraks entries", value: result.stats.pilotlogCount },
            { label: "Missing in FlightTraks", value: result.stats.missingInPilotlog },
            { label: "Missing in LogTen", value: result.stats.missingInLogten }
          ].map((card) => (
            <div
              key={card.label}
              className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-950/40"
            >
              <p className="text-xs font-semibold uppercase text-slate-500 dark:text-slate-400">
                {card.label}
              </p>
              <p className="mt-1 text-2xl font-semibold">{card.value}</p>
            </div>
          ))}
        </div>
      ) : null}

      {result?.stats ? (
        <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-950/40">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-sm font-semibold">Actions</p>
            <div className="flex flex-wrap gap-2">
              <Button
                variant="outline"
                onClick={importMissing}
                disabled={busy || missingPilotlogRows.length === 0}
              >
                Import missing from LogTen ({missingPilotlogRows.length})
              </Button>
              <Button
                variant="outline"
                onClick={downloadExportForLogTen}
                disabled={busy || missingInLogtenIds.length === 0}
              >
                Download for LogTen import ({missingInLogtenIds.length})
              </Button>
            </div>
          </div>

          <div className="mt-4 grid gap-6 lg:grid-cols-2">
            <div>
              <p className="text-xs font-semibold uppercase text-slate-500 dark:text-slate-400">
                Missing in FlightTraks (from LogTen)
              </p>
              <div className="mt-2 space-y-2">
                {missingPilotlogRows.slice(0, 8).map((r: any) => (
                  <div
                    key={r.fingerprint}
                    className="rounded-lg border border-slate-200 bg-white p-3 text-sm dark:border-slate-800 dark:bg-slate-950/30"
                  >
                    <div className="font-semibold">
                      {r.origin} → {r.destination || "—"}
                    </div>
                    <div className="text-xs text-slate-600 dark:text-slate-400">
                      {r.date} · {r.tailNumberSnapshot}
                      {r.timeOut ? ` · out ${r.timeOut}` : ""}
                      {r.timeIn ? ` · in ${r.timeIn}` : ""}
                    </div>
                  </div>
                ))}
                {missingPilotlogRows.length > 8 ? (
                  <p className="text-xs text-slate-500">Showing first 8…</p>
                ) : null}
              </div>
            </div>
            <div>
              <p className="text-xs font-semibold uppercase text-slate-500 dark:text-slate-400">
                Missing in LogTen (from FlightTraks)
              </p>
              <div className="mt-2 space-y-2">
                {missingInLogten.slice(0, 8).map((r: any) => (
                  <div
                    key={r.fingerprint}
                    className="rounded-lg border border-slate-200 bg-white p-3 text-sm dark:border-slate-800 dark:bg-slate-950/30"
                  >
                    <div className="font-semibold">
                      {r.origin} → {r.destination || "—"}
                    </div>
                    <div className="text-xs text-slate-600 dark:text-slate-400">
                      {r.date} · {r.tailNumberSnapshot}
                      {r.timeOut ? ` · out ${r.timeOut}` : ""}
                      {r.timeIn ? ` · in ${r.timeIn}` : ""}
                    </div>
                  </div>
                ))}
                {missingInLogten.length > 8 ? (
                  <p className="text-xs text-slate-500">Showing first 8…</p>
                ) : null}
              </div>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}

