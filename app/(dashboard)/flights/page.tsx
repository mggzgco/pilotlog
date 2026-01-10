import Link from "next/link";
import { FlightStatus, Prisma } from "@prisma/client";
import { prisma } from "@/app/lib/db";
import { requireUser } from "@/app/lib/auth/session";
import { Button } from "@/app/components/ui/button";
import { Input } from "@/app/components/ui/input";
import { EmptyState } from "@/app/components/ui/empty-state";
import { FlightsTable } from "@/app/components/flights/flights-table";
import { CreateFlightModal } from "@/app/components/flights/create-flight-modal";
import { Plane } from "lucide-react";

type FlightsSearchParams = {
  search?: string;
  startDate?: string;
  endDate?: string;
  status?: string;
  aircraftId?: string;
  sort?: string;
};

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
  const search = getSearchParam(searchParams?.search).trim();
  const startDate = getSearchParam(searchParams?.startDate).trim();
  const endDate = getSearchParam(searchParams?.endDate).trim();
  const status = getSearchParam(searchParams?.status).trim();
  const aircraftId = getSearchParam(searchParams?.aircraftId).trim();
  const sort = getSearchParam(searchParams?.sort).trim() || "date_desc";
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

  const statusOptions: FlightStatus[] = [
    "PLANNED",
    "PREFLIGHT_SIGNED",
    "POSTFLIGHT_IN_PROGRESS",
    "POSTFLIGHT_SIGNED",
    "IMPORTED",
    "COMPLETED"
  ];
  const statusFilter = statusOptions.includes(status as FlightStatus)
    ? (status as FlightStatus)
    : "";

  const searchFilters: Prisma.FlightWhereInput[] = [];
  if (search) {
    searchFilters.push({
      OR: [
        { tailNumber: { contains: search, mode: "insensitive" } },
        { tailNumberSnapshot: { contains: search, mode: "insensitive" } },
        { origin: { contains: search, mode: "insensitive" } },
        { destination: { contains: search, mode: "insensitive" } },
        {
          participants: {
            some: {
              user: {
                OR: [
                  { firstName: { contains: search, mode: "insensitive" } },
                  { lastName: { contains: search, mode: "insensitive" } },
                  { name: { contains: search, mode: "insensitive" } },
                  { email: { contains: search, mode: "insensitive" } }
                ]
              }
            }
          }
        }
      ]
    });
  }

  if (startDateValue || endDateValue) {
    const range = {
      ...(startDateValue ? { gte: startDateValue } : {}),
      ...(endDateValue ? { lte: endDateValue } : {})
    };
    searchFilters.push({
      OR: [{ plannedStartTime: range }, { startTime: range }]
    });
  }

  const orderBy = (() => {
    switch (sort) {
      case "date_asc":
        return [{ plannedStartTime: "asc" }, { startTime: "asc" }] as const;
      case "tail_asc":
        return [{ tailNumber: "asc" }] as const;
      case "tail_desc":
        return [{ tailNumber: "desc" }] as const;
      case "status_asc":
        return [{ status: "asc" }] as const;
      case "status_desc":
        return [{ status: "desc" }] as const;
      case "date_desc":
      default:
        return [{ plannedStartTime: "desc" }, { startTime: "desc" }] as const;
    }
  })();

  const [flights, aircraft, users, people] = await Promise.all([
    prisma.flight.findMany({
      where: {
        userId: user.id,
        ...(statusFilter ? { status: statusFilter } : {}),
        ...(aircraftId ? { aircraftId } : {}),
        ...(searchFilters.length > 0 ? { AND: searchFilters } : {})
      },
      orderBy,
      include: {
        costItems: { select: { id: true } },
        logbookEntries: { select: { id: true } },
        checklistRuns: {
          select: {
            phase: true,
            status: true,
            decision: true,
            items: { select: { required: true, inputType: true, valueYesNo: true } }
          }
        }
      }
    }),
    prisma.aircraft.findMany({
      where: { userId: user.id },
      orderBy: { tailNumber: "asc" },
      select: { id: true, tailNumber: true, model: true }
    }),
    prisma.user.findMany({
      orderBy: [{ lastName: "asc" }, { firstName: "asc" }],
      select: { id: true, firstName: true, lastName: true, name: true, email: true }
    }),
    prisma.person.findMany({
      where: { userId: user.id },
      orderBy: { name: "asc" },
      select: { id: true, name: true, email: true }
    })
  ]);

  const decisionLabel = (
    run: (typeof flights)[number]["checklistRuns"][number] | undefined
  ) => {
    if (!run || run.status !== "SIGNED") {
      return "—";
    }
    if (run.decision === "REJECTED") {
      return "Rejected";
    }
    if (run.decision === "ACCEPTED") {
      return "Accepted";
    }
    const hasRejected = run.items.some(
      (item) =>
        item.required && item.inputType === "YES_NO" && item.valueYesNo === false
    );
    return hasRejected ? "Rejected" : "Accepted";
  };

  const flightRows = flights.map((flight) => {
    const displayTime = flight.plannedStartTime ?? flight.startTime;
    const preflightRun = flight.checklistRuns.find(
      (run) => run.phase === "PREFLIGHT"
    );
    const postflightRun = flight.checklistRuns.find(
      (run) => run.phase === "POSTFLIGHT"
    );
    const preflightDecision = decisionLabel(preflightRun);
    const postflightDecision = decisionLabel(postflightRun);
    const isImported = Boolean(
      flight.importedProvider ||
        flight.providerFlightId ||
        ["IMPORTED", "COMPLETED"].includes(flight.status)
    );
    const hasLogbookEntry = flight.logbookEntries.length > 0;
    const hasCosts = flight.costItems.length > 0;
    const checklistAvailable =
      preflightRun && preflightRun.status !== "NOT_AVAILABLE";

    const nextAction =
      flight.status === "PLANNED" && checklistAvailable && preflightDecision === "—"
        ? { type: "link", label: "Start Preflight", href: `/flights/${flight.id}` }
        : preflightDecision === "Accepted" && postflightDecision === "—"
          ? {
              type: "form",
              label: "Start Postflight",
              action: `/api/flights/${flight.id}/checklists/start-postflight`
            }
          : postflightDecision === "Accepted" && !isImported
            ? { type: "link", label: "Import ADS-B", href: `/flights/${flight.id}/match` }
            : isImported && !hasLogbookEntry
              ? { type: "link", label: "Log Hours", href: `/flights/${flight.id}` }
              : !hasCosts
                ? { type: "link", label: "Add Costs", href: `/flights/${flight.id}` }
                : { type: "link", label: "Open", href: `/flights/${flight.id}` };

    return {
      id: flight.id,
      displayTime: displayTime.toISOString(),
      tailNumber: flight.tailNumber,
      tailNumberSnapshot: flight.tailNumberSnapshot,
      origin: flight.origin,
      destination: flight.destination,
      status: flight.status,
      preflightDecision,
      postflightDecision,
      adsbStatus: isImported ? "Imported" : "—",
      nextAction,
      menuItems: [
        { label: "Open", href: `/flights/${flight.id}` },
        { label: "Match ADS-B", href: `/flights/${flight.id}/match` }
      ]
    };
  });

  const participantOptions = users.map((entry) => ({
    id: entry.id,
    label:
      [entry.firstName, entry.lastName].filter(Boolean).join(" ") ||
      entry.name ||
      entry.email
  }));

  const personOptions = people.map((entry) => ({
    id: entry.id,
    label: entry.email ? `${entry.name} · ${entry.email}` : entry.name
  }));

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-semibold">Flights</h2>
          <p className="text-sm text-slate-400">
            All flights, ready for the next action.
          </p>
        </div>
        <CreateFlightModal
          aircraftOptions={aircraft}
          participantOptions={participantOptions}
          personOptions={personOptions}
        />
      </div>

      <div className="rounded-xl border border-slate-800 bg-slate-950/40 p-4">
        <form
          method="get"
          className="grid gap-3 md:grid-cols-2 lg:grid-cols-[2fr,1fr,1fr,1fr,1fr,1fr] lg:items-end"
        >
          <div className="space-y-1">
            <label className="text-xs font-semibold uppercase text-slate-500">
              Search
            </label>
            <Input
              name="search"
              placeholder="Route, tail number, or person"
              defaultValue={search}
            />
          </div>
          <div className="space-y-1">
            <label className="text-xs font-semibold uppercase text-slate-500">
              Start date
            </label>
            <Input
              name="startDate"
              type="date"
              placeholder="Start date"
              defaultValue={startDate}
            />
          </div>
          <div className="space-y-1">
            <label className="text-xs font-semibold uppercase text-slate-500">
              End date
            </label>
            <Input
              name="endDate"
              type="date"
              placeholder="End date"
              defaultValue={endDate}
            />
          </div>
          <div className="space-y-1">
            <label className="text-xs font-semibold uppercase text-slate-500">
              Status
            </label>
            <select
              name="status"
              className="h-11 w-full rounded-md border border-slate-800 bg-transparent px-3 py-2 text-sm text-slate-100"
              defaultValue={status}
            >
              <option value="">All statuses</option>
              {statusOptions.map((option) => (
                <option key={option} value={option}>
                  {option.replace(/_/g, " ").toLowerCase()}
                </option>
              ))}
            </select>
          </div>
          <div className="space-y-1">
            <label className="text-xs font-semibold uppercase text-slate-500">
              Aircraft
            </label>
            <select
              name="aircraftId"
              className="h-11 w-full rounded-md border border-slate-800 bg-transparent px-3 py-2 text-sm text-slate-100"
              defaultValue={aircraftId}
            >
              <option value="">All aircraft</option>
              {aircraft.map((entry) => (
                <option key={entry.id} value={entry.id}>
                  {entry.tailNumber}
                </option>
              ))}
            </select>
          </div>
          <div className="space-y-1">
            <label className="text-xs font-semibold uppercase text-slate-500">
              Sort
            </label>
            <select
              name="sort"
              className="h-11 w-full rounded-md border border-slate-800 bg-transparent px-3 py-2 text-sm text-slate-100"
              defaultValue={sort}
            >
              <option value="date_desc">Date desc</option>
              <option value="date_asc">Date asc</option>
              <option value="tail_asc">Tail number A-Z</option>
              <option value="tail_desc">Tail number Z-A</option>
              <option value="status_asc">Status A-Z</option>
              <option value="status_desc">Status Z-A</option>
            </select>
          </div>
          <div className="flex flex-wrap gap-2 md:col-span-2 lg:col-span-6">
            <Button type="submit">Apply filters</Button>
            <Button variant="outline" asChild>
              <Link href="/flights">Reset</Link>
            </Button>
          </div>
        </form>
      </div>

      {flightRows.length === 0 ? (
        <EmptyState
          icon={<Plane className="h-6 w-6" />}
          title={flights.length === 0 ? "No flights yet" : "No flights match your filters"}
          description={
            flights.length === 0
              ? "Create your first flight to start tracking checklists, imports, and costs."
              : "Try adjusting your filters or reset the search to see more flights."
          }
          action={
            flights.length === 0 ? (
              <CreateFlightModal
                aircraftOptions={aircraft}
                participantOptions={participantOptions}
                personOptions={personOptions}
                triggerLabel="Create Flight"
              />
            ) : (
              <Button variant="outline" asChild>
                <Link href="/flights">Reset filters</Link>
              </Button>
            )
          }
        />
      ) : (
        <FlightsTable flights={flightRows} />
      )}
    </div>
  );
}
