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
  const [selectedAircraftId, setSelectedAircraftId] = useState("");
  const [tailNumber, setTailNumber] = useState("");
  const [unassignedConfirmed, setUnassignedConfirmed] = useState(false);

  const aircraftById = useMemo(() => {
    return new Map(aircraftOptions.map((aircraft) => [aircraft.id, aircraft]));
  }, [aircraftOptions]);

  return (
    <form
      action="/api/flights/create-planned"
      method="post"
      className="grid gap-4 md:grid-cols-2"
    >
      <div className="md:col-span-2 space-y-3">
        {aircraftOptions.length > 0 ? (
          <div>
            <label className="mb-2 block text-xs font-semibold uppercase text-slate-400">
              Aircraft selection
            </label>
            <select
              name="aircraftId"
              className="w-full rounded-md border border-slate-800 bg-transparent px-3 py-2 text-sm text-slate-100"
              required={!unassignedConfirmed}
              value={selectedAircraftId}
              onChange={(event) => {
                const nextId = event.target.value;
                setSelectedAircraftId(nextId);
                if (nextId) {
                  const selected = aircraftById.get(nextId);
                  setTailNumber(selected?.tailNumber ?? "");
                  setUnassignedConfirmed(false);
                } else {
                  setTailNumber("");
                }
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

        <label className="flex items-center gap-2 text-sm text-slate-300">
          <input
            type="checkbox"
            name="unassigned"
            className="h-4 w-4 rounded border-slate-600 bg-slate-950"
            checked={unassignedConfirmed}
            disabled={Boolean(selectedAircraftId)}
            required={!selectedAircraftId}
            onChange={(event) => {
              const confirmed = event.target.checked;
              setUnassignedConfirmed(confirmed);
              if (confirmed) {
                setSelectedAircraftId("");
                setTailNumber("");
              }
            }}
          />
          Confirm this flight has no aircraft profile assigned yet
        </label>
      </div>

      <div>
        <label className="mb-2 block text-xs font-semibold uppercase text-slate-400">
          Tail number
        </label>
        <Input
          name="tailNumber"
          value={tailNumber}
          onChange={(event) => setTailNumber(event.target.value)}
          placeholder="N12345"
          readOnly={Boolean(selectedAircraftId)}
          required={!selectedAircraftId}
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
