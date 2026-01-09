"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { Input } from "@/app/components/ui/input";
import { Button } from "@/app/components/ui/button";
import { FormSubmitButton } from "@/app/components/ui/form-submit-button";

type AircraftOption = {
  id: string;
  tailNumber: string;
  model: string | null;
};

type PlanFlightFormProps = {
  aircraftOptions: AircraftOption[];
};

export function PlanFlightForm({ aircraftOptions }: PlanFlightFormProps) {
  const [tailNumber, setTailNumber] = useState("");

  const aircraftById = useMemo(() => {
    return new Map(aircraftOptions.map((aircraft) => [aircraft.id, aircraft]));
  }, [aircraftOptions]);

  return (
    <form
      action="/api/flights/create-planned"
      method="post"
      className="grid gap-4 md:grid-cols-2"
    >
      {aircraftOptions.length > 0 ? (
        <div className="md:col-span-2">
          <label className="mb-2 block text-xs font-semibold uppercase text-slate-400">
            Aircraft selection
          </label>
          <select
            name="aircraftId"
            className="w-full rounded-md border border-slate-800 bg-transparent px-3 py-2 text-sm text-slate-100"
            onChange={(event) => {
              const selected = aircraftById.get(event.target.value);
              setTailNumber(selected?.tailNumber ?? "");
            }}
          >
            <option value="">Select an aircraft</option>
            {aircraftOptions.map((aircraft) => (
              <option key={aircraft.id} value={aircraft.id}>
                {aircraft.tailNumber}
                {aircraft.model ? ` · ${aircraft.model}` : ""}
              </option>
            ))}
          </select>
        </div>
      ) : null}

      <div>
        <label className="mb-2 block text-xs font-semibold uppercase text-slate-400">
          Tail number (required)
        </label>
        <Input
          name="tailNumber"
          value={tailNumber}
          onChange={(event) => setTailNumber(event.target.value)}
          placeholder="N12345"
          required
        />
      </div>
      <div>
        <label className="mb-2 block text-xs font-semibold uppercase text-slate-400">
          Departure label
        </label>
        <Input name="departureLabel" placeholder="KLAX" />
      </div>
      <div>
        <label className="mb-2 block text-xs font-semibold uppercase text-slate-400">
          Arrival label
        </label>
        <Input name="arrivalLabel" placeholder="KSFO" />
      </div>
      <div>
        <label className="mb-2 block text-xs font-semibold uppercase text-slate-400">
          Planned start time
        </label>
        <Input name="plannedStartTime" type="datetime-local" />
      </div>
      <div>
        <label className="mb-2 block text-xs font-semibold uppercase text-slate-400">
          Planned end time
        </label>
        <Input name="plannedEndTime" type="datetime-local" />
      </div>
      <div className="md:col-span-2 flex flex-wrap gap-3">
        <FormSubmitButton type="submit" pendingText="Planning flight...">
          Create planned flight
        </FormSubmitButton>
        <Button variant="outline" asChild>
          <Link href="/flights">Cancel</Link>
        </Button>
      </div>
    </form>
  );
}
