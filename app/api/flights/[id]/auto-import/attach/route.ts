import { NextResponse } from "next/server";
import { z } from "zod";
import { validateRequestCsrf } from "@/app/lib/auth/csrf";
import { getCurrentUser } from "@/app/lib/auth/session";
import { prisma } from "@/app/lib/db";
import { defaultProviderName, getAdsbProvider } from "@/app/lib/adsb";
import { dedupeImportCandidates } from "@/app/lib/flights/imports";
import { attachAdsbCandidateToFlight, deriveAutoImportWindow } from "@/app/lib/flights/auto-import";
import { recordAuditEvent } from "@/app/lib/audit";
import { handleApiError } from "@/src/lib/security/errors";
import { saveFlightWeatherSnapshot } from "@/app/lib/weather/snapshot";

const FOUR_HOURS_MS = 4 * 60 * 60 * 1000;
const TWENTY_FOUR_HOURS_MS = 24 * 60 * 60 * 1000;

const attachSchema = z.object({
  provider: z.string().min(1),
  providerFlightId: z.string().min(1)
});

export async function POST(
  request: Request,
  { params }: { params: { id: string } }
) {
  try {
    const csrf = validateRequestCsrf(request);
  if (!csrf.ok) {
    return NextResponse.json({ error: csrf.error ?? "CSRF validation failed." }, { status: 403 });
  }

    const { user, session } = await getCurrentUser();
    if (!user || !session || user.status !== "ACTIVE") {
      return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
    }

    const payload = await request.json().catch(() => null);
    const parsed = attachSchema.safeParse(payload);
    if (!parsed.success) {
      return NextResponse.json({ error: "Invalid flight selection." }, { status: 400 });
    }

    const { provider, providerFlightId } = parsed.data;
    if (provider !== defaultProviderName) {
      return NextResponse.json({ error: "Unsupported ADS-B provider." }, { status: 400 });
    }

    const flight = await prisma.flight.findFirst({
      where: { id: params.id, userId: user.id },
      include: {
        checklistRuns: {
          select: { phase: true, signedAt: true }
        }
      }
    });

    if (!flight) {
      return NextResponse.json({ error: "Flight not found." }, { status: 404 });
    }

    const existing = await prisma.flight.findFirst({
      where: {
        userId: user.id,
        importedProvider: provider,
        providerFlightId,
        NOT: { id: flight.id }
      }
    });

    if (existing) {
      return NextResponse.json(
        { error: "That ADS-B flight is already attached to another flight." },
        { status: 409 }
      );
    }

    const tailNumber = flight.tailNumberSnapshot?.trim() || flight.tailNumber?.trim();
    if (!tailNumber) {
      return NextResponse.json(
        { error: "Flight tail number is missing." },
        { status: 400 }
      );
    }

    const window = deriveAutoImportWindow(flight);
    const providerClient = getAdsbProvider();
    // Use the same multi-window fallback as the match page. The match UI may have found
    // candidates using offset/wider windows; the attach endpoint needs to be able to
    // re-locate that same candidate.
    const offsetMs = window.referenceStart.getTimezoneOffset() * 60 * 1000;
    const windows = [
      { start: window.searchStart, end: window.searchEnd },
      {
        start: new Date(window.referenceStart.getTime() + offsetMs - FOUR_HOURS_MS),
        end: new Date(window.referenceEnd.getTime() + offsetMs + FOUR_HOURS_MS)
      },
      {
        start: new Date(window.referenceStart.getTime() - TWENTY_FOUR_HOURS_MS),
        end: new Date(window.referenceEnd.getTime() + TWENTY_FOUR_HOURS_MS)
      },
      {
        start: new Date(window.referenceStart.getTime() + offsetMs - TWENTY_FOUR_HOURS_MS),
        end: new Date(window.referenceEnd.getTime() + offsetMs + TWENTY_FOUR_HOURS_MS)
      }
    ] as const;

    const merged = new Map<string, any>();
    for (const w of windows) {
      const found = dedupeImportCandidates(
        await providerClient.searchFlights(tailNumber, w.start, w.end)
      );
      for (const c of found) {
        merged.set(c.providerFlightId, c);
      }
      if (merged.size > 0) break;
    }
    const candidates = [...merged.values()];
    const match = candidates.find(
      (candidate) => candidate.providerFlightId === providerFlightId
    );

    if (!match) {
      return NextResponse.json(
        { error: "Selected ADS-B flight was not found." },
        { status: 404 }
      );
    }

    const updated = await attachAdsbCandidateToFlight({
      flight,
      userId: user.id,
      provider,
      candidate: match
    });

    // Capture and persist weather (historical METAR lookup around the flight time).
    // Best-effort: failure should not block the attach flow.
    saveFlightWeatherSnapshot({ flightId: updated.id }).catch(() => {});

    if (flight.autoImportStatus === "AMBIGUOUS" || flight.autoImportStatus === "RUNNING") {
      await recordAuditEvent({
        userId: user.id,
        action: "adsb_auto_import_matched",
        entityType: "Flight",
        entityId: flight.id,
        metadata: { providerFlightId }
      });
    }

    return NextResponse.json({ id: updated.id });
  } catch (error) {
    return handleApiError(error, "auto-import.attach");
  }
}
