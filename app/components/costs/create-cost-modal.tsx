"use client";

import * as Dialog from "@radix-ui/react-dialog";
import { X } from "lucide-react";
import { useState } from "react";
import { Button } from "@/app/components/ui/button";
import { Input } from "@/app/components/ui/input";
import { FormSubmitButton } from "@/app/components/ui/form-submit-button";
import { costCategoryOptions } from "@/app/lib/costs/categories";

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
              defaultValue=""
              className="h-11 rounded-md border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 shadow-sm outline-none focus-visible:ring-2 focus-visible:ring-brand-500 focus-visible:ring-offset-2 focus-visible:ring-offset-white dark:border-slate-800 dark:bg-slate-950 dark:text-slate-100 dark:focus-visible:ring-offset-slate-950"
              required
            >
              <option value="">Select category</option>
              {costCategoryOptions.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
            <Input name="amount" placeholder="Amount" type="number" step="0.01" required />
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

