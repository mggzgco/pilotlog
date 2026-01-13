"use client";

import * as Dialog from "@radix-ui/react-dialog";
import type { ReactNode } from "react";
import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { X } from "lucide-react";
import { Button } from "@/app/components/ui/button";
import { Input } from "@/app/components/ui/input";
import { useToast } from "@/app/components/ui/toast-provider";

type AircraftOption = { id: string; tailNumber: string; model: string | null };
type Option = { id: string; label: string };
type ParticipantRow = { id: string; role: string };

const selfRoleOptions = ["PIC", "SIC", "INSTRUCTOR", "STUDENT", "PASSENGER"] as const;
const personRoleOptions = ["PASSENGER", "PIC", "SIC", "INSTRUCTOR", "STUDENT"] as const;

export function EditFlightModal(props: {
  flightId: string;
  triggerLabel?: string;
  triggerClassName?: string;
  triggerIcon?: ReactNode;
  triggerVariant?: React.ComponentProps<typeof Button>["variant"];
  triggerSize?: React.ComponentProps<typeof Button>["size"];
  aircraftOptions: AircraftOption[];
  personOptions: Option[];
  initial: {
    aircraftId: string | null;
    tailNumber: string;
    origin: string;
    destination: string | null;
    plannedStartTime: string | null;
    plannedEndTime: string | null;
    startTime: string | null;
    endTime: string | null;
    stops: string[];
    selfRole: string;
    peopleParticipants: ParticipantRow[]; // person participants
  };
}) {
  const {
    flightId,
    triggerLabel = "Edit flight",
    triggerClassName,
    triggerIcon,
    triggerVariant = "outline",
    triggerSize = "sm",
    aircraftOptions,
    personOptions,
    initial
  } = props;

  const router = useRouter();
  const { addToast } = useToast();
  const [open, setOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const [selectedAircraftId, setSelectedAircraftId] = useState(initial.aircraftId ?? "");
  const [unassignedConfirmed, setUnassignedConfirmed] = useState(!initial.aircraftId);
  const [tailNumber, setTailNumber] = useState(initial.tailNumber);
  const [origin, setOrigin] = useState(initial.origin);
  const [destination, setDestination] = useState(initial.destination ?? "");
  const [stops, setStops] = useState<string[]>(initial.stops);
  const [plannedStartTime, setPlannedStartTime] = useState(initial.plannedStartTime ?? "");
  const [plannedEndTime, setPlannedEndTime] = useState(initial.plannedEndTime ?? "");
  const [startTime, setStartTime] = useState(initial.startTime ?? "");
  const [endTime, setEndTime] = useState(initial.endTime ?? "");
  const [selfRole, setSelfRole] = useState(initial.selfRole || "PIC");
  const [peopleParticipants, setPeopleParticipants] = useState<ParticipantRow[]>(
    initial.peopleParticipants
  );

  const aircraftById = useMemo(
    () => new Map(aircraftOptions.map((a) => [a.id, a])),
    [aircraftOptions]
  );

  const submit = async () => {
    setErrorMessage(null);
    if (!origin.trim()) {
      setErrorMessage("Origin is required.");
      return;
    }
    if (!tailNumber.trim()) {
      setErrorMessage("Tail number is required.");
      return;
    }

    setIsSubmitting(true);
    try {
      const formData = new FormData();
      formData.append("tailNumber", tailNumber.trim());
      formData.append("origin", origin.trim());
      if (destination.trim()) formData.append("destination", destination.trim());
      if (!unassignedConfirmed && selectedAircraftId) formData.append("aircraftId", selectedAircraftId);
      if (unassignedConfirmed) formData.append("unassigned", "on");

      if (plannedStartTime) formData.append("plannedStartTime", plannedStartTime);
      if (plannedEndTime) formData.append("plannedEndTime", plannedEndTime);
      if (startTime) formData.append("startTime", startTime);
      if (endTime) formData.append("endTime", endTime);
      formData.append("selfRole", selfRole);

      stops.forEach((s) => {
        const trimmed = s.trim();
        if (trimmed) formData.append("stopLabel", trimmed);
      });

      peopleParticipants.forEach((p) => {
        formData.append("participantPersonId", p.id);
        formData.append("participantPersonRole", p.role);
      });

      const res = await fetch(`/api/flights/${flightId}/update`, {
        method: "POST",
        body: formData,
        headers: { accept: "application/json" }
      });
      const json = (await res.json().catch(() => null)) as { ok?: boolean; error?: string } | null;
      if (!res.ok) {
        setErrorMessage(json?.error ?? "Failed to update flight.");
        return;
      }
      addToast("Flight updated.", "success");
      setOpen(false);
      router.refresh();
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog.Root open={open} onOpenChange={setOpen}>
      <Dialog.Trigger asChild>
        <Button variant={triggerVariant} size={triggerSize} className={triggerClassName}>
          {triggerIcon ?? triggerLabel}
        </Button>
      </Dialog.Trigger>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-[2000] bg-slate-950/70 backdrop-blur-sm" />
        <Dialog.Content className="fixed inset-y-0 right-0 z-[2010] w-full max-w-3xl overflow-y-auto border-l border-slate-200 bg-white p-6 shadow-xl dark:border-slate-800 dark:bg-slate-950">
          <div className="flex items-start justify-between gap-4">
            <div>
              <Dialog.Title className="text-lg font-semibold text-slate-900 dark:text-slate-100">
                Edit flight
              </Dialog.Title>
              <Dialog.Description className="text-sm text-slate-600 dark:text-slate-400">
                Update route, timing, and participants.
              </Dialog.Description>
            </div>
            <Dialog.Close asChild>
              <button
                type="button"
                className="rounded-md border border-slate-200 p-2 text-slate-600 transition hover:text-slate-900 dark:border-slate-800 dark:text-slate-400 dark:hover:text-slate-100"
                aria-label="Close edit flight dialog"
              >
                <X className="h-4 w-4" />
              </button>
            </Dialog.Close>
          </div>

          <div className="mt-6 grid gap-4 lg:grid-cols-2">
            <div className="lg:col-span-2 space-y-3">
              {aircraftOptions.length > 0 ? (
                <div>
                  <label className="mb-2 block text-xs font-semibold uppercase text-slate-400">
                    Aircraft selection
                  </label>
                  <select
                    name="aircraftId"
                    className="h-11 w-full rounded-md border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 shadow-sm dark:border-slate-800 dark:bg-slate-950 dark:text-slate-100"
                    value={selectedAircraftId}
                    onChange={(event) => {
                      const nextId = event.target.value;
                      setSelectedAircraftId(nextId);
                      if (nextId) {
                        const selected = aircraftById.get(nextId);
                        setTailNumber(selected?.tailNumber ?? "");
                        setUnassignedConfirmed(false);
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
                  className="h-5 w-5 rounded border-slate-600 bg-slate-950"
                  checked={unassignedConfirmed}
                  disabled={Boolean(selectedAircraftId)}
                  onChange={(event) => {
                    const confirmed = event.target.checked;
                    setUnassignedConfirmed(confirmed);
                    if (confirmed) setSelectedAircraftId("");
                  }}
                />
                Confirm this flight has no aircraft profile assigned yet
              </label>
            </div>

            <div>
              <label className="mb-2 block text-xs font-semibold uppercase text-slate-400">Tail number</label>
              <Input value={tailNumber} onChange={(e) => setTailNumber(e.target.value)} />
            </div>
            <div>
              <label className="mb-2 block text-xs font-semibold uppercase text-slate-400">Origin</label>
              <Input value={origin} onChange={(e) => setOrigin(e.target.value)} />
            </div>
            <div>
              <label className="mb-2 block text-xs font-semibold uppercase text-slate-400">Destination</label>
              <Input value={destination} onChange={(e) => setDestination(e.target.value)} />
            </div>

            <div className="lg:col-span-2">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <label className="mb-2 block text-xs font-semibold uppercase text-slate-400">
                  Interim stops (optional)
                </label>
                <Button type="button" variant="outline" size="sm" onClick={() => setStops((p) => [...p, ""])}>
                  Add stop
                </Button>
              </div>
              {stops.length === 0 ? (
                <p className="text-sm text-slate-600 dark:text-slate-400">No stops.</p>
              ) : (
                <div className="space-y-2">
                  {stops.map((value, index) => (
                    <div key={index} className="flex items-center gap-2">
                      <Input
                        placeholder={`Stop ${index + 1} (e.g. KABE)`}
                        value={value}
                        onChange={(event) =>
                          setStops((prev) => prev.map((v, i) => (i === index ? event.target.value : v)))
                        }
                      />
                      <Button type="button" variant="ghost" onClick={() => setStops((p) => p.filter((_, i) => i !== index))}>
                        Remove
                      </Button>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div>
              <label className="mb-2 block text-xs font-semibold uppercase text-slate-400">Planned start</label>
              <Input type="datetime-local" value={plannedStartTime} onChange={(e) => setPlannedStartTime(e.target.value)} />
            </div>
            <div>
              <label className="mb-2 block text-xs font-semibold uppercase text-slate-400">Planned end</label>
              <Input type="datetime-local" value={plannedEndTime} onChange={(e) => setPlannedEndTime(e.target.value)} />
            </div>
            <div>
              <label className="mb-2 block text-xs font-semibold uppercase text-slate-400">Actual start</label>
              <Input type="datetime-local" value={startTime} onChange={(e) => setStartTime(e.target.value)} />
            </div>
            <div>
              <label className="mb-2 block text-xs font-semibold uppercase text-slate-400">Actual end</label>
              <Input type="datetime-local" value={endTime} onChange={(e) => setEndTime(e.target.value)} />
            </div>

            <div className="lg:col-span-2">
              <label className="mb-2 block text-xs font-semibold uppercase text-slate-400">
                Your role
              </label>
              <select
                className="h-11 w-full rounded-md border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 shadow-sm dark:border-slate-800 dark:bg-slate-950 dark:text-slate-100"
                value={selfRole}
                onChange={(event) => setSelfRole(event.target.value)}
                required
              >
                {selfRoleOptions.map((role) => (
                  <option key={role} value={role}>
                    {role}
                  </option>
                ))}
              </select>
            </div>

            <div className="lg:col-span-2">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="text-xs font-semibold uppercase text-slate-400">People</p>
                <Button type="button" variant="outline" size="sm" onClick={() => setPeopleParticipants((p) => [...p, { id: "", role: "PASSENGER" }])}>
                  Add person
                </Button>
              </div>
              {peopleParticipants.length === 0 ? (
                <p className="mt-2 text-sm text-slate-600 dark:text-slate-400">No people attached.</p>
              ) : (
                <div className="mt-2 grid gap-3 lg:grid-cols-2">
                  {peopleParticipants.map((participant, index) => (
                    <div key={`person-${index}`} className="grid gap-2 rounded-md border border-slate-800 p-3">
                      <select
                        className="h-11 w-full rounded-md border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 shadow-sm dark:border-slate-800 dark:bg-slate-950 dark:text-slate-100"
                        value={participant.id}
                        onChange={(event) => setPeopleParticipants((prev) => prev.map((row, i) => (i === index ? { ...row, id: event.target.value } : row)))}
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
                          className="h-11 w-full rounded-md border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 shadow-sm dark:border-slate-800 dark:bg-slate-950 dark:text-slate-100"
                          value={participant.role}
                          onChange={(event) => setPeopleParticipants((prev) => prev.map((row, i) => (i === index ? { ...row, role: event.target.value } : row)))}
                        >
                          {personRoleOptions.map((role) => (
                            <option key={role} value={role}>
                              {role}
                            </option>
                          ))}
                        </select>
                        <Button type="button" variant="ghost" onClick={() => setPeopleParticipants((p) => p.filter((_, i) => i !== index))}>
                          Remove
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {errorMessage ? (
              <div className="lg:col-span-2 rounded-lg border border-rose-500/40 bg-rose-500/10 p-3 text-sm text-rose-200">
                {errorMessage}
              </div>
            ) : null}

            <div className="lg:col-span-2 flex flex-wrap gap-3">
              <Button type="button" disabled={isSubmitting} onClick={submit}>
                {isSubmitting ? "Saving..." : "Save changes"}
              </Button>
              <Button type="button" variant="outline" onClick={() => setOpen(false)}>
                Cancel
              </Button>
            </div>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}

