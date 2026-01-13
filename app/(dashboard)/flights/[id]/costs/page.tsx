import { notFound } from "next/navigation";
import Link from "next/link";
import { prisma } from "@/app/lib/db";
import { requireUser } from "@/app/lib/session";
import { Card, CardContent, CardHeader } from "@/app/components/ui/card";
import { Button } from "@/app/components/ui/button";
import { Input } from "@/app/components/ui/input";
import { EmptyState } from "@/app/components/ui/empty-state";
import { FormSubmitButton } from "@/app/components/ui/form-submit-button";
import { CostItemForm } from "@/app/components/flights/cost-item-form";
import { getCostCategoryLabel } from "@/app/lib/costs/categories";
import { FlightStatusBadge } from "@/app/components/flights/flight-status-badge";
import { formatDateTime24 } from "@/app/lib/utils";
import { Receipt } from "lucide-react";
import { ReceiptViewer } from "@/app/components/flights/receipt-viewer";

export default async function FlightCostsPage({
  params,
  searchParams
}: {
  params: { id: string };
  searchParams?: { receiptCostItemId?: string };
}) {
  const user = await requireUser();

  const flight = await prisma.flight.findFirst({
    where: { id: params.id, userId: user.id },
    include: {
      costItems: { orderBy: { date: "desc" } },
      receiptDocuments: {
        orderBy: { createdAt: "desc" },
        include: {
          costItem: { select: { id: true, category: true, amountCents: true } }
        }
      }
    }
  });

  if (!flight) {
    notFound();
  }

  const currencyFormatter = new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD"
  });

  const formatBytes = (bytes: number | null) => {
    if (!bytes && bytes !== 0) {
      return "—";
    }
    if (bytes < 1024) {
      return `${bytes} B`;
    }
    if (bytes < 1024 * 1024) {
      return `${(bytes / 1024).toFixed(1)} KB`;
    }
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  const formatCurrencyInput = (amountCents: number | null) =>
    amountCents === null ? "" : (amountCents / 100).toFixed(2);

  const formatDecimalInput = (
    value: number | string | { toString(): string } | null
  ) => {
    if (value === null || value === undefined) {
      return "";
    }
    const numeric = Number(value);
    return Number.isFinite(numeric) ? numeric.toFixed(2) : "";
  };

  const receiptFilter = searchParams?.receiptCostItemId ?? "all";

  const receiptsOnly = flight.receiptDocuments.filter(
    (receipt) => !receipt.storagePath.startsWith("photo_")
  );

  const receiptDocuments = receiptsOnly.filter((receipt) => {
    if (receiptFilter === "all") {
      return true;
    }
    if (receiptFilter === "unassigned") {
      return receipt.costItemId === null;
    }
    return receipt.costItemId === receiptFilter;
  });

  const receiptCostItemLabel = (receipt: typeof flight.receiptDocuments[number]) =>
    receipt.costItem
      ? `${getCostCategoryLabel(receipt.costItem.category)} · ${currencyFormatter.format(
          receipt.costItem.amountCents / 100
        )}`
      : "Unassigned";

  const receiptUploadDefaultCostItemId =
    receiptFilter !== "all" && receiptFilter !== "unassigned" ? receiptFilter : "";

  const costTotalCents = flight.costItems.reduce(
    (total, item) => total + item.amountCents,
    0
  );

  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-wrap items-center gap-3">
            <h2 className="text-2xl font-semibold">Costs & receipts</h2>
            <FlightStatusBadge status={flight.status} />
          </div>
          <Button variant="outline" asChild>
            <Link href={`/flights/${flight.id}`}>Back to flight dashboard</Link>
          </Button>
        </div>
        <p className="text-sm text-slate-400">
          {flight.tailNumberSnapshot ?? flight.tailNumber} · {flight.origin} →{" "}
          {flight.destination ?? "TBD"} · {formatDateTime24(flight.startTime)}
        </p>
      </div>

      <Card>
        <CardHeader>
          <p className="text-sm text-slate-400">Summary</p>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 lg:grid-cols-3">
            <div>
              <p className="text-xs uppercase text-slate-400">Cost items</p>
              <p className="text-lg font-semibold">{flight.costItems.length}</p>
            </div>
            <div>
              <p className="text-xs uppercase text-slate-400">Receipts</p>
              <p className="text-lg font-semibold">{receiptsOnly.length}</p>
            </div>
            <div>
              <p className="text-xs uppercase text-slate-400">Total</p>
              <p className="text-lg font-semibold">
                {costTotalCents > 0 ? currencyFormatter.format(costTotalCents / 100) : "—"}
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card id="add-costs">
        <CardHeader>
          <p className="text-sm text-slate-400">Add cost item</p>
        </CardHeader>
        <CardContent>
          <CostItemForm
            action={`/api/flights/${flight.id}/cost-items/create`}
            submitLabel="Save cost item"
            pendingText="Saving cost item..."
            defaultValues={{
              category: "",
              amount: "",
              date: flight.startTime.toISOString().slice(0, 10),
              vendor: "",
              notes: ""
            }}
          />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <p className="text-sm text-slate-400">Cost items</p>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {flight.costItems.length === 0 ? (
              <div className="rounded-lg border border-dashed border-slate-700 p-4 text-sm text-slate-400">
                No cost items yet.
              </div>
            ) : (
              flight.costItems.map((item) => (
                <div key={item.id} className="rounded-lg border border-slate-800 p-4">
                  <div className="flex flex-col gap-3 lg:flex-row md:items-start md:justify-between">
                    <div>
                      <p className="text-sm font-semibold text-slate-100">
                        {getCostCategoryLabel(item.category)}
                      </p>
                      <p className="text-xs text-slate-400">
                        {item.vendor ?? "Vendor not listed"} · {item.date.toDateString()}
                      </p>
                      {item.rateCents !== null && item.quantityHours !== null ? (
                        <p className="text-xs text-slate-400">
                          {currencyFormatter.format(item.rateCents / 100)} / hr ·{" "}
                          {formatDecimalInput(item.quantityHours)} hrs
                        </p>
                      ) : null}
                      {item.fuelGallons !== null && item.fuelPriceCents !== null ? (
                        <p className="text-xs text-slate-400">
                          {formatDecimalInput(item.fuelGallons)} gal ·{" "}
                          {currencyFormatter.format(item.fuelPriceCents / 100)} / gal
                        </p>
                      ) : null}
                      <p className="text-sm text-slate-300">{item.notes ?? "No notes"}</p>
                    </div>
                    <div className="flex flex-col items-start gap-2 md:items-end">
                      <p className="text-sm font-semibold text-slate-100">
                        {currencyFormatter.format(item.amountCents / 100)}
                      </p>
                      <form
                        action={`/api/flights/${flight.id}/cost-items/delete`}
                        method="post"
                      >
                        <input type="hidden" name="costItemId" value={item.id} />
                        <FormSubmitButton
                          type="submit"
                          size="sm"
                          variant="outline"
                          pendingText="Deleting..."
                        >
                          Delete
                        </FormSubmitButton>
                      </form>
                    </div>
                  </div>
                  <details className="mt-3 rounded-md border border-slate-800 bg-slate-950/30 px-4 py-3">
                    <summary className="cursor-pointer text-xs font-semibold uppercase text-slate-400">
                      Edit cost item
                    </summary>
                    <CostItemForm
                      action={`/api/flights/${flight.id}/cost-items/create`}
                      submitLabel="Update cost item"
                      pendingText="Updating..."
                      submitSize="sm"
                      defaultValues={{
                        costItemId: item.id,
                        category: item.category,
                        amount: formatCurrencyInput(item.amountCents),
                        date: item.date.toISOString().slice(0, 10),
                        vendor: item.vendor ?? "",
                        notes: item.notes ?? "",
                        rate: formatCurrencyInput(item.rateCents),
                        quantityHours: formatDecimalInput(item.quantityHours),
                        fuelGallons: formatDecimalInput(item.fuelGallons),
                        fuelPrice: formatCurrencyInput(item.fuelPriceCents)
                      }}
                    />
                  </details>
                </div>
              ))
            )}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <p className="text-sm text-slate-400">Receipts</p>
        </CardHeader>
        <CardContent>
          <form method="get" className="flex flex-wrap items-center gap-3">
            <label
              htmlFor="receipt-cost-filter"
              className="text-xs font-semibold uppercase text-slate-400"
            >
              Filter by cost item
            </label>
            <select
              id="receipt-cost-filter"
              name="receiptCostItemId"
              defaultValue={receiptFilter}
              className="h-11 rounded-md border border-slate-800 bg-slate-900 px-3 py-2 text-sm text-slate-100"
            >
              <option value="all">All receipts</option>
              <option value="unassigned">Unassigned</option>
              {flight.costItems.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.category} · {currencyFormatter.format(item.amountCents / 100)}
                </option>
              ))}
            </select>
            <Button type="submit" variant="outline" size="sm">
              Apply filter
            </Button>
          </form>

          <form
            action={`/api/flights/${flight.id}/receipts/upload`}
            method="post"
            encType="multipart/form-data"
            className="mt-4 grid gap-3 lg:grid-cols-3"
          >
            <input type="hidden" name="kind" value="receipt" />
            <select
              name="costItemId"
              defaultValue={receiptUploadDefaultCostItemId}
              className="h-11 rounded-md border border-slate-800 bg-slate-900 px-3 py-2 text-sm text-slate-100"
            >
              <option value="">Link to cost item (optional)</option>
              {flight.costItems.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.category} · {currencyFormatter.format(item.amountCents / 100)}
                </option>
              ))}
            </select>
            <Input
              id="receipt-upload"
              name="receipts"
              type="file"
              accept=".pdf,image/png,image/jpeg"
              multiple
              required
              className="lg:col-span-2"
            />
            <div className="lg:col-span-3 flex flex-wrap items-center gap-3 text-xs text-slate-400">
              <FormSubmitButton type="submit" pendingText="Uploading...">
                Upload receipts
              </FormSubmitButton>
              <span>PDF, JPG, PNG up to 20MB each.</span>
            </div>
          </form>

          {receiptDocuments.length === 0 ? (
            <EmptyState
              icon={<Receipt className="h-6 w-6" />}
              title={
                flight.receiptDocuments.length === 0
                  ? "No receipts uploaded"
                  : "No receipts match this filter"
              }
              description={
                flight.receiptDocuments.length === 0
                  ? "Upload receipts to keep every expense attached to this flight."
                  : "Try a different cost item filter or upload more receipts."
              }
              action={
                <Button asChild>
                  <label htmlFor="receipt-upload">Upload receipts</label>
                </Button>
              }
              secondaryAction={
                <Button variant="outline" asChild>
                  <Link href="#add-costs">Add a cost item</Link>
                </Button>
              }
              className="mt-4"
            />
          ) : (
            <div className="mt-4 overflow-hidden rounded-lg border border-slate-800">
              <table className="w-full text-sm">
                <thead className="bg-slate-900 text-xs uppercase text-slate-500">
                  <tr>
                    <th className="px-4 py-3 text-left font-medium">Filename</th>
                    <th className="px-4 py-3 text-left font-medium">Cost item</th>
                    <th className="px-4 py-3 text-left font-medium">Uploaded</th>
                    <th className="px-4 py-3 text-left font-medium">Size</th>
                    <th className="px-4 py-3 text-right font-medium">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800">
                  {receiptDocuments.map((receipt) => (
                    <tr key={receipt.id} className="text-slate-200">
                      <td className="px-4 py-3">{receipt.originalFilename}</td>
                      <td className="px-4 py-3 text-slate-400">
                        {receiptCostItemLabel(receipt)}
                      </td>
                      <td className="px-4 py-3 text-slate-400">
                        {formatDateTime24(receipt.createdAt)}
                      </td>
                      <td className="px-4 py-3 text-slate-400">
                        {formatBytes(receipt.sizeBytes ?? null)}
                      </td>
                      <td className="px-4 py-3 text-right">
                        <div className="flex flex-wrap justify-end gap-2">
                          <ReceiptViewer
                            receiptId={receipt.id}
                            filename={receipt.originalFilename}
                            triggerLabel="View"
                          />
                          <Button size="sm" variant="outline" asChild>
                            <Link href={`/api/receipts/${receipt.id}/download`}>
                              Download
                            </Link>
                          </Button>
                          <form action={`/api/receipts/${receipt.id}/delete`} method="post">
                            <FormSubmitButton
                              size="sm"
                              variant="outline"
                              type="submit"
                              pendingText="Deleting..."
                            >
                              Delete
                            </FormSubmitButton>
                          </form>
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

