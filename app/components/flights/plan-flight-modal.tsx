"use client";

import * as Dialog from "@radix-ui/react-dialog";
import { useState } from "react";
import { Button } from "@/app/components/ui/button";
import { PlanFlightForm } from "@/app/components/flights/plan-flight-form";

type AircraftOption = {
  id: string;
  tailNumber: string;
  model: string | null;
};

type Option = {
  id: string;
  label: string;
};

export function PlanFlightModal({
  triggerLabel = "Plan a flight",
  aircraftOptions,
  participantOptions,
  personOptions,
  defaultDepartureLabel,
  defaultTimeZone
}: {
  triggerLabel?: string;
  aircraftOptions: AircraftOption[];
  participantOptions: Option[];
  personOptions: Option[];
  defaultDepartureLabel: string;
  defaultTimeZone: string;
}) {
  const [open, setOpen] = useState(false);

  return (
    <Dialog.Root open={open} onOpenChange={setOpen}>
      <Dialog.Trigger asChild>
        <Button variant="outline" className="w-full">
          {triggerLabel}
        </Button>
      </Dialog.Trigger>
      <Dialog.Portal>
        {/* Leaflet panes/controls can have high z-index; keep modal above them. */}
        <Dialog.Overlay className="fixed inset-0 z-[2000] bg-slate-950/70 backdrop-blur-sm" />
        <Dialog.Content className="fixed inset-y-0 right-0 z-[2010] w-full max-w-3xl overflow-y-auto border-l border-slate-200 bg-white p-6 shadow-xl dark:border-slate-800 dark:bg-slate-950">
          <div className="space-y-1">
            <Dialog.Title className="text-lg font-semibold text-slate-900 dark:text-slate-100">
              Plan a flight
            </Dialog.Title>
            <Dialog.Description className="text-sm text-slate-600 dark:text-slate-400">
              Create a planned flight without leaving the dashboard.
            </Dialog.Description>
          </div>

          <div className="mt-6">
            <PlanFlightForm
              aircraftOptions={aircraftOptions}
              participantOptions={participantOptions}
              personOptions={personOptions}
              defaultDepartureLabel={defaultDepartureLabel}
              defaultTimeZone={defaultTimeZone}
              onCancel={() => setOpen(false)}
            />
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}

