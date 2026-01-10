"use client";

import * as Dialog from "@radix-ui/react-dialog";
import { X } from "lucide-react";
import { useState } from "react";
import { Button } from "@/app/components/ui/button";
import { Input } from "@/app/components/ui/input";
import { FormSubmitButton } from "@/app/components/ui/form-submit-button";

type FlightOption = {
  id: string;
  label: string;
};

type CreateLogbookEntryModalProps = {
  flights: FlightOption[];
  defaultFlightId?: string;
  defaultDate: string;
  triggerLabel?: string;
};

export function CreateLogbookEntryModal({
  flights,
  defaultFlightId,
  defaultDate,
  triggerLabel = "Add logbook entry"
}: CreateLogbookEntryModalProps) {
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
                Add logbook entry
              </Dialog.Title>
              <Dialog.Description className="text-sm text-slate-600 dark:text-slate-400">
                Log time buckets and remarks. Total time is computed when you save.
              </Dialog.Description>
            </div>
            <Dialog.Close asChild>
              <button
                type="button"
                className="rounded-md border border-slate-200 p-2 text-slate-600 transition hover:text-slate-900 dark:border-slate-800 dark:text-slate-400 dark:hover:text-slate-100"
                aria-label="Close create logbook dialog"
              >
                <X className="h-4 w-4" />
              </button>
            </Dialog.Close>
          </div>

          <form action="/api/logbook/create" method="post" className="mt-6 grid gap-3 lg:grid-cols-3">
            <select
              name="status"
              defaultValue="OPEN"
              className="h-11 rounded-md border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 shadow-sm outline-none focus-visible:ring-2 focus-visible:ring-brand-500 focus-visible:ring-offset-2 focus-visible:ring-offset-white dark:border-slate-800 dark:bg-slate-950 dark:text-slate-100 dark:focus-visible:ring-offset-slate-950 lg:col-span-3"
            >
              <option value="OPEN">Open</option>
              <option value="CLOSED">Closed</option>
            </select>

            <select
              name="flightId"
              defaultValue={defaultFlightId ?? ""}
              className="h-11 rounded-md border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 shadow-sm outline-none focus-visible:ring-2 focus-visible:ring-brand-500 focus-visible:ring-offset-2 focus-visible:ring-offset-white dark:border-slate-800 dark:bg-slate-950 dark:text-slate-100 dark:focus-visible:ring-offset-slate-950 lg:col-span-3"
            >
              <option value="">Link a flight (optional)</option>
              {flights.map((flight) => (
                <option key={flight.id} value={flight.id}>
                  {flight.label}
                </option>
              ))}
            </select>

            <Input name="date" type="date" required defaultValue={defaultDate} />
            <Input name="timeOut" type="time" placeholder="Time out" />
            <Input name="timeIn" type="time" placeholder="Time in" />
            <Input name="hobbsOut" type="number" step="0.1" placeholder="Hobbs out" />
            <Input name="hobbsIn" type="number" step="0.1" placeholder="Hobbs in" />

            <div className="lg:col-span-3">
              <p className="text-xs text-slate-600 dark:text-slate-400">
                Total time is computed when you save (PIC/SIC/Dual/Solo preferred; otherwise Hobbs or Time In/Out).
              </p>
            </div>

            <Input name="picTime" type="number" step="0.1" placeholder="PIC" />
            <Input name="dualReceivedTime" type="number" step="0.1" placeholder="Dual rcvd" />
            <Input name="sicTime" type="number" step="0.1" placeholder="SIC" />
            <Input name="soloTime" type="number" step="0.1" placeholder="Solo" />
            <Input name="nightTime" type="number" step="0.1" placeholder="Night" />
            <Input name="xcTime" type="number" step="0.1" placeholder="XC" />
            <Input name="simulatedInstrumentTime" type="number" step="0.1" placeholder="Sim inst" />
            <Input name="instrumentTime" type="number" step="0.1" placeholder="Actual inst" />
            <Input name="simulatorTime" type="number" step="0.1" placeholder="Simulator" />
            <Input name="groundTime" type="number" step="0.1" placeholder="Ground" />
            <Input name="dayTakeoffs" type="number" step="1" placeholder="Day T/O" />
            <Input name="dayLandings" type="number" step="1" placeholder="Day LDG" />
            <Input name="nightTakeoffs" type="number" step="1" placeholder="Night T/O" />
            <Input name="nightLandings" type="number" step="1" placeholder="Night LDG" />
            <Input name="remarks" placeholder="Remarks" className="lg:col-span-3" />

            <div className="lg:col-span-3 flex flex-wrap gap-3">
              <FormSubmitButton type="submit" pendingText="Saving...">
                Save entry
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

