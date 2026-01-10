"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";
import { Button } from "@/app/components/ui/button";
import { Card, CardContent, CardHeader } from "@/app/components/ui/card";
import { FlightMap } from "@/app/components/maps/flight-map";
import { useToast } from "@/app/components/ui/toast-provider";

interface FlightTrackPointResponse {
  recordedAt: string;
  latitude: number;
  longitude: number;
  altitudeFeet?: number | null;
  groundspeedKt?: number | null;
  headingDeg?: number | null;
}

interface FlightStatsResponse {
  maxAltitudeFeet?: number | null;
  maxGroundspeedKt?: number | null;
}

interface FlightCandidateResponse {
  providerFlightId: string;
  tailNumber: string;
  startTime: string;
  endTime: string;
  durationMinutes?: number | null;
  distanceNm?: number | null;
  depLabel: string;
  arrLabel: string;
  stats?: FlightStatsResponse | null;
  track: FlightTrackPointResponse[];
}

interface MatchClientProps {
  flightId: string;
  provider: string;
  candidates: FlightCandidateResponse[];
}

export function MatchClient({ flightId, provider, candidates }: MatchClientProps) {
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const { addToast } = useToast();
  const router = useRouter();

  const selectedFlight = useMemo(
    () => candidates.find((flight) => flight.providerFlightId === selectedId) ?? null,
    [candidates, selectedId]
  );

  async function handleAttach() {
    if (!selectedFlight) {
      return;
    }

    setIsSaving(true);

    try {
      const response = await fetch(`/api/flights/${flightId}/auto-import/attach`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          provider,
          providerFlightId: selectedFlight.providerFlightId
        })
      });

      if (!response.ok) {
        const payload = await response.json();
        throw new Error(payload.error ?? "Unable to attach ADS-B flight.");
      }

      addToast("ADS-B data imported. Please complete your logbook entry.", "success");
      router.push(`/flights/${flightId}?adsbImport=matched`);
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Unable to attach ADS-B flight.";
      addToast(message, "error");
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <p className="text-sm text-slate-400">Candidate flights</p>
        </CardHeader>
        <CardContent>
          <div className="overflow-hidden rounded-lg border border-slate-800">
            <table className="w-full text-sm">
              <thead className="bg-slate-900 text-xs uppercase text-slate-500">
                <tr>
                  <th className="px-4 py-3 text-left font-medium">Route</th>
                  <th className="px-4 py-3 text-left font-medium">Start</th>
                  <th className="px-4 py-3 text-left font-medium">Duration</th>
                  <th className="px-4 py-3 text-right font-medium">Select</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800">
                {candidates.length === 0 ? (
                  <tr>
                    <td className="px-4 py-4 text-sm text-slate-500" colSpan={4}>
                      No ADS-B candidates found.
                    </td>
                  </tr>
                ) : (
                  candidates.map((flight) => (
                    <tr key={flight.providerFlightId} className="text-slate-200">
                      <td className="px-4 py-3">
                        {flight.depLabel} → {flight.arrLabel}
                      </td>
                      <td className="px-4 py-3 text-slate-400">
                        {new Date(flight.startTime).toLocaleString()}
                      </td>
                      <td className="px-4 py-3 text-slate-400">
                        {flight.durationMinutes ?? "--"} mins
                      </td>
                      <td className="px-4 py-3 text-right">
                        <Button
                          size="sm"
                          variant={selectedId === flight.providerFlightId ? "default" : "outline"}
                          onClick={() => setSelectedId(flight.providerFlightId)}
                        >
                          {selectedId === flight.providerFlightId ? "Selected" : "Select"}
                        </Button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <p className="text-sm text-slate-400">Selected flight</p>
        </CardHeader>
        <CardContent className="space-y-4">
          {selectedFlight ? (
            <>
              <div className="grid gap-4 lg:grid-cols-4">
                <div>
                  <p className="text-xs uppercase text-slate-400">Route</p>
                  <p className="text-lg font-semibold">
                    {selectedFlight.depLabel} → {selectedFlight.arrLabel}
                  </p>
                </div>
                <div>
                  <p className="text-xs uppercase text-slate-400">Duration</p>
                  <p className="text-lg font-semibold">
                    {selectedFlight.durationMinutes ?? "--"} mins
                  </p>
                </div>
                <div>
                  <p className="text-xs uppercase text-slate-400">Distance</p>
                  <p className="text-lg font-semibold">
                    {selectedFlight.distanceNm ?? "--"} nm
                  </p>
                </div>
                <div>
                  <p className="text-xs uppercase text-slate-400">Max altitude</p>
                  <p className="text-lg font-semibold">
                    {selectedFlight.stats?.maxAltitudeFeet ?? "--"} ft
                  </p>
                </div>
              </div>
              <div className="h-72">
                <FlightMap track={selectedFlight.track} />
              </div>
              <Button onClick={handleAttach} disabled={isSaving}>
                {isSaving ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Attaching...
                  </>
                ) : (
                  "Attach"
                )}
              </Button>
            </>
          ) : (
            <p className="text-sm text-slate-500">
              Select a flight above to preview the track and attach it.
            </p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
