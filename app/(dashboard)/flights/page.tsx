import Link from "next/link";
import { Prisma } from "@prisma/client";
import { prisma } from "@/app/lib/db";
import { requireUser } from "@/app/lib/auth/session";
import { createFlightAction } from "@/app/lib/actions/flight-actions";
import { Card, CardContent, CardHeader } from "@/app/components/ui/card";
import { Button } from "@/app/components/ui/button";
import { Input } from "@/app/components/ui/input";

type FlightsSearchParams = {
  tailNumber?: string;
  startDate?: string;
  endDate?: string;
  tags?: string;
};

function parseTags(value?: string) {
  if (!value) {
    return [];
  }

  return value
    .split(",")
    .map((tag) => tag.trim())
    .filter(Boolean);
}

function getStatsTags(statsJson: Prisma.JsonValue | null): string[] {
  if (!statsJson || typeof statsJson !== "object" || Array.isArray(statsJson)) {
    return [];
  }

  const tags = (statsJson as Record<string, unknown>).tags;
  if (Array.isArray(tags)) {
    return tags.filter((tag): tag is string => typeof tag === "string");
  }

  if (typeof tags === "string") {
    return tags
      .split(",")
      .map((tag) => tag.trim())
      .filter(Boolean);
  }

  return [];
}

function getSearchParam(
  value?: string | string[]
): string {
  if (Array.isArray(value)) {
    return value[0] ?? "";
  }

  return value ?? "";
}

export default async function FlightsPage({
  searchParams
}: {
  searchParams?: FlightsSearchParams & { [key: string]: string | string[] };
}) {
  const user = await requireUser();
  const tailNumber = getSearchParam(searchParams?.tailNumber).trim();
  const startDate = getSearchParam(searchParams?.startDate).trim();
  const endDate = getSearchParam(searchParams?.endDate).trim();
  const tags = parseTags(getSearchParam(searchParams?.tags));
  const parsedStartDate = startDate ? new Date(startDate) : null;
  const parsedEndDate = endDate ? new Date(`${endDate}T23:59:59.999Z`) : null;
  const startDateValue =
    parsedStartDate && !Number.isNaN(parsedStartDate.getTime())
      ? parsedStartDate
      : null;
  const endDateValue =
    parsedEndDate && !Number.isNaN(parsedEndDate.getTime())
      ? parsedEndDate
      : null;
  const dateRange =
    startDateValue || endDateValue
      ? {
          startTime: {
            ...(startDateValue ? { gte: startDateValue } : {}),
            ...(endDateValue ? { lte: endDateValue } : {})
          }
        }
      : {};

  const flights = await prisma.flight.findMany({
    where: {
      userId: user.id,
      ...(tailNumber
        ? { tailNumber: { contains: tailNumber, mode: "insensitive" } }
        : {}),
      ...dateRange
    },
    orderBy: { startTime: "desc" },
    include: {
      costItems: { select: { amountCents: true } },
      logbookEntries: { select: { remarks: true } }
    }
  });

  const normalizedTags = tags.map((tag) => tag.toLowerCase());
  const filteredFlights =
    normalizedTags.length === 0
      ? flights
      : flights.filter((flight) => {
          const statsTags = getStatsTags(flight.statsJson).map((tag) =>
            tag.toLowerCase()
          );
          const remarkTags = flight.logbookEntries
            .flatMap((entry) =>
              entry.remarks ? entry.remarks.split(/[,#]/) : []
            )
            .map((tag) => tag.trim())
            .filter(Boolean)
            .map((tag) => tag.toLowerCase());
          const tagPool = new Set([...statsTags, ...remarkTags]);
          return normalizedTags.every((tag) =>
            Array.from(tagPool).some((value) => value.includes(tag))
          );
        });

  const currencyFormatter = new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD"
  });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-semibold">Flights</h2>
          <p className="text-sm text-slate-400">Track route, time, and status.</p>
        </div>
        <Button asChild>
          <Link href="/import">Import ADS-B</Link>
        </Button>
      </div>

      <Card>
        <CardHeader>
          <p className="text-sm text-slate-400">Search flights</p>
        </CardHeader>
        <CardContent>
          <form method="get" className="grid gap-3 md:grid-cols-4">
            <Input
              name="tailNumber"
              placeholder="Tail number"
              defaultValue={tailNumber}
            />
            <Input
              name="startDate"
              type="date"
              placeholder="Start date"
              defaultValue={startDate}
            />
            <Input
              name="endDate"
              type="date"
              placeholder="End date"
              defaultValue={endDate}
            />
            <Input
              name="tags"
              placeholder="Tags (comma separated)"
              defaultValue={getSearchParam(searchParams?.tags)}
            />
            <div className="flex flex-wrap gap-2 md:col-span-4">
              <Button type="submit">Search</Button>
              <Button variant="outline" asChild>
                <Link href="/flights">Reset</Link>
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <p className="text-sm text-slate-400">Add manual flight</p>
        </CardHeader>
        <CardContent>
          <form action={createFlightAction} className="grid gap-3 md:grid-cols-3">
            <Input name="tailNumber" placeholder="Tail #" required />
            <Input name="origin" placeholder="Origin (ICAO)" required />
            <Input name="destination" placeholder="Destination (ICAO)" />
            <Input name="startTime" type="datetime-local" required />
            <Input name="endTime" type="datetime-local" />
            <Input name="durationMinutes" type="number" placeholder="Duration (mins)" />
            <div className="md:col-span-3">
              <Button type="submit">Save flight</Button>
            </div>
          </form>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <p className="text-sm text-slate-400">Recent flights</p>
        </CardHeader>
        <CardContent>
          <div className="overflow-hidden rounded-lg border border-slate-800">
            <table className="w-full text-sm">
              <thead className="bg-slate-900 text-xs uppercase text-slate-500">
                <tr>
                  <th className="px-4 py-3 text-left font-medium">Date</th>
                  <th className="px-4 py-3 text-left font-medium">Tail</th>
                  <th className="px-4 py-3 text-left font-medium">Route</th>
                  <th className="px-4 py-3 text-right font-medium">
                    Duration
                  </th>
                  <th className="px-4 py-3 text-right font-medium">
                    Distance
                  </th>
                  <th className="px-4 py-3 text-right font-medium">Cost</th>
                  <th className="px-4 py-3 text-right font-medium">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800">
                {filteredFlights.length === 0 ? (
                  <tr>
                    <td
                      className="px-4 py-4 text-sm text-slate-500"
                      colSpan={7}
                    >
                      No flights yet.
                    </td>
                  </tr>
                ) : (
                  filteredFlights.map((flight) => {
                    const costTotalCents = flight.costItems.reduce(
                      (total, item) => total + item.amountCents,
                      0
                    );

                    return (
                      <tr key={flight.id} className="text-slate-200">
                        <td className="px-4 py-3 text-slate-400">
                          {flight.startTime.toLocaleDateString()}
                        </td>
                        <td className="px-4 py-3">{flight.tailNumber}</td>
                        <td className="px-4 py-3">
                          {flight.origin} → {flight.destination ?? "TBD"}
                        </td>
                        <td className="px-4 py-3 text-right text-slate-400">
                          {flight.durationMinutes ?? "--"} mins
                        </td>
                        <td className="px-4 py-3 text-right text-slate-400">
                          {flight.distanceNm ?? "--"} nm
                        </td>
                        <td className="px-4 py-3 text-right text-slate-400">
                          {costTotalCents > 0
                            ? currencyFormatter.format(costTotalCents / 100)
                            : "--"}
                        </td>
                        <td className="px-4 py-3 text-right">
                          <Button size="sm" variant="outline" asChild>
                            <Link href={`/flights/${flight.id}`}>Details</Link>
                          </Button>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
