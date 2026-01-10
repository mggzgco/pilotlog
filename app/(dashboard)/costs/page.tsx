import Link from "next/link";
import type { Prisma } from "@prisma/client";
import { prisma } from "@/app/lib/db";
import { requireUser } from "@/app/lib/auth/session";
import { Card, CardContent, CardHeader } from "@/app/components/ui/card";
import { Button } from "@/app/components/ui/button";
import { Input } from "@/app/components/ui/input";
import { CollapsibleCard } from "@/app/components/ui/collapsible-card";
import { CreateCostModal } from "@/app/components/costs/create-cost-modal";
import {
  costCategoryOptions,
  costCategoryValues,
  getCostCategoryLabel
} from "@/app/lib/costs/categories";
import { ALLOWED_RECEIPT_MIME_TYPES } from "@/app/lib/storage";

type CostsSearchParams = {
  startDate?: string;
  endDate?: string;
  category?: string;
  aircraft?: string;
  flightId?: string;
};

const formatRoute = (origin?: string | null, destination?: string | null) => {
  if (!origin && !destination) {
    return "—";
  }
  if (!destination) {
    return origin ?? "—";
  }
  return `${origin ?? "—"} → ${destination}`;
};

const normalizeDateInput = (value?: string) => {
  if (!value) {
    return "";
  }
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return "";
  }
  return value;
};

export default async function CostsPage({
  searchParams
}: {
  searchParams?: CostsSearchParams;
}) {
  const user = await requireUser();

  const startDate = normalizeDateInput(searchParams?.startDate?.trim());
  const endDate = normalizeDateInput(searchParams?.endDate?.trim());
  const categoryFilter = searchParams?.category?.trim() || "";
  const normalizedCategoryFilter = categoryFilter.toLowerCase();
  const resolvedCategoryFilter = costCategoryValues.includes(
    normalizedCategoryFilter as (typeof costCategoryValues)[number]
  )
    ? normalizedCategoryFilter
    : categoryFilter;
  const aircraftFilter = searchParams?.aircraft?.trim() || "";
  const flightIdFilter = searchParams?.flightId?.trim() || "";

  const flights = await prisma.flight.findMany({
    where: { userId: user.id },
    orderBy: { startTime: "desc" },
    select: {
      id: true,
      origin: true,
      destination: true,
      startTime: true,
      tailNumber: true,
      tailNumberSnapshot: true,
      aircraft: { select: { tailNumber: true, model: true } }
    }
  });

  const aircraftOptions = Array.from(
    new Set(
      flights
        .map((flight) =>
          flight.tailNumberSnapshot ||
          flight.aircraft?.tailNumber ||
          flight.tailNumber
        )
        .filter(Boolean)
    )
  ).sort();

  const now = new Date();
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
  const yearStart = new Date(now.getFullYear(), 0, 1);

  const [monthSummary, yearSummary, allTimeSummary] = await Promise.all([
    prisma.costItem.aggregate({
      where: { userId: user.id, date: { gte: monthStart } },
      _sum: { amountCents: true },
      _count: true
    }),
    prisma.costItem.aggregate({
      where: { userId: user.id, date: { gte: yearStart } },
      _sum: { amountCents: true },
      _count: true
    }),
    prisma.costItem.aggregate({
      where: { userId: user.id },
      _sum: { amountCents: true },
      _count: true
    })
  ]);

  const andFilters: Prisma.CostItemWhereInput[] = [];
  const startDateValue = startDate ? new Date(startDate) : null;
  const endDateValue = endDate ? new Date(endDate) : null;
  if (endDateValue) {
    endDateValue.setHours(23, 59, 59, 999);
  }

  if (startDateValue || endDateValue) {
    andFilters.push({
      date: {
        ...(startDateValue ? { gte: startDateValue } : {}),
        ...(endDateValue ? { lte: endDateValue } : {})
      }
    });
  }

  if (resolvedCategoryFilter) {
    andFilters.push({
      category: { equals: resolvedCategoryFilter, mode: "insensitive" }
    });
  }

  if (flightIdFilter) {
    andFilters.push({ flightId: flightIdFilter });
  }

  if (aircraftFilter) {
    andFilters.push({
      flight: {
        is: {
          OR: [
            { tailNumber: aircraftFilter },
            { tailNumberSnapshot: aircraftFilter },
            { aircraft: { tailNumber: aircraftFilter } }
          ]
        }
      }
    });
  }

  const costs = await prisma.costItem.findMany({
    where: {
      userId: user.id,
      ...(andFilters.length > 0 ? { AND: andFilters } : {})
    },
    orderBy: { date: "desc" },
    include: {
      receipts: { orderBy: { createdAt: "desc" } },
      flight: {
        select: {
          id: true,
          origin: true,
          destination: true,
          startTime: true,
          tailNumber: true,
          tailNumberSnapshot: true,
          aircraft: { select: { tailNumber: true, model: true } },
          logbookEntries: { select: { id: true } }
        }
      }
    }
  });

  const currencyFormatter = new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD"
  });

  const selectedFlightForEntry = flights.find((flight) => flight.id === flightIdFilter);
  const defaultEntryDate = selectedFlightForEntry
    ? selectedFlightForEntry.startTime.toISOString().slice(0, 10)
    : new Date().toISOString().slice(0, 10);

  const receiptAccept = Object.keys(ALLOWED_RECEIPT_MIME_TYPES).join(",");
  const filtersDefaultOpen = Boolean(
    startDate || endDate || resolvedCategoryFilter || aircraftFilter || flightIdFilter
  );

  const flightOptions = flights.map((flight) => {
    const tailNumber =
      flight.tailNumberSnapshot ||
      flight.aircraft?.tailNumber ||
      flight.tailNumber;
    const label = `${tailNumber} · ${formatRoute(flight.origin, flight.destination)} · ${flight.startTime
      .toISOString()
      .slice(0, 10)}`;
    return { id: flight.id, label };
  });

  return (
    <div className="space-y-6">
      <div>
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h2 className="text-2xl font-semibold">Costs</h2>
            <p className="text-sm text-slate-600 dark:text-slate-400">
              Track receipts and training spend.
            </p>
          </div>
          <CreateCostModal
            flights={flightOptions}
            defaultFlightId={flightIdFilter}
            defaultDate={defaultEntryDate}
            receiptAccept={receiptAccept}
            triggerLabel="Add expense"
          />
        </div>
      </div>

      <Card>
        <CardHeader>
          <p className="text-sm text-slate-600 dark:text-slate-400">Totals</p>
        </CardHeader>
        <CardContent>
          <div className="grid gap-3 sm:grid-cols-3">
            {[
              {
                label: "This month",
                total: monthSummary._sum.amountCents ?? 0,
                count: monthSummary._count
              },
              {
                label: "Year to date",
                total: yearSummary._sum.amountCents ?? 0,
                count: yearSummary._count
              },
              {
                label: "All time",
                total: allTimeSummary._sum.amountCents ?? 0,
                count: allTimeSummary._count
              }
            ].map((summary) => (
              <div
                key={summary.label}
                className="rounded-lg border border-slate-200 bg-white px-4 py-3 shadow-sm dark:border-slate-800 dark:bg-slate-950/30"
              >
                <p className="text-xs font-semibold uppercase text-slate-500 dark:text-slate-400">
                  {summary.label}
                </p>
                <p className="text-lg font-semibold text-slate-900 dark:text-slate-100">
                  {currencyFormatter.format(summary.total / 100)}
                </p>
                <p className="text-xs text-slate-500">{summary.count} costs</p>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      <CollapsibleCard title="Filters" defaultOpen={filtersDefaultOpen}>
        <form method="get" className="grid gap-3 lg:grid-cols-5">
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
            <select
              name="category"
              defaultValue={resolvedCategoryFilter}
              className="h-11 rounded-md border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 shadow-sm outline-none focus-visible:ring-2 focus-visible:ring-brand-500 focus-visible:ring-offset-2 focus-visible:ring-offset-white dark:border-slate-800 dark:bg-slate-950 dark:text-slate-100 dark:focus-visible:ring-offset-slate-950"
            >
              <option value="">All categories</option>
              {costCategoryOptions.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
            <select
              name="aircraft"
              defaultValue={aircraftFilter}
              className="h-11 rounded-md border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 shadow-sm outline-none focus-visible:ring-2 focus-visible:ring-brand-500 focus-visible:ring-offset-2 focus-visible:ring-offset-white dark:border-slate-800 dark:bg-slate-950 dark:text-slate-100 dark:focus-visible:ring-offset-slate-950"
            >
              <option value="">All aircraft</option>
              {aircraftOptions.map((tailNumber) => (
                <option key={tailNumber} value={tailNumber}>
                  {tailNumber}
                </option>
              ))}
            </select>
            <select
              name="flightId"
              defaultValue={flightIdFilter}
              className="h-11 rounded-md border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 shadow-sm outline-none focus-visible:ring-2 focus-visible:ring-brand-500 focus-visible:ring-offset-2 focus-visible:ring-offset-white dark:border-slate-800 dark:bg-slate-950 dark:text-slate-100 dark:focus-visible:ring-offset-slate-950"
            >
              <option value="">All flights</option>
              {flights.map((flight) => {
                const tailNumber =
                  flight.tailNumberSnapshot ||
                  flight.aircraft?.tailNumber ||
                  flight.tailNumber;
                const label = `${tailNumber} · ${formatRoute(
                  flight.origin,
                  flight.destination
                )} · ${flight.startTime.toISOString().slice(0, 10)}`;
                return (
                  <option key={flight.id} value={flight.id}>
                    {label}
                  </option>
                );
              })}
            </select>
            <div className="lg:col-span-5 flex flex-wrap gap-2">
              <Button type="submit" variant="outline">
                Apply filters
              </Button>
              <Button asChild variant="ghost">
                <Link href="/costs">Reset</Link>
              </Button>
            </div>
        </form>
      </CollapsibleCard>

      <Card>
        <CardHeader>
          <p className="text-sm text-slate-600 dark:text-slate-400">Expenses</p>
        </CardHeader>
        <CardContent>
          <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-950/40">
            <table className="w-full text-sm">
              <thead className="bg-slate-50 text-xs font-semibold uppercase text-slate-500 dark:bg-slate-900/60 dark:text-slate-400">
                <tr>
                  <th className="px-4 py-3 text-left font-medium">Date</th>
                  <th className="px-4 py-3 text-left font-medium">Category</th>
                  <th className="px-4 py-3 text-left font-medium">Flight</th>
                  <th className="px-4 py-3 text-left font-medium">Aircraft</th>
                  <th className="px-4 py-3 text-left font-medium">Vendor</th>
                  <th className="px-4 py-3 text-left font-medium">Notes</th>
                  <th className="px-4 py-3 text-left font-medium">Receipts</th>
                  <th className="px-4 py-3 text-left font-medium">Amount</th>
                  <th className="px-4 py-3 text-left font-medium">Links</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 dark:divide-slate-800">
                {costs.length === 0 ? (
                  <tr>
                    <td className="px-4 py-4 text-sm text-slate-500" colSpan={9}>
                      No expenses logged.
                    </td>
                  </tr>
                ) : (
                  costs.map((cost) => {
                    const tailNumber =
                      cost.flight?.tailNumberSnapshot ||
                      cost.flight?.aircraft?.tailNumber ||
                      cost.flight?.tailNumber ||
                      "—";
                    const flightLabel = cost.flight
                      ? `${tailNumber} · ${formatRoute(
                          cost.flight.origin,
                          cost.flight.destination
                        )}`
                      : "—";
                    const aircraftLabel = cost.flight?.aircraft?.model
                      ? `${tailNumber} · ${cost.flight.aircraft.model}`
                      : tailNumber;
                    const logbookCount = cost.flight?.logbookEntries.length ?? 0;

                    return (
                      <tr key={cost.id} className="text-slate-900 dark:text-slate-100">
                        <td className="px-4 py-3 text-slate-600 dark:text-slate-400">
                          {cost.date.toDateString()}
                        </td>
                        <td className="px-4 py-3">
                          {getCostCategoryLabel(cost.category)}
                        </td>
                        <td className="px-4 py-3">
                          {cost.flight ? (
                            <Link
                              className="text-sky-700 hover:text-sky-800 dark:text-sky-400 dark:hover:text-sky-300"
                              href={`/flights/${cost.flight.id}`}
                            >
                              {flightLabel}
                            </Link>
                          ) : (
                            "—"
                          )}
                          {cost.flight ? (
                            <p className="text-xs text-slate-500">
                              {cost.flight.startTime.toISOString().slice(0, 10)}
                            </p>
                          ) : null}
                        </td>
                        <td className="px-4 py-3 text-slate-600 dark:text-slate-400">{aircraftLabel}</td>
                        <td className="px-4 py-3">{cost.vendor ?? "—"}</td>
                        <td className="px-4 py-3">{cost.notes ?? "—"}</td>
                        <td className="px-4 py-3">
                          {cost.receipts.length === 0 ? (
                            <span className="text-slate-500">No receipts</span>
                          ) : (
                            <ul className="space-y-1">
                              {cost.receipts.map((receipt) => (
                                <li key={receipt.id}>
                                  <Link
                                    className="text-sky-700 hover:text-sky-800 dark:text-sky-400 dark:hover:text-sky-300"
                                    href={`/api/receipts/${receipt.id}/download`}
                                  >
                                    {receipt.originalFilename}
                                  </Link>
                                </li>
                              ))}
                            </ul>
                          )}
                        </td>
                        <td className="px-4 py-3">
                          {currencyFormatter.format(cost.amountCents / 100)}
                        </td>
                        <td className="px-4 py-3">
                          {cost.flight ? (
                            <Link
                              className="text-sky-700 hover:text-sky-800 dark:text-sky-400 dark:hover:text-sky-300"
                              href={`/logbook?flightId=${cost.flight.id}`}
                            >
                              Logbook entries ({logbookCount})
                            </Link>
                          ) : (
                            <span className="text-slate-500">No flight</span>
                          )}
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
