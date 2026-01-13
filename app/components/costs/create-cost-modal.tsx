"use client";

import * as Dialog from "@radix-ui/react-dialog";
import { X } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { Button } from "@/app/components/ui/button";
import { Input } from "@/app/components/ui/input";
import { FormSubmitButton } from "@/app/components/ui/form-submit-button";
import {
  costCategoryOptions,
  costCategoryValues,
  getCostCategoryLabel
} from "@/app/lib/costs/categories";

type FlightOption = {
  id: string;
  label: string;
};

type CreateCostModalProps = {
  flights: FlightOption[];
  defaultFlightId?: string;
  defaultDate: string;
  receiptAccept: string;
  triggerLabel?: string;
};

export function CreateCostModal({
  flights,
  defaultFlightId,
  defaultDate,
  receiptAccept,
  triggerLabel = "Add expense"
}: CreateCostModalProps) {
  const [open, setOpen] = useState(false);
  const [category, setCategory] = useState("");
  const [amount, setAmount] = useState("");
  const [rate, setRate] = useState("");
  const [quantityHours, setQuantityHours] = useState("");
  const [fuelGallons, setFuelGallons] = useState("");
  const [fuelPrice, setFuelPrice] = useState("");

  const normalizedCategory = useMemo(
    () => category.trim().toLowerCase(),
    [category]
  );
  const showRateFields = ["rental", "instruction"].includes(normalizedCategory);
  const showFuelFields = normalizedCategory === "fuel";

  const categoryOptions = useMemo(() => {
    const options: Array<{ value: string; label: string }> = [...costCategoryOptions];
    if (
      category.trim() &&
      !costCategoryValues.includes(
        category.trim().toLowerCase() as (typeof costCategoryValues)[number]
      )
    ) {
      options.push({ value: category, label: getCostCategoryLabel(category) });
    }
    return options;
  }, [category]);

  const parseDecimalInput = (value: string) => {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  };

  useEffect(() => {
    if (showRateFields) {
      const parsedRate = parseDecimalInput(rate);
      const parsedHours = parseDecimalInput(quantityHours);
      if (parsedRate !== null && parsedHours !== null) {
        setAmount((parsedRate * parsedHours).toFixed(2));
      }
      return;
    }
    if (showFuelFields) {
      const parsedGallons = parseDecimalInput(fuelGallons);
      const parsedPrice = parseDecimalInput(fuelPrice);
      if (parsedGallons !== null && parsedPrice !== null) {
        setAmount((parsedGallons * parsedPrice).toFixed(2));
      }
    }
  }, [showRateFields, showFuelFields, rate, quantityHours, fuelGallons, fuelPrice]);

  const amountIsAutoCalculated =
    !!((showRateFields && rate.trim() && quantityHours.trim()) ||
    (showFuelFields && fuelGallons.trim() && fuelPrice.trim()));

  return (
    <Dialog.Root open={open} onOpenChange={setOpen}>
      <Dialog.Trigger asChild>
        <Button>{triggerLabel}</Button>
      </Dialog.Trigger>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-40 bg-slate-950/70 backdrop-blur-sm" />
        <Dialog.Content className="fixed inset-y-0 right-0 z-50 w-full max-w-2xl overflow-y-auto border-l border-slate-200 bg-white p-6 shadow-xl dark:border-slate-800 dark:bg-slate-950">
          <div className="flex items-start justify-between gap-4">
            <div>
              <Dialog.Title className="text-lg font-semibold text-slate-900 dark:text-slate-100">
                Add expense
              </Dialog.Title>
              <Dialog.Description className="text-sm text-slate-600 dark:text-slate-400">
                Log an expense and optionally attach receipts.
              </Dialog.Description>
            </div>
            <Dialog.Close asChild>
              <button
                type="button"
                className="rounded-md border border-slate-200 p-2 text-slate-600 transition hover:text-slate-900 dark:border-slate-800 dark:text-slate-400 dark:hover:text-slate-100"
                aria-label="Close add expense dialog"
              >
                <X className="h-4 w-4" />
              </button>
            </Dialog.Close>
          </div>

          <form
            action="/api/costs/create"
            method="post"
            encType="multipart/form-data"
            className="mt-6 grid gap-3 lg:grid-cols-3"
          >
            <select
              name="flightId"
              defaultValue={defaultFlightId ?? ""}
              className="h-11 rounded-md border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 shadow-sm outline-none focus-visible:ring-2 focus-visible:ring-brand-500 focus-visible:ring-offset-2 focus-visible:ring-offset-white dark:border-slate-800 dark:bg-slate-950 dark:text-slate-100 dark:focus-visible:ring-offset-slate-950 lg:col-span-3"
              required
            >
              <option value="">Select a flight</option>
              {flights.map((flight) => (
                <option key={flight.id} value={flight.id}>
                  {flight.label}
                </option>
              ))}
            </select>

            <select
              name="category"
              value={category}
              onChange={(event) => setCategory(event.target.value)}
              className="h-11 rounded-md border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 shadow-sm outline-none focus-visible:ring-2 focus-visible:ring-brand-500 focus-visible:ring-offset-2 focus-visible:ring-offset-white dark:border-slate-800 dark:bg-slate-950 dark:text-slate-100 dark:focus-visible:ring-offset-slate-950"
              required
            >
              <option value="">Select category</option>
              {categoryOptions.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>

            {showRateFields ? (
              <>
                <Input
                  name="rate"
                  placeholder="Rate ($/hr)"
                  type="number"
                  step="0.01"
                  value={rate}
                  onChange={(event) => setRate(event.target.value)}
                />
                <Input
                  name="quantityHours"
                  placeholder="Hours"
                  type="number"
                  step="0.01"
                  value={quantityHours}
                  onChange={(event) => setQuantityHours(event.target.value)}
                />
              </>
            ) : null}

            {showFuelFields ? (
              <>
                <Input
                  name="fuelGallons"
                  placeholder="Fuel gallons"
                  type="number"
                  step="0.01"
                  value={fuelGallons}
                  onChange={(event) => setFuelGallons(event.target.value)}
                />
                <Input
                  name="fuelPrice"
                  placeholder="Fuel price ($/gal)"
                  type="number"
                  step="0.01"
                  value={fuelPrice}
                  onChange={(event) => setFuelPrice(event.target.value)}
                />
              </>
            ) : null}

            <Input
              name="amount"
              placeholder="Amount"
              type="number"
              step="0.01"
              value={amount}
              onChange={(event) => setAmount(event.target.value)}
              readOnly={amountIsAutoCalculated}
              required={!amountIsAutoCalculated}
            />
            <Input name="date" type="date" defaultValue={defaultDate} required />
            <Input name="vendor" placeholder="Vendor" />
            <Input name="notes" placeholder="Notes" className="lg:col-span-2" />
            <div className="lg:col-span-3">
              <label
                className="text-xs font-semibold uppercase text-slate-600 dark:text-slate-400"
                htmlFor="cost-modal-receipts"
              >
                Receipts (optional)
              </label>
              <input
                id="cost-modal-receipts"
                name="receipts"
                type="file"
                multiple
                accept={receiptAccept}
                className="mt-2 block w-full text-sm text-slate-700 file:mr-4 file:rounded-md file:border file:border-slate-200 file:bg-white file:px-4 file:py-2 file:text-sm file:font-semibold file:text-slate-900 hover:file:bg-slate-50 dark:text-slate-200 dark:file:border-slate-800 dark:file:bg-slate-950 dark:file:text-slate-100 dark:hover:file:bg-slate-900"
              />
              <p className="mt-2 text-xs text-slate-600 dark:text-slate-400">
                Upload PDF, PNG, or JPEG receipts. Files attach to the selected flight.
              </p>
            </div>
            <div className="lg:col-span-3 flex flex-wrap gap-3">
              <FormSubmitButton type="submit" pendingText="Saving...">
                Save expense
              </FormSubmitButton>
              <Dialog.Close asChild>
                <Button type="button" variant="outline">
                  Cancel
                </Button>
              </Dialog.Close>
            </div>
          </form>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}

