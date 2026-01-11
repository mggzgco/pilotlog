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
  personOptions: ParticipantOption[];
  defaultDepartureLabel: string;
  defaultTimeZone: string;
  cancelHref?: string;
  onCancel?: () => void;
};

const roleOptions = ["PIC", "SIC", "INSTRUCTOR", "STUDENT"] as const;
const personRoleOptions = ["PASSENGER", ...roleOptions] as const;

type ParticipantRow = { id: string; role: string };

function normalizeClockInput(raw: string): string | null {
  const trimmed = raw.trim().toLowerCase();
  if (!trimmed) return null;

  // 0630 -> 06:30
  const compact = /^(\d{2})(\d{2})$/.exec(trimmed);
  if (compact) {
    const hour = Number(compact[1]);
    const minute = Number(compact[2]);
    if (hour >= 0 && hour <= 23 && minute >= 0 && minute <= 59) {
      return `${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}`;
    }
  }

  // 6:30, 06:30, 6.30, 6:30pm, 6:30 pm
  const hm = /^(\d{1,2})[:.](\d{2})\s*(am|pm)?$/.exec(trimmed);
  if (hm) {
    let hour = Number(hm[1]);
    const minute = Number(hm[2]);
    const suffix = hm[3] ?? null;
    if (!Number.isFinite(hour) || !Number.isFinite(minute)) return null;
    if (minute < 0 || minute > 59) return null;

    if (suffix) {
      if (hour < 1 || hour > 12) return null;
      if (suffix === "am") {
        hour = hour === 12 ? 0 : hour;
      } else {
        hour = hour === 12 ? 12 : hour + 12;
      }
    } else {
      if (hour < 0 || hour > 23) return null;
    }

    return `${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}`;
  }

  return null;
}

export function PlanFlightForm({
  aircraftOptions,
  participantOptions,
  personOptions,
  defaultDepartureLabel,
  defaultTimeZone,
  cancelHref = "/flights",
  onCancel
}: PlanFlightFormProps) {
  const [selectedAircraftId, setSelectedAircraftId] = useState("");
  const [tailNumber, setTailNumber] = useState("");
  const [unassignedConfirmed, setUnassignedConfirmed] = useState(false);
  const [stops, setStops] = useState<string[]>([]);
  const [userParticipants, setUserParticipants] = useState<ParticipantRow[]>([]);
  const [peopleParticipants, setPeopleParticipants] = useState<ParticipantRow[]>([]);
  const [plannedStartClock, setPlannedStartClock] = useState("");
  const [plannedEndClock, setPlannedEndClock] = useState("");

  const aircraftById = useMemo(() => {
    return new Map(aircraftOptions.map((aircraft) => [aircraft.id, aircraft]));
  }, [aircraftOptions]);

  return (
    <form
      action="/api/flights/create-planned"
      method="post"
      className="grid gap-4 lg:grid-cols-2"
    >
      {/* If the airport code is recognized, the server will automatically use that airport’s time zone (DST-aware).
          This hidden fallback is only used when the airport time zone can't be derived. */}
      <input type="hidden" name="timeZone" value={defaultTimeZone || "UTC"} />
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
        <Input name="departureLabel" placeholder="KLOM" defaultValue={defaultDepartureLabel} />
      </div>
      <div>
        <label className="mb-2 block text-xs font-semibold uppercase text-slate-400">
          Arrival label
        </label>
        <Input name="arrivalLabel" placeholder="KSFO" />
      </div>
      <div className="lg:col-span-2">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <label className="mb-2 block text-xs font-semibold uppercase text-slate-400">
            Interim stops (optional)
          </label>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => setStops((prev) => [...prev, ""])}
          >
            Add stop
          </Button>
        </div>
        {stops.length === 0 ? (
          <p className="text-sm text-slate-600 dark:text-slate-400">
            Add 1–2 stops if you depart, land somewhere, then continue to your final destination.
          </p>
        ) : (
          <div className="space-y-2">
            {stops.map((value, index) => (
              <div key={index} className="flex items-center gap-2">
                <Input
                  name="stopLabel"
                  placeholder={`Stop ${index + 1} (e.g. KABE)`}
                  value={value}
                  onChange={(event) =>
                    setStops((prev) =>
                      prev.map((v, i) => (i === index ? event.target.value : v))
                    )
                  }
                />
                <Button
                  type="button"
                  variant="ghost"
                  onClick={() => setStops((prev) => prev.filter((_, i) => i !== index))}
                >
                  Remove
                </Button>
              </div>
            ))}
          </div>
        )}
      </div>
      <div className="lg:col-span-2 rounded-md border border-slate-200 bg-white p-3 text-sm text-slate-700 dark:border-slate-800 dark:bg-slate-950 dark:text-slate-300">
        <p className="font-medium text-slate-900 dark:text-slate-100">Time zone</p>
        <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">
          Automatically derived from the selected airports (DST-aware). If an airport isn’t recognized, we fall back to
          your profile home time zone.
        </p>
      </div>
      <div>
        <label className="mb-2 block text-xs font-semibold uppercase text-slate-400">
          Planned start (date)
        </label>
        <Input name="plannedStartDate" type="date" />
      </div>
      <div>
        <label className="mb-2 block text-xs font-semibold uppercase text-slate-400">
          Planned start (24h)
        </label>
        <Input
          name="plannedStartClock"
          type="text"
          inputMode="text"
          placeholder='Examples: "06:30" or "0630"'
          value={plannedStartClock}
          onChange={(event) => setPlannedStartClock(event.target.value)}
          onBlur={() => {
            const normalized = normalizeClockInput(plannedStartClock);
            if (normalized) setPlannedStartClock(normalized);
          }}
        />
      </div>
      <div>
        <label className="mb-2 block text-xs font-semibold uppercase text-slate-400">
          Planned end (date)
        </label>
        <Input name="plannedEndDate" type="date" />
      </div>
      <div>
        <label className="mb-2 block text-xs font-semibold uppercase text-slate-400">
          Planned end (24h)
        </label>
        <Input
          name="plannedEndClock"
          type="text"
          inputMode="text"
          placeholder='Examples: "08:10" or "0810"'
          value={plannedEndClock}
          onChange={(event) => setPlannedEndClock(event.target.value)}
          onBlur={() => {
            const normalized = plannedEndClock ? normalizeClockInput(plannedEndClock) : null;
            if (normalized) setPlannedEndClock(normalized);
          }}
        />
      </div>
      <div className="lg:col-span-2">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <p className="text-xs font-semibold uppercase text-slate-400">App users</p>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => setUserParticipants((prev) => [...prev, { id: "", role: "SIC" }])}
          >
            Add user
          </Button>
        </div>
        {userParticipants.length === 0 ? (
          <p className="mt-2 text-sm text-slate-600 dark:text-slate-400">
            Add instructors/students/PIC/SIC who have PilotLog accounts.
          </p>
        ) : (
          <div className="mt-2 grid gap-3 lg:grid-cols-2">
            {userParticipants.map((participant, index) => (
              <div
                key={`user-${index}`}
                className="grid gap-2 rounded-md border border-slate-800 p-3"
              >
                <select
                  name="participantUserId"
                  className="h-11 w-full rounded-md border border-slate-800 bg-transparent px-3 py-2 text-sm text-slate-100"
                  value={participant.id}
                  onChange={(event) =>
                    setUserParticipants((prev) =>
                      prev.map((row, i) =>
                        i === index ? { ...row, id: event.target.value } : row
                      )
                    )
                  }
                >
                  <option value="">Select a user</option>
                  {participantOptions.map((entry) => (
                    <option key={entry.id} value={entry.id}>
                      {entry.label}
                    </option>
                  ))}
                </select>
                <div className="grid grid-cols-[1fr,auto] gap-2">
                  <select
                    name="participantRole"
                    className="h-11 w-full rounded-md border border-slate-800 bg-transparent px-3 py-2 text-sm text-slate-100"
                    value={participant.role}
                    onChange={(event) =>
                      setUserParticipants((prev) =>
                        prev.map((row, i) =>
                          i === index ? { ...row, role: event.target.value } : row
                        )
                      )
                    }
                  >
                    {roleOptions.map((role) => (
                      <option key={role} value={role}>
                        {role}
                      </option>
                    ))}
                  </select>
                  <Button
                    type="button"
                    variant="ghost"
                    onClick={() => setUserParticipants((prev) => prev.filter((_, i) => i !== index))}
                  >
                    Remove
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="lg:col-span-2">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <p className="text-xs font-semibold uppercase text-slate-400">People</p>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() =>
              setPeopleParticipants((prev) => [...prev, { id: "", role: "PASSENGER" }])
            }
          >
            Add person
          </Button>
        </div>
        {peopleParticipants.length === 0 ? (
          <p className="mt-2 text-sm text-slate-600 dark:text-slate-400">
            Add passengers/instructors who don’t have an account. Manage your people list in{" "}
            <Link className="underline underline-offset-2" href="/profile">
              Profile
            </Link>
            .
          </p>
        ) : (
          <div className="mt-2 grid gap-3 lg:grid-cols-2">
            {peopleParticipants.map((participant, index) => (
              <div
                key={`person-${index}`}
                className="grid gap-2 rounded-md border border-slate-800 p-3"
              >
                <select
                  name="participantPersonId"
                  className="h-11 w-full rounded-md border border-slate-800 bg-transparent px-3 py-2 text-sm text-slate-100"
                  value={participant.id}
                  onChange={(event) =>
                    setPeopleParticipants((prev) =>
                      prev.map((row, i) =>
                        i === index ? { ...row, id: event.target.value } : row
                      )
                    )
                  }
                >
                  <option value="">Select a person</option>
                  {personOptions.map((entry) => (
                    <option key={entry.id} value={entry.id}>
                      {entry.label}
                    </option>
                  ))}
                </select>
                <div className="grid grid-cols-[1fr,auto] gap-2">
                  <select
                    name="participantPersonRole"
                    className="h-11 w-full rounded-md border border-slate-800 bg-transparent px-3 py-2 text-sm text-slate-100"
                    value={participant.role}
                    onChange={(event) =>
                      setPeopleParticipants((prev) =>
                        prev.map((row, i) =>
                          i === index ? { ...row, role: event.target.value } : row
                        )
                      )
                    }
                  >
                    {personRoleOptions.map((role) => (
                      <option key={role} value={role}>
                        {role}
                      </option>
                    ))}
                  </select>
                  <Button
                    type="button"
                    variant="ghost"
                    onClick={() => setPeopleParticipants((prev) => prev.filter((_, i) => i !== index))}
                  >
                    Remove
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
      <div className="lg:col-span-2 flex flex-wrap gap-3">
        <FormSubmitButton type="submit" pendingText="Planning flight...">
          Create planned flight
        </FormSubmitButton>
        {onCancel ? (
          <Button type="button" variant="outline" onClick={onCancel}>
            Cancel
          </Button>
        ) : (
          <Button variant="outline" asChild>
            <Link href={cancelHref}>Cancel</Link>
          </Button>
        )}
      </div>
    </form>
  );
}
