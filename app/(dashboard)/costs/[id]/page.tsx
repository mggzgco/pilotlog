import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/app/lib/db";
import { requireUser } from "@/app/lib/auth/session";
import { Card, CardContent, CardHeader } from "@/app/components/ui/card";
import { Button } from "@/app/components/ui/button";
import { getCostCategoryLabel } from "@/app/lib/costs/categories";
import { ReceiptViewer } from "@/app/components/flights/receipt-viewer";
import { CostDeleteIconButton } from "@/app/components/costs/cost-delete-icon-button";
import { formatDateTime24 } from "@/app/lib/utils";

const formatRoute = (origin?: string | null, destination?: string | null) => {
  if (!origin && !destination) return "—";
  if (!destination) return origin ?? "—";
  return `${origin ?? "—"} → ${destination}`;
};

export default async function CostDetailPage({
  params
}: {
  params: { id: string };
}) {
  const user = await requireUser();

  const cost = await prisma.costItem.findFirst({
    where: { id: params.id, userId: user.id },
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
          aircraft: { select: { tailNumber: true, model: true } }
        }
      }
    }
  });

  if (!cost) {
    notFound();
  }

  const currencyFormatter = new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD"
  });

  const tailNumber =
    cost.flight?.tailNumberSnapshot ||
    cost.flight?.aircraft?.tailNumber ||
    cost.flight?.tailNumber ||
    "—";
  const flightLabel = cost.flight
    ? `${tailNumber} · ${formatRoute(cost.flight.origin, cost.flight.destination)} · ${formatDateTime24(
        cost.flight.startTime
      )}`
    : "—";

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <Button asChild size="sm" variant="ghost">
            <Link href="/costs">← Back</Link>
          </Button>
          <h2 className="mt-2 text-2xl font-semibold">Expense</h2>
          <p className="text-sm text-slate-600 dark:text-slate-400">
            {getCostCategoryLabel(cost.category)} ·{" "}
            {currencyFormatter.format(cost.amountCents / 100)} · {cost.date.toDateString()}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <CostDeleteIconButton
            costId={cost.id}
            confirmMessage="Delete this expense? This cannot be undone."
          />
        </div>
      </div>

      <Card>
        <CardHeader>
          <p className="text-sm text-slate-600 dark:text-slate-400">Details</p>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <p className="text-xs font-semibold uppercase text-slate-500 dark:text-slate-400">
                Category
              </p>
              <p className="text-sm text-slate-900 dark:text-slate-100">
                {getCostCategoryLabel(cost.category)}
              </p>
            </div>
            <div>
              <p className="text-xs font-semibold uppercase text-slate-500 dark:text-slate-400">
                Amount
              </p>
              <p className="text-sm font-semibold text-slate-900 dark:text-slate-100">
                {currencyFormatter.format(cost.amountCents / 100)}
              </p>
            </div>
            <div>
              <p className="text-xs font-semibold uppercase text-slate-500 dark:text-slate-400">
                Vendor
              </p>
              <p className="text-sm text-slate-900 dark:text-slate-100">
                {cost.vendor ?? "—"}
              </p>
            </div>
            <div>
              <p className="text-xs font-semibold uppercase text-slate-500 dark:text-slate-400">
                Date
              </p>
              <p className="text-sm text-slate-900 dark:text-slate-100">
                {cost.date.toDateString()}
              </p>
            </div>
            <div className="sm:col-span-2">
              <p className="text-xs font-semibold uppercase text-slate-500 dark:text-slate-400">
                Notes
              </p>
              <p className="whitespace-pre-wrap text-sm text-slate-900 dark:text-slate-100">
                {cost.notes ?? "—"}
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <p className="text-sm text-slate-600 dark:text-slate-400">Linked flight</p>
        </CardHeader>
        <CardContent>
          {cost.flight ? (
            <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-slate-200 bg-white px-4 py-3 shadow-sm dark:border-slate-800 dark:bg-slate-950/30">
              <div>
                <p className="text-sm font-semibold text-slate-900 dark:text-slate-100">
                  {flightLabel}
                </p>
                <p className="text-xs text-slate-600 dark:text-slate-400">
                  {tailNumber}
                </p>
              </div>
              <Button asChild variant="outline" size="sm">
                <Link href={`/flights/${cost.flight.id}`}>Open flight</Link>
              </Button>
            </div>
          ) : (
            <p className="text-sm text-slate-600 dark:text-slate-400">No flight linked.</p>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <p className="text-sm text-slate-600 dark:text-slate-400">Receipts</p>
        </CardHeader>
        <CardContent>
          {cost.receipts.length === 0 ? (
            <p className="text-sm text-slate-600 dark:text-slate-400">No receipts attached.</p>
          ) : (
            <div className="overflow-hidden rounded-lg border border-slate-200 dark:border-slate-800">
              <table className="w-full text-sm">
                <thead className="bg-slate-50 text-xs font-semibold uppercase text-slate-500 dark:bg-slate-900/60 dark:text-slate-400">
                  <tr>
                    <th className="px-4 py-3 text-left font-medium">Filename</th>
                    <th className="px-4 py-3 text-left font-medium">Uploaded</th>
                    <th className="px-4 py-3 text-right font-medium">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200 dark:divide-slate-800">
                  {cost.receipts.map((receipt) => (
                    <tr key={receipt.id} className="text-slate-900 dark:text-slate-100">
                      <td className="px-4 py-3">{receipt.originalFilename}</td>
                      <td className="px-4 py-3 text-slate-600 dark:text-slate-400">
                        {formatDateTime24(receipt.createdAt)}
                      </td>
                      <td className="px-4 py-3 text-right">
                        <div className="flex justify-end gap-2">
                          <ReceiptViewer
                            receiptId={receipt.id}
                            filename={receipt.originalFilename}
                            triggerLabel="View"
                          />
                          <Button size="sm" variant="outline" asChild>
                            <Link href={`/api/receipts/${receipt.id}/download`}>Download</Link>
                          </Button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

