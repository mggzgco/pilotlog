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

type ParticipantOption = {
  id: string;
  label: string;
};

type PlanFlightFormProps = {
  aircraftOptions: AircraftOption[];
  participantOptions: ParticipantOption[];
};

const roleOptions = ["PIC", "SIC", "INSTRUCTOR", "STUDENT"] as const;

export function PlanFlightForm({
  aircraftOptions,
  participantOptions
}: PlanFlightFormProps) {
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
      className="grid gap-4 lg:grid-cols-2"
    >
      <div className="lg:col-span-2 space-y-3">
        {aircraftOptions.length > 0 ? (
          <div>
            <label className="mb-2 block text-xs font-semibold uppercase text-slate-400">
              Aircraft selection
            </label>
            <select
              name="aircraftId"
              className="h-11 w-full rounded-md border border-slate-800 bg-transparent px-3 py-2 text-sm text-slate-100"
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
            className="h-5 w-5 rounded border-slate-600 bg-slate-950"
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
      <div className="lg:col-span-2">
        <p className="mb-2 text-xs font-semibold uppercase text-slate-400">
          Participants
        </p>
        <div className="grid gap-3 lg:grid-cols-2">
          {[0, 1].map((slot) => (
            <div key={slot} className="grid gap-2 rounded-md border border-slate-800 p-3">
              <label className="text-xs font-semibold uppercase text-slate-400">
                Additional participant {slot + 1}
              </label>
              <select
                name="participantUserId"
                className="h-11 w-full rounded-md border border-slate-800 bg-transparent px-3 py-2 text-sm text-slate-100"
                defaultValue=""
              >
                <option value="">Select a user</option>
                {participantOptions.map((participant) => (
                  <option key={participant.id} value={participant.id}>
                    {participant.label}
                  </option>
                ))}
              </select>
              <select
                name="participantRole"
                className="h-11 w-full rounded-md border border-slate-800 bg-transparent px-3 py-2 text-sm text-slate-100"
                defaultValue="SIC"
              >
                {roleOptions.map((role) => (
                  <option key={role} value={role}>
                    {role}
                  </option>
                ))}
              </select>
            </div>
          ))}
        </div>
      </div>
      <div className="lg:col-span-2 flex flex-wrap gap-3">
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
