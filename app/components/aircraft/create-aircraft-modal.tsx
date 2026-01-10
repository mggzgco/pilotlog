"use client";

import * as Dialog from "@radix-ui/react-dialog";
import { X } from "lucide-react";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/app/components/ui/button";
import { Input } from "@/app/components/ui/input";
import { useToast } from "@/app/components/ui/toast-provider";

type AircraftTypeOption = { id: string; name: string };

type CreateAircraftModalProps = {
  aircraftTypes: AircraftTypeOption[];
  triggerLabel?: string;
};

export function CreateAircraftModal({
  aircraftTypes,
  triggerLabel = "Create aircraft"
}: CreateAircraftModalProps) {
  const router = useRouter();
  const { addToast } = useToast();
  const [open, setOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const [tailNumber, setTailNumber] = useState("");
  const [manufacturer, setManufacturer] = useState("");
  const [model, setModel] = useState("");
  const [category, setCategory] = useState("SINGLE_ENGINE_PISTON");
  const [aircraftTypeId, setAircraftTypeId] = useState("");

  const reset = () => {
    setTailNumber("");
    setManufacturer("");
    setModel("");
    setCategory("SINGLE_ENGINE_PISTON");
    setAircraftTypeId("");
    setErrorMessage(null);
  };

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setErrorMessage(null);
    if (!tailNumber.trim()) {
      setErrorMessage("Tail number is required.");
      return;
    }

    setIsSubmitting(true);
    try {
      const response = await fetch("/api/aircraft/create", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          tailNumber: tailNumber.trim(),
          manufacturer: manufacturer.trim() || undefined,
          model: model.trim() || undefined,
          category,
          aircraftTypeId: aircraftTypeId.trim() || undefined
        })
      });

      if (!response.ok) {
        const payload = await response.json().catch(() => ({}));
        setErrorMessage(payload.error ?? "Unable to create aircraft.");
        return;
      }

      addToast("Aircraft created.", "success");
      setOpen(false);
      reset();
      router.refresh();
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog.Root
      open={open}
      onOpenChange={(nextOpen) => {
        setOpen(nextOpen);
        if (!nextOpen) reset();
      }}
    >
      <Dialog.Trigger asChild>
        <Button>{triggerLabel}</Button>
      </Dialog.Trigger>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-40 bg-slate-950/70 backdrop-blur-sm" />
        <Dialog.Content className="fixed inset-y-0 right-0 z-50 w-full max-w-xl overflow-y-auto border-l border-slate-800 bg-slate-950 p-6 shadow-xl">
          <div className="flex items-start justify-between gap-4">
            <div>
              <Dialog.Title className="text-lg font-semibold text-slate-100">
                Create aircraft
              </Dialog.Title>
              <Dialog.Description className="text-sm text-slate-400">
                Add tail number, aircraft details, and an optional checklist profile.
              </Dialog.Description>
            </div>
            <Dialog.Close asChild>
              <button
                type="button"
                className="rounded-md border border-slate-800 p-2 text-slate-400 transition hover:text-slate-100"
                aria-label="Close create aircraft dialog"
              >
                <X className="h-4 w-4" />
              </button>
            </Dialog.Close>
          </div>

          <form onSubmit={handleSubmit} className="mt-6 space-y-4">
            <div className="grid gap-4 md:grid-cols-2">
              <div className="md:col-span-2">
                <label className="mb-2 block text-xs font-semibold uppercase text-slate-400">
                  Tail number
                </label>
                <Input
                  value={tailNumber}
                  onChange={(e) => setTailNumber(e.target.value)}
                  placeholder="N12345"
                  required
                />
              </div>
              <div>
                <label className="mb-2 block text-xs font-semibold uppercase text-slate-400">
                  Manufacturer
                </label>
                <Input
                  value={manufacturer}
                  onChange={(e) => setManufacturer(e.target.value)}
                  placeholder="Cirrus"
                />
              </div>
              <div>
                <label className="mb-2 block text-xs font-semibold uppercase text-slate-400">
                  Model
                </label>
                <Input value={model} onChange={(e) => setModel(e.target.value)} placeholder="SR20" />
              </div>
              <div className="md:col-span-2">
                <label className="mb-2 block text-xs font-semibold uppercase text-slate-400">
                  Type
                </label>
                <select
                  className="h-11 w-full rounded-md border border-slate-800 bg-transparent px-3 py-2 text-sm text-slate-100"
                  value={category}
                  onChange={(e) => setCategory(e.target.value)}
                >
                  <option value="SINGLE_ENGINE_PISTON">Single-engine piston</option>
                  <option value="MULTI_ENGINE_PISTON">Multi-engine piston</option>
                  <option value="SINGLE_ENGINE_TURBINE">Single-engine turbine</option>
                  <option value="MULTI_ENGINE_TURBINE">Multi-engine turbine</option>
                  <option value="JET">Jet</option>
                  <option value="HELICOPTER">Helicopter</option>
                  <option value="GLIDER">Glider</option>
                  <option value="OTHER">Other</option>
                </select>
              </div>
              <div className="md:col-span-2">
                <label className="mb-2 block text-xs font-semibold uppercase text-slate-400">
                  Checklist profile (optional)
                </label>
                <select
                  className="h-11 w-full rounded-md border border-slate-800 bg-transparent px-3 py-2 text-sm text-slate-100"
                  value={aircraftTypeId}
                  onChange={(e) => setAircraftTypeId(e.target.value)}
                >
                  <option value="">No profile selected</option>
                  {aircraftTypes.map((type) => (
                    <option key={type.id} value={type.id}>
                      {type.name}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {errorMessage ? <p className="text-sm text-rose-400">{errorMessage}</p> : null}

            <div className="flex flex-wrap gap-3">
              <Button type="submit" disabled={isSubmitting}>
                {isSubmitting ? "Saving..." : "Save aircraft"}
              </Button>
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

