import Link from "next/link";
import { prisma } from "@/app/lib/db";
import { requireUser } from "@/app/lib/auth/session";
import { computeReportSummary } from "@/app/lib/reports/compute";
import { Card, CardContent, CardHeader } from "@/app/components/ui/card";
import { Button } from "@/app/components/ui/button";
import { Input } from "@/app/components/ui/input";

type ReportsSearchParams = {
  start?: string;
  end?: string;
};

function getSearchParam(value?: string | string[]) {
  if (Array.isArray(value)) {
    return value[0] ?? "";
  }

  return value ?? "";
}

export default async function ReportsPage({
  searchParams
}: {
  searchParams?: ReportsSearchParams & { [key: string]: string | string[] };
}) {
  const user = await requireUser();
  const start = getSearchParam(searchParams?.start).trim();
  const end = getSearchParam(searchParams?.end).trim();
  const startDate = start ? new Date(start) : null;
  const endDate = end ? new Date(`${end}T23:59:59.999Z`) : null;
  const startValue =
    startDate && !Number.isNaN(startDate.getTime()) ? startDate : null;
  const endValue = endDate && !Number.isNaN(endDate.getTime()) ? endDate : null;

  const dateFilter =
    startValue || endValue
      ? {
          ...(startValue ? { gte: startValue } : {}),
          ...(endValue ? { lte: endValue } : {})
        }
      : undefined;

  const [logbookEntries, costItems] = await Promise.all([
    prisma.logbookEntry.findMany({
      where: {
        userId: user.id,
        ...(dateFilter ? { date: dateFilter } : {})
      },
      include: {
        flight: {
          select: {
            durationMinutes: true,
            distanceNm: true
          }
        }
      }
    }),
    prisma.costItem.findMany({
      where: {
        userId: user.id,
        ...(dateFilter ? { date: dateFilter } : {})
      },
      orderBy: { date: "desc" }
    })
  ]);

  const summary = computeReportSummary(logbookEntries, costItems);
  const currencyFormatter = new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD"
  });
  const costCategories = Object.keys(summary.costByCategory).sort((a, b) =>
    a.localeCompare(b)
  );
  const exportParams = new URLSearchParams();
  if (start) {
    exportParams.set("start", start);
  }
  if (end) {
    exportParams.set("end", end);
  }
  const exportHref = `/api/reports/export.csv${
    exportParams.toString() ? `?${exportParams.toString()}` : ""
  }`;

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-semibold">Reports</h2>
        <p className="text-sm text-slate-400">
          Generate summaries for flight hours, costs, and compliance.
        </p>
      </div>

      <Card>
        <CardHeader>
          <p className="text-sm text-slate-400">Report range</p>
        </CardHeader>
        <CardContent>
          <form method="get" className="grid gap-3 lg:grid-cols-3">
            <Input name="start" type="date" defaultValue={start} />
            <Input name="end" type="date" defaultValue={end} />
            <div className="flex flex-wrap gap-2 lg:col-span-3">
              <Button type="submit">Update range</Button>
              <Button variant="outline" asChild>
                <Link href="/reports">Reset</Link>
              </Button>
              <Button variant="outline" asChild>
                <a href={exportHref}>Download CSV</a>
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <p className="text-sm text-slate-400">Flight time totals</p>
          </CardHeader>
          <CardContent>
            <div className="grid gap-3 text-sm text-slate-700 dark:text-slate-200">
              <div className="flex items-center justify-between">
                <span>Total time</span>
                <span>{summary.totalTime.toFixed(1)} hrs</span>
              </div>
              <div className="flex items-center justify-between">
                <span>PIC</span>
                <span>{summary.picTime.toFixed(1)} hrs</span>
              </div>
              <div className="flex items-center justify-between">
                <span>Dual received</span>
                <span>{summary.dualReceivedTime.toFixed(1)} hrs</span>
              </div>
              <div className="flex items-center justify-between">
                <span>Night</span>
                <span>{summary.nightTime.toFixed(1)} hrs</span>
              </div>
              <div className="flex items-center justify-between">
                <span>XC</span>
                <span>{summary.xcTime.toFixed(1)} hrs</span>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <p className="text-sm text-slate-400">Cost totals</p>
          </CardHeader>
          <CardContent>
            <div className="grid gap-3 text-sm text-slate-700 dark:text-slate-200">
              <div className="flex items-center justify-between">
                <span>Total cost</span>
                <span>{currencyFormatter.format(summary.costTotalCents / 100)}</span>
              </div>
              {costCategories.length === 0 ? (
                <p className="text-sm text-slate-600 dark:text-slate-400">No costs in this range.</p>
              ) : (
                costCategories.map((category) => (
                  <div
                    key={category}
                    className="flex items-center justify-between text-slate-600 dark:text-slate-300"
                  >
                    <span>{category}</span>
                    <span>
                      {currencyFormatter.format(
                        summary.costByCategory[category] / 100
                      )}
                    </span>
                  </div>
                ))
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
