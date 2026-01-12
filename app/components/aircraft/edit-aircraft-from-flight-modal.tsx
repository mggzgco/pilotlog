"use client";

import * as Dialog from "@radix-ui/react-dialog";
import { Pencil, X } from "lucide-react";
import { useState } from "react";
import { Button } from "@/app/components/ui/button";
import { Input } from "@/app/components/ui/input";
import { FormSubmitButton } from "@/app/components/ui/form-submit-button";
import { updateAircraftDetailsFromFlightAction } from "@/app/lib/actions/aircraft-actions";

type AircraftCategory =
  | "SINGLE_ENGINE_PISTON"
  | "MULTI_ENGINE_PISTON"
  | "SINGLE_ENGINE_TURBINE"
  | "MULTI_ENGINE_TURBINE"
  | "JET"
  | "HELICOPTER"
  | "GLIDER"
  | "OTHER";

const categoryOptions: Array<{ value: AircraftCategory; label: string }> = [
  { value: "SINGLE_ENGINE_PISTON", label: "Single-engine piston" },
  { value: "MULTI_ENGINE_PISTON", label: "Multi-engine piston" },
  { value: "SINGLE_ENGINE_TURBINE", label: "Single-engine turbine" },
  { value: "MULTI_ENGINE_TURBINE", label: "Multi-engine turbine" },
  { value: "JET", label: "Jet" },
  { value: "HELICOPTER", label: "Helicopter" },
  { value: "GLIDER", label: "Glider" },
  { value: "OTHER", label: "Other" }
];

export function EditAircraftFromFlightModal(props: {
  flightId: string;
  aircraft: {
    id: string;
    tailNumber: string;
    manufacturer: string | null;
    model: string | null;
    category: AircraftCategory | null;
  };
}) {
  const [open, setOpen] = useState(false);

  return (
    <Dialog.Root open={open} onOpenChange={setOpen}>
      <Dialog.Trigger asChild>
        <Button type="button" variant="outline" size="sm">
          <Pencil className="h-4 w-4" />
          Edit aircraft
        </Button>
      </Dialog.Trigger>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-40 bg-slate-950/30 backdrop-blur-sm dark:bg-slate-950/70" />
        <Dialog.Content className="fixed left-1/2 top-1/2 z-50 w-[min(40rem,92vw)] -translate-x-1/2 -translate-y-1/2 rounded-xl border border-slate-200 bg-white p-6 shadow-xl dark:border-slate-800 dark:bg-slate-950">
          <div className="flex items-start justify-between gap-4">
            <div>
              <Dialog.Title className="text-lg font-semibold text-slate-900 dark:text-slate-100">
                Edit aircraft details
              </Dialog.Title>
              <Dialog.Description className="mt-1 text-sm text-slate-600 dark:text-slate-400">
                Updates apply to this aircraft everywhere (not just this flight).
              </Dialog.Description>
            </div>
            <Dialog.Close asChild>
              <button
                className="rounded-md p-2 text-slate-600 transition hover:bg-slate-100 hover:text-slate-900 dark:text-slate-400 dark:hover:bg-slate-900 dark:hover:text-white"
                aria-label="Close"
              >
                <X className="h-4 w-4" />
              </button>
            </Dialog.Close>
          </div>

          <form action={updateAircraftDetailsFromFlightAction} className="mt-6 space-y-4">
            <input type="hidden" name="flightId" value={props.flightId} />
            <input type="hidden" name="aircraftId" value={props.aircraft.id} />

            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-1">
                <p className="text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
                  Tail number
                </p>
                <Input name="tailNumber" required defaultValue={props.aircraft.tailNumber} />
              </div>
              <div className="space-y-1">
                <p className="text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
                  Category
                </p>
                <select
                  name="category"
                  defaultValue={props.aircraft.category ?? "OTHER"}
                  className="h-11 w-full rounded-md border border-slate-200 bg-white px-3 text-sm text-slate-900 shadow-sm dark:border-slate-800 dark:bg-slate-950 dark:text-slate-100"
                >
                  {categoryOptions.map((opt) => (
                    <option key={opt.value} value={opt.value}>
                      {opt.label}
                    </option>
                  ))}
                </select>
              </div>
              <div className="space-y-1">
                <p className="text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
                  Manufacturer
                </p>
                <Input name="manufacturer" defaultValue={props.aircraft.manufacturer ?? ""} />
              </div>
              <div className="space-y-1">
                <p className="text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
                  Model
                </p>
                <Input name="model" defaultValue={props.aircraft.model ?? ""} />
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 pt-2">
              <Dialog.Close asChild>
                <Button type="button" variant="outline">
                  Cancel
                </Button>
              </Dialog.Close>
              <FormSubmitButton pendingText="Saving...">Save aircraft</FormSubmitButton>
            </div>
          </form>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}

