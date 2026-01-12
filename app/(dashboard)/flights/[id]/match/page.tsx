import { notFound } from "next/navigation";
import Link from "next/link";
import { Card, CardContent, CardHeader } from "@/app/components/ui/card";
import { prisma } from "@/app/lib/db";
import { requireUser } from "@/app/lib/session";
import { defaultProviderName, getAdsbProvider } from "@/app/lib/adsb";
import { deriveAutoImportWindow, scoreAutoImportCandidate } from "@/app/lib/flights/auto-import";
import { dedupeImportCandidates } from "@/app/lib/flights/imports";
import { MatchClient } from "@/app/(dashboard)/flights/[id]/match/match-client";

const FOUR_HOURS_MS = 4 * 60 * 60 * 1000;
const TWENTY_FOUR_HOURS_MS = 24 * 60 * 60 * 1000;

export default async function FlightMatchPage({ params }: { params: { id: string } }) {
  const user = await requireUser();

  const flight = await prisma.flight.findFirst({
    where: { id: params.id, userId: user.id },
    include: {
      checklistRuns: {
        select: { phase: true, signedAt: true }
      }
    }
  });

  if (!flight) {
    notFound();
  }

  const tailNumber = flight.tailNumberSnapshot?.trim() || flight.tailNumber?.trim();

  if (!tailNumber) {
    return (
      <Card>
        <CardHeader>
          <p className="text-sm text-slate-400">ADS-B matching</p>
        </CardHeader>
        <CardContent className="space-y-2">
          <p className="text-sm text-slate-300">
            Flight tail number is missing. Add it to your flight details to search ADS-B
            candidates.
          </p>
          <Link href={`/flights/${flight.id}`} className="text-sm text-sky-400">
            Return to flight
          </Link>
        </CardContent>
      </Card>
    );
  }

  const window = deriveAutoImportWindow(flight);
  const provider = getAdsbProvider();
  let candidates: ReturnType<typeof dedupeImportCandidates> = [];
  try {
    // AeroAPI behavior varies by plan/key; some keys block /flights/search and some return
    // results only with different interpretations of the stored times.
    //
    // Use the same fallback strategy as auto-import:
    // - primary +/-4h around stored times
    // - offset +/-4h treating stored times as local wall-clock
    // - wide +/-24h versions of each
    const offsetMs = window.referenceStart.getTimezoneOffset() * 60 * 1000;
    const windows = [
      { label: "primary-4h", start: window.searchStart, end: window.searchEnd },
      {
        label: "offset-4h",
        start: new Date(window.referenceStart.getTime() + offsetMs - FOUR_HOURS_MS),
        end: new Date(window.referenceEnd.getTime() + offsetMs + FOUR_HOURS_MS)
      },
      {
        label: "primary-24h",
        start: new Date(window.referenceStart.getTime() - TWENTY_FOUR_HOURS_MS),
        end: new Date(window.referenceEnd.getTime() + TWENTY_FOUR_HOURS_MS)
      },
      {
        label: "offset-24h",
        start: new Date(window.referenceStart.getTime() + offsetMs - TWENTY_FOUR_HOURS_MS),
        end: new Date(window.referenceEnd.getTime() + offsetMs + TWENTY_FOUR_HOURS_MS)
      }
    ] as const;

    const merged = new Map<string, (typeof candidates)[number]>();
    for (const w of windows) {
      const found = dedupeImportCandidates(
        await provider.searchFlights(tailNumber, w.start, w.end)
      );
      for (const f of found) {
        merged.set(f.providerFlightId, f);
      }
      if (merged.size > 0) {
        break;
      }
    }

    candidates = [...merged.values()];
  } catch (error) {
    const message = error instanceof Error ? error.message : "ADS-B provider request failed.";
    return (
      <Card>
        <CardHeader>
          <p className="text-sm text-slate-400">ADS-B matching</p>
        </CardHeader>
        <CardContent className="space-y-2">
          <p className="text-sm text-slate-300">
            Unable to load ADS-B candidates right now.
          </p>
          <p className="rounded-md border border-slate-800 bg-slate-950/40 p-3 text-xs text-slate-300">
            {message}
          </p>
          <Link href={`/flights/${flight.id}`} className="text-sm text-sky-400">
            Return to flight
          </Link>
        </CardContent>
      </Card>
    );
  }

  candidates.sort(
    (a, b) =>
      scoreAutoImportCandidate(window.referenceStart, window.referenceEnd, a.startTime, a.endTime) -
      scoreAutoImportCandidate(window.referenceStart, window.referenceEnd, b.startTime, b.endTime)
  );

  const responseCandidates = candidates.map((candidate) => ({
    providerFlightId: candidate.providerFlightId,
    tailNumber: candidate.tailNumber,
    startTime: candidate.startTime.toISOString(),
    endTime: candidate.endTime.toISOString(),
    durationMinutes: candidate.durationMinutes ?? null,
    distanceNm: candidate.distanceNm ?? null,
    depLabel: candidate.depLabel,
    arrLabel: candidate.arrLabel,
    stats: candidate.stats ?? null,
    track: candidate.track.map((point) => ({
      recordedAt: point.recordedAt.toISOString(),
      latitude: point.latitude,
      longitude: point.longitude,
      altitudeFeet: point.altitudeFeet ?? null,
      groundspeedKt: point.groundspeedKt ?? null,
      headingDeg: point.headingDeg ?? null
    }))
  }));

  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <h2 className="text-2xl font-semibold">Match ADS-B flight</h2>
        <p className="text-sm text-slate-400">
          Choose the best ADS-B candidate to attach to this flight.
        </p>
      </div>

      <MatchClient
        flightId={flight.id}
        provider={defaultProviderName}
        candidates={responseCandidates}
      />
    </div>
  );
}
