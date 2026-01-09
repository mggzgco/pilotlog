import { notFound } from "next/navigation";
import Link from "next/link";
import { Card, CardContent, CardHeader } from "@/app/components/ui/card";
import { prisma } from "@/app/lib/db";
import { requireUser } from "@/app/lib/session";
import { defaultProviderName, getAdsbProvider } from "@/app/lib/adsb";
import { deriveAutoImportWindow, scoreAutoImportCandidate } from "@/app/lib/flights/auto-import";
import { dedupeImportCandidates } from "@/app/lib/flights/imports";
import { MatchClient } from "@/app/(dashboard)/flights/[id]/match/match-client";

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
  const candidates = dedupeImportCandidates(
    await provider.searchFlights(tailNumber, window.searchStart, window.searchEnd)
  );

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
