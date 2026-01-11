"use client";

import * as Dialog from "@radix-ui/react-dialog";
import { Plus, X } from "lucide-react";
import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/app/components/ui/button";
import { Input } from "@/app/components/ui/input";
import { FormSubmitButton } from "@/app/components/ui/form-submit-button";
import { participantRoleOptions } from "@/app/lib/flights/participants";
import { useToast } from "@/app/components/ui/toast-provider";

type AircraftOption = {
  id: string;
  tailNumber: string;
  model: string | null;
};

type PersonOption = {
  id: string;
  label: string;
};

type ParticipantOption = {
  id: string;
  label: string;
};

type ParticipantRow = {
  id: string;
  role: string;
};

type CreateFlightModalProps = {
  aircraftOptions: AircraftOption[];
  participantOptions: ParticipantOption[];
  personOptions: PersonOption[];
  triggerLabel?: string;
};

const newOptionValue = "__create__";

export function CreateFlightModal({
  aircraftOptions,
  participantOptions,
  personOptions,
  triggerLabel = "Create Flight"
}: CreateFlightModalProps) {
  const router = useRouter();
  const { addToast } = useToast();
  const [open, setOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [aircraftDialogOpen, setAircraftDialogOpen] = useState(false);
  const [personDialogOpen, setPersonDialogOpen] = useState(false);
  const [pendingPersonIndex, setPendingPersonIndex] = useState<number | null>(null);
  const [aircraftList, setAircraftList] = useState<AircraftOption[]>(aircraftOptions);
  const [peopleList, setPeopleList] = useState<PersonOption[]>(personOptions);
  const [userParticipants, setUserParticipants] = useState<ParticipantRow[]>([
    { id: "", role: "SIC" }
  ]);
  const [peopleParticipants, setPeopleParticipants] = useState<ParticipantRow[]>([
    { id: "", role: "SIC" }
  ]);
  const [selectedAircraftId, setSelectedAircraftId] = useState("");
  const [newAircraftTailNumber, setNewAircraftTailNumber] = useState("");
  const [newAircraftModel, setNewAircraftModel] = useState("");
  const [newPersonName, setNewPersonName] = useState("");
  const [newPersonEmail, setNewPersonEmail] = useState("");
  const [plannedStartDate, setPlannedStartDate] = useState("");
  const [plannedStartClock, setPlannedStartClock] = useState("");
  const [plannedEndDate, setPlannedEndDate] = useState("");
  const [plannedEndClock, setPlannedEndClock] = useState("");
  const [stops, setStops] = useState<string[]>([]);

  const aircraftOptionsSorted = useMemo(() => {
    return [...aircraftList].sort((a, b) => a.tailNumber.localeCompare(b.tailNumber));
  }, [aircraftList]);

  const personOptionsSorted = useMemo(() => {
    return [...peopleList].sort((a, b) => a.label.localeCompare(b.label));
  }, [peopleList]);

  const resetForm = () => {
    setSelectedAircraftId("");
    setUserParticipants([{ id: "", role: "SIC" }]);
    setPeopleParticipants([{ id: "", role: "SIC" }]);
    setPlannedStartDate("");
    setPlannedStartClock("");
    setPlannedEndDate("");
    setPlannedEndClock("");
    setStops([]);
    setErrorMessage(null);
  };

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setErrorMessage(null);

    setIsSubmitting(true);
    try {
      const formData = new FormData(event.currentTarget);
      // Normalize stop labels from client-side state (ensures removed rows don't submit stale values).
      formData.delete("stopLabel");
      stops
        .map((s) => s.trim())
        .filter(Boolean)
        .slice(0, 5)
        .forEach((s) => formData.append("stopLabel", s));
      const response = await fetch("/api/flights/create-planned-inline", {
        method: "POST",
        body: formData
      });

      if (!response.ok) {
        const payload = await response.json().catch(() => ({}));
        setErrorMessage(payload.error ?? "Unable to create planned flight.");
        return;
      }

      addToast("Planned flight created.", "success");
      setOpen(false);
      resetForm();
      router.refresh();
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleCreateAircraft = async () => {
    if (!newAircraftTailNumber.trim()) {
      setErrorMessage("Tail number is required to create an aircraft.");
      return;
    }
    const response = await fetch("/api/aircraft/create", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        tailNumber: newAircraftTailNumber.trim(),
        model: newAircraftModel.trim() || undefined
      })
    });

    if (!response.ok) {
      const payload = await response.json().catch(() => ({}));
      setErrorMessage(payload.error ?? "Unable to create aircraft.");
      return;
    }

    const created: AircraftOption = await response.json();
    setAircraftList((prev) => [...prev, created]);
    setSelectedAircraftId(created.id);
    setNewAircraftTailNumber("");
    setNewAircraftModel("");
    setAircraftDialogOpen(false);
  };

  const handleCreatePerson = async () => {
    if (!newPersonName.trim()) {
      setErrorMessage("Name is required to create a person.");
      return;
    }
    const response = await fetch("/api/people/create", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: newPersonName.trim(),
        email: newPersonEmail.trim()
      })
    });

    if (!response.ok) {
      const payload = await response.json().catch(() => ({}));
      setErrorMessage(payload.error ?? "Unable to create person.");
      return;
    }

    const created = (await response.json()) as { id: string; name: string; email: string | null };
    const label = created.email ? `${created.name} · ${created.email}` : created.name;
    const nextPerson = { id: created.id, label };
    setPeopleList((prev) => [...prev, nextPerson]);
    if (pendingPersonIndex !== null) {
      setPeopleParticipants((prev) =>
        prev.map((entry, index) =>
          index === pendingPersonIndex ? { ...entry, id: created.id } : entry
        )
      );
    }
    setPendingPersonIndex(null);
    setNewPersonName("");
    setNewPersonEmail("");
    setPersonDialogOpen(false);
  };

  return (
    <Dialog.Root
      open={open}
      onOpenChange={(nextOpen) => {
        setOpen(nextOpen);
        if (!nextOpen) {
          resetForm();
        }
      }}
    >
      <Dialog.Trigger asChild>
        <Button>{triggerLabel}</Button>
      </Dialog.Trigger>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-40 bg-slate-950/70 backdrop-blur-sm" />
        <Dialog.Content className="fixed inset-y-0 right-0 z-50 w-full max-w-2xl overflow-y-auto border-l border-slate-200 bg-white p-6 shadow-xl dark:border-slate-800 dark:bg-slate-950">
          <div className="flex items-start justify-between gap-4">
            <div>
              <Dialog.Title className="text-lg font-semibold text-slate-900 dark:text-slate-100">
                Plan a flight
              </Dialog.Title>
              <Dialog.Description className="text-sm text-slate-600 dark:text-slate-400">
                Schedule a planned flight and add participants without leaving this page.
              </Dialog.Description>
            </div>
            <Dialog.Close asChild>
              <button
                type="button"
                className="rounded-md border border-slate-200 p-2 text-slate-600 transition hover:text-slate-900 dark:border-slate-800 dark:text-slate-400 dark:hover:text-slate-100"
                aria-label="Close create flight dialog"
              >
                <X className="h-4 w-4" />
              </button>
            </Dialog.Close>
          </div>

          <form onSubmit={handleSubmit} className="mt-6 space-y-6">
            <section className="space-y-4">
              <div>
                <p className="text-xs font-semibold uppercase text-slate-600 dark:text-slate-400">
                  Flight plan
                </p>
              </div>
              <div className="grid gap-4 md:grid-cols-2">
                <div>
                  <label className="mb-2 block text-xs font-semibold uppercase text-slate-600 dark:text-slate-400">
                    Scheduled start
                  </label>
                  <Input
                    name="plannedStartDate"
                    type="date"
                    required
                    value={plannedStartDate}
                    onChange={(event) => setPlannedStartDate(event.target.value)}
                  />
                  <Input
                    name="plannedStartClock"
                    type="time"
                    step={60}
                    required
                    value={plannedStartClock}
                    onChange={(event) => setPlannedStartClock(event.target.value)}
                    className="mt-2"
                  />
                </div>
                <div>
                  <label className="mb-2 block text-xs font-semibold uppercase text-slate-600 dark:text-slate-400">
                    Scheduled end
                  </label>
                  <Input
                    name="plannedEndDate"
                    type="date"
                    value={plannedEndDate}
                    onChange={(event) => setPlannedEndDate(event.target.value)}
                  />
                  <Input
                    name="plannedEndClock"
                    type="time"
                    step={60}
                    value={plannedEndClock}
                    onChange={(event) => setPlannedEndClock(event.target.value)}
                    className="mt-2"
                  />
                </div>
                <div>
                  <label className="mb-2 block text-xs font-semibold uppercase text-slate-600 dark:text-slate-400">
                    From
                  </label>
                  <Input name="origin" placeholder="Origin airport" required />
                </div>
                <div>
                  <label className="mb-2 block text-xs font-semibold uppercase text-slate-600 dark:text-slate-400">
                    To
                  </label>
                  <Input name="destination" placeholder="Destination airport" required />
                </div>
                <div className="md:col-span-2">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <p className="text-xs font-semibold uppercase text-slate-600 dark:text-slate-400">
                      Interim stops (optional)
                    </p>
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
                    <p className="mt-2 text-sm text-slate-600 dark:text-slate-400">
                      Add stops if you land somewhere in between (e.g., origin → stop1 → stop2 → destination).
                    </p>
                  ) : (
                    <div className="mt-2 space-y-2">
                      {stops.map((value, index) => (
                        <div key={index} className="flex items-center gap-2">
                          <Input
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
                <div className="md:col-span-2">
                  <label className="mb-2 block text-xs font-semibold uppercase text-slate-600 dark:text-slate-400">
                    Aircraft
                  </label>
                  <select
                    name="aircraftId"
                    className="h-11 w-full rounded-md border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 dark:border-slate-800 dark:bg-slate-950 dark:text-slate-100"
                    required
                    value={selectedAircraftId}
                    onChange={(event) => {
                      if (event.target.value === newOptionValue) {
                        setSelectedAircraftId("");
                        setAircraftDialogOpen(true);
                      } else {
                        setSelectedAircraftId(event.target.value);
                      }
                    }}
                  >
                    <option value="">Select an aircraft</option>
                    {aircraftOptionsSorted.map((aircraft) => (
                      <option key={aircraft.id} value={aircraft.id}>
                        {aircraft.tailNumber}
                        {aircraft.model ? ` · ${aircraft.model}` : ""}
                      </option>
                    ))}
                    <option value={newOptionValue}>Create new aircraft…</option>
                  </select>
                </div>
              </div>
            </section>

            <section className="space-y-4">
              <div>
                <p className="text-xs font-semibold uppercase text-slate-600 dark:text-slate-400">
                  People
                </p>
              </div>
              <div className="space-y-4">
                <div className="space-y-2">
                  <div className="flex items-center justify-between gap-4">
                    <p className="text-sm font-semibold text-slate-900 dark:text-slate-200">App users</p>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() =>
                        setUserParticipants((prev) => [...prev, { id: "", role: "SIC" }])
                      }
                    >
                      <Plus className="mr-2 h-4 w-4" />
                      Add user
                    </Button>
                  </div>
                  {userParticipants.map((participant, index) => (
                    <div
                      key={`user-${index}`}
                      className="grid gap-3 rounded-md border border-slate-800 p-3 md:grid-cols-[2fr,1fr,auto]"
                    >
                      <select
                        name="participantUserId"
                        className="h-11 w-full rounded-md border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 dark:border-slate-800 dark:bg-slate-950 dark:text-slate-100"
                        value={participant.id}
                        onChange={(event) =>
                          setUserParticipants((prev) =>
                            prev.map((entry, entryIndex) =>
                              entryIndex === index
                                ? { ...entry, id: event.target.value }
                                : entry
                            )
                          )
                        }
                      >
                        <option value="">Select a user</option>
                        {participantOptions.map((participantOption) => (
                          <option key={participantOption.id} value={participantOption.id}>
                            {participantOption.label}
                          </option>
                        ))}
                      </select>
                      <select
                        name="participantUserRole"
                        className="h-11 w-full rounded-md border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 dark:border-slate-800 dark:bg-slate-950 dark:text-slate-100"
                        value={participant.role}
                        onChange={(event) =>
                          setUserParticipants((prev) =>
                            prev.map((entry, entryIndex) =>
                              entryIndex === index
                                ? { ...entry, role: event.target.value }
                                : entry
                            )
                          )
                        }
                      >
                        {participantRoleOptions.map((role) => (
                          <option key={role} value={role}>
                            {role}
                          </option>
                        ))}
                      </select>
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="self-center text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-100"
                        onClick={() =>
                          setUserParticipants((prev) =>
                            prev.length === 1
                              ? prev.map((entry, entryIndex) =>
                                  entryIndex === index ? { ...entry, id: "" } : entry
                                )
                              : prev.filter((_, entryIndex) => entryIndex !== index)
                          )
                        }
                      >
                        <X className="h-4 w-4" />
                      </Button>
                    </div>
                  ))}
                </div>

                <div className="space-y-2">
                  <div className="flex items-center justify-between gap-4">
                    <p className="text-sm font-semibold text-slate-900 dark:text-slate-200">People</p>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() =>
                        setPeopleParticipants((prev) => [...prev, { id: "", role: "SIC" }])
                      }
                    >
                      <Plus className="mr-2 h-4 w-4" />
                      Add person
                    </Button>
                  </div>
                  {peopleParticipants.map((participant, index) => (
                    <div
                      key={`person-${index}`}
                      className="grid gap-3 rounded-md border border-slate-800 p-3 md:grid-cols-[2fr,1fr,auto]"
                    >
                      <select
                        name="participantPersonId"
                        className="h-11 w-full rounded-md border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 dark:border-slate-800 dark:bg-slate-950 dark:text-slate-100"
                        value={participant.id}
                        onChange={(event) => {
                          if (event.target.value === newOptionValue) {
                            setPendingPersonIndex(index);
                            setPersonDialogOpen(true);
                            setPeopleParticipants((prev) =>
                              prev.map((entry, entryIndex) =>
                                entryIndex === index ? { ...entry, id: "" } : entry
                              )
                            );
                            return;
                          }
                          setPeopleParticipants((prev) =>
                            prev.map((entry, entryIndex) =>
                              entryIndex === index
                                ? { ...entry, id: event.target.value }
                                : entry
                            )
                          );
                        }}
                      >
                        <option value="">Select a person</option>
                        {personOptionsSorted.map((personOption) => (
                          <option key={personOption.id} value={personOption.id}>
                            {personOption.label}
                          </option>
                        ))}
                        <option value={newOptionValue}>Create new person…</option>
                      </select>
                      <select
                        name="participantPersonRole"
                        className="h-11 w-full rounded-md border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 dark:border-slate-800 dark:bg-slate-950 dark:text-slate-100"
                        value={participant.role}
                        onChange={(event) =>
                          setPeopleParticipants((prev) =>
                            prev.map((entry, entryIndex) =>
                              entryIndex === index
                                ? { ...entry, role: event.target.value }
                                : entry
                            )
                          )
                        }
                      >
                        {participantRoleOptions.map((role) => (
                          <option key={role} value={role}>
                            {role}
                          </option>
                        ))}
                      </select>
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="self-center text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-100"
                        onClick={() =>
                          setPeopleParticipants((prev) =>
                            prev.length === 1
                              ? prev.map((entry, entryIndex) =>
                                  entryIndex === index ? { ...entry, id: "" } : entry
                                )
                              : prev.filter((_, entryIndex) => entryIndex !== index)
                          )
                        }
                      >
                        <X className="h-4 w-4" />
                      </Button>
                    </div>
                  ))}
                </div>
              </div>
            </section>

            {errorMessage ? (
              <p className="text-sm text-rose-400">{errorMessage}</p>
            ) : null}

            <div className="flex flex-wrap gap-3">
              <FormSubmitButton
                type="submit"
                pendingText="Creating flight..."
                disabled={isSubmitting}
              >
                Create flight
              </FormSubmitButton>
              <Dialog.Close asChild>
                <Button type="button" variant="outline">
                  Cancel
                </Button>
              </Dialog.Close>
            </div>
          </form>

          <Dialog.Root open={aircraftDialogOpen} onOpenChange={setAircraftDialogOpen}>
            <Dialog.Portal>
              <Dialog.Overlay className="fixed inset-0 z-50 bg-slate-950/70 backdrop-blur-sm" />
              <Dialog.Content className="fixed left-1/2 top-1/2 z-50 w-full max-w-md -translate-x-1/2 -translate-y-1/2 rounded-lg border border-slate-200 bg-white p-6 shadow-xl dark:border-slate-800 dark:bg-slate-950">
                <Dialog.Title className="text-lg font-semibold text-slate-900 dark:text-slate-100">
                  Create new aircraft
                </Dialog.Title>
                <Dialog.Description className="text-sm text-slate-600 dark:text-slate-400">
                  Add a new aircraft and return to your flight plan.
                </Dialog.Description>
                <div className="mt-4 space-y-4">
                  <div>
                    <label className="mb-2 block text-xs font-semibold uppercase text-slate-600 dark:text-slate-400">
                      Tail number
                    </label>
                    <Input
                      value={newAircraftTailNumber}
                      onChange={(event) => setNewAircraftTailNumber(event.target.value)}
                      placeholder="N12345"
                    />
                  </div>
                  <div>
                    <label className="mb-2 block text-xs font-semibold uppercase text-slate-600 dark:text-slate-400">
                      Model
                    </label>
                    <Input
                      value={newAircraftModel}
                      onChange={(event) => setNewAircraftModel(event.target.value)}
                      placeholder="Cessna 172"
                    />
                  </div>
                </div>
                <div className="mt-6 flex gap-3">
                  <Button type="button" onClick={handleCreateAircraft}>
                    Save aircraft
                  </Button>
                  <Dialog.Close asChild>
                    <Button type="button" variant="outline">
                      Cancel
                    </Button>
                  </Dialog.Close>
                </div>
              </Dialog.Content>
            </Dialog.Portal>
          </Dialog.Root>

          <Dialog.Root open={personDialogOpen} onOpenChange={setPersonDialogOpen}>
            <Dialog.Portal>
              <Dialog.Overlay className="fixed inset-0 z-50 bg-slate-950/70 backdrop-blur-sm" />
              <Dialog.Content className="fixed left-1/2 top-1/2 z-50 w-full max-w-md -translate-x-1/2 -translate-y-1/2 rounded-lg border border-slate-200 bg-white p-6 shadow-xl dark:border-slate-800 dark:bg-slate-950">
                <Dialog.Title className="text-lg font-semibold text-slate-900 dark:text-slate-100">
                  Create new person
                </Dialog.Title>
                <Dialog.Description className="text-sm text-slate-600 dark:text-slate-400">
                  Add a new contact and return to your flight plan.
                </Dialog.Description>
                <div className="mt-4 space-y-4">
                  <div>
                    <label className="mb-2 block text-xs font-semibold uppercase text-slate-600 dark:text-slate-400">
                      Name
                    </label>
                    <Input
                      value={newPersonName}
                      onChange={(event) => setNewPersonName(event.target.value)}
                      placeholder="Alex Pilot"
                    />
                  </div>
                  <div>
                    <label className="mb-2 block text-xs font-semibold uppercase text-slate-600 dark:text-slate-400">
                      Email
                    </label>
                    <Input
                      value={newPersonEmail}
                      onChange={(event) => setNewPersonEmail(event.target.value)}
                      placeholder="alex@example.com"
                      type="email"
                    />
                  </div>
                </div>
                <div className="mt-6 flex gap-3">
                  <Button type="button" onClick={handleCreatePerson}>
                    Save person
                  </Button>
                  <Dialog.Close asChild>
                    <Button type="button" variant="outline">
                      Cancel
                    </Button>
                  </Dialog.Close>
                </div>
              </Dialog.Content>
            </Dialog.Portal>
          </Dialog.Root>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
