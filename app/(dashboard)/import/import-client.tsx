"use client";

import { useMemo, useState } from "react";
import { Loader2 } from "lucide-react";
import { Card, CardContent, CardHeader } from "@/app/components/ui/card";
import { Button } from "@/app/components/ui/button";
import { Input } from "@/app/components/ui/input";
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

interface SearchResponse {
  provider: string;
  flights: FlightCandidateResponse[];
}

interface ImportClientProps {
  flightId?: string | null;
}

export function ImportClient({ flightId }: ImportClientProps) {
  const [tailNumber, setTailNumber] = useState("");
  const [startTime, setStartTime] = useState("");
  const [endTime, setEndTime] = useState("");
  const [flights, setFlights] = useState<FlightCandidateResponse[]>([]);
  const [provider, setProvider] = useState<string | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [isSearching, setIsSearching] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const { addToast } = useToast();
  const isAttachMode = Boolean(flightId);

  const selectedFlight = useMemo(
    () => flights.find((flight) => flight.providerFlightId === selectedId) ?? null,
    [flights, selectedId]
  );

  async function handleSearch(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setIsSearching(true);
    setMessage(null);
    setSelectedId(null);

    try {
      const response = await fetch(
        isAttachMode ? `/api/flights/${flightId}/auto-import/search` : "/api/import/search",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: isAttachMode
            ? JSON.stringify({
                start: startTime,
                end: endTime
              })
            : JSON.stringify({
                tailNumber: tailNumber.trim(),
                start: startTime,
                end: endTime
              })
        }
      );

      if (!response.ok) {
        const payload = await response.json();
        throw new Error(payload.error ?? "Unable to search flights.");
      }

      const payload: SearchResponse = await response.json();
      setFlights(payload.flights);
      setProvider(payload.provider);
      if (payload.flights.length === 0) {
        setMessage("No flights found for that tail number and time window.");
        addToast("No flights found for that tail number and time window.", "info");
      } else {
        addToast(`Loaded ${payload.flights.length} flights.`, "success");
      }
    } catch (error) {
      const nextMessage =
        error instanceof Error ? error.message : "Unable to search flights.";
      setMessage(nextMessage);
      addToast(nextMessage, "error");
    } finally {
      setIsSearching(false);
    }
  }

  async function handleSave() {
    if (!selectedFlight || !provider) {
      return;
    }
    setIsSaving(true);
    setMessage(null);

    try {
      const response = await fetch(
        isAttachMode ? `/api/flights/${flightId}/auto-import/attach` : "/api/import/save",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(
            isAttachMode
              ? { provider, providerFlightId: selectedFlight.providerFlightId }
              : { provider, candidate: selectedFlight }
          )
        }
      );

      if (!response.ok) {
        const payload = await response.json();
        throw new Error(payload.error ?? "Unable to import flight.");
      }

      const successMessage = isAttachMode
        ? "Flight attached successfully."
        : "Flight imported successfully.";
      setMessage(successMessage);
      addToast(successMessage, "success");
    } catch (error) {
      const nextMessage =
        error instanceof Error ? error.message : "Unable to import flight.";
      setMessage(nextMessage);
      addToast(nextMessage, "error");
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-semibold">ADS-B Import</h2>
        <p className="text-sm text-slate-400">
          {isAttachMode
            ? "Search ADS-B flights to attach to this planned flight."
            : "Pull flights by tail number and time window."}
        </p>
      </div>

      <Card>
        <CardHeader>
          <p className="text-sm text-slate-400">Import criteria</p>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSearch} className="grid gap-3 md:grid-cols-3">
            {isAttachMode ? (
              <>
                <div className="md:col-span-3 text-sm text-slate-400">
                  Tail number is derived from the planned flight details.
                </div>
                <Input
                  name="start"
                  type="datetime-local"
                  value={startTime}
                  onChange={(event) => setStartTime(event.target.value)}
                  required
                />
                <Input
                  name="end"
                  type="datetime-local"
                  value={endTime}
                  onChange={(event) => setEndTime(event.target.value)}
                  required
                />
              </>
            ) : (
              <>
                <Input
                  name="tailNumber"
                  placeholder="Tail # (e.g. N12345)"
                  value={tailNumber}
                  onChange={(event) => setTailNumber(event.target.value)}
                  required
                />
                <Input
                  name="start"
                  type="datetime-local"
                  value={startTime}
                  onChange={(event) => setStartTime(event.target.value)}
                  required
                />
                <Input
                  name="end"
                  type="datetime-local"
                  value={endTime}
                  onChange={(event) => setEndTime(event.target.value)}
                  required
                />
              </>
            )}
            <div className="md:col-span-3">
              <Button type="submit" disabled={isSearching}>
                {isSearching ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Searching...
                  </>
                ) : (
                  "Search flights"
                )}
              </Button>
            </div>
          </form>
          <p className="mt-4 text-xs text-slate-500">
            Mock provider returns sample flights for tail number N12345.
          </p>
          {message && <p className="mt-2 text-sm text-slate-300">{message}</p>}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <p className="text-sm text-slate-400">Available flights</p>
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
                {flights.length === 0 ? (
                  <tr>
                    <td className="px-4 py-4 text-sm text-slate-500" colSpan={4}>
                      No flights loaded yet.
                    </td>
                  </tr>
                ) : (
                  flights.map((flight) => (
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
          <p className="text-sm text-slate-400">Preview</p>
        </CardHeader>
        <CardContent className="space-y-4">
          {selectedFlight ? (
            <>
              <div className="grid gap-4 md:grid-cols-4">
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
                <div>
                  <p className="text-xs uppercase text-slate-400">Max speed</p>
                  <p className="text-lg font-semibold">
                    {selectedFlight.stats?.maxGroundspeedKt ?? "--"} kt
                  </p>
                </div>
              </div>
              <div className="h-72">
                <FlightMap track={selectedFlight.track} />
              </div>
              <Button onClick={handleSave} disabled={isSaving}>
                {isSaving ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Saving...
                  </>
                ) : (
                  isAttachMode ? "Attach flight" : "Save flight"
                )}
              </Button>
            </>
          ) : (
            <p className="text-sm text-slate-500">
              Select a flight above to preview the track and stats.
            </p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
