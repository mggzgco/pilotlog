"use client";

import * as Dialog from "@radix-ui/react-dialog";
import { ArrowDown, ArrowUp, Plus, Trash2, X } from "lucide-react";
import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/app/components/ui/button";
import { Input } from "@/app/components/ui/input";
import { FormSubmitButton } from "@/app/components/ui/form-submit-button";
import { useToast } from "@/app/components/ui/toast-provider";

type ChecklistPhase = "PREFLIGHT" | "POSTFLIGHT";

type StepDraft = {
  id: string;
  title: string;
  instructions: string;
};

type CreateAircraftChecklistModalProps = {
  aircraftId: string;
  triggerLabel?: string;
};

const newId = () => Math.random().toString(16).slice(2);

export function CreateAircraftChecklistModal({
  aircraftId,
  triggerLabel = "Create checklist"
}: CreateAircraftChecklistModalProps) {
  const router = useRouter();
  const { addToast } = useToast();
  const [open, setOpen] = useState(false);
  const [phase, setPhase] = useState<ChecklistPhase>("PREFLIGHT");
  const [name, setName] = useState("");
  const [steps, setSteps] = useState<StepDraft[]>([
    { id: newId(), title: "", instructions: "" }
  ]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const canSubmit = useMemo(() => {
    const trimmedName = name.trim();
    const hasAnyStepTitle = steps.some((step) => step.title.trim().length > 0);
    return trimmedName.length > 0 && hasAnyStepTitle;
  }, [name, steps]);

  const reset = () => {
    setPhase("PREFLIGHT");
    setName("");
    setSteps([{ id: newId(), title: "", instructions: "" }]);
    setErrorMessage(null);
  };

  const moveStep = (index: number, direction: "up" | "down") => {
    setSteps((prev) => {
      const next = [...prev];
      const targetIndex = direction === "up" ? index - 1 : index + 1;
      if (targetIndex < 0 || targetIndex >= next.length) return prev;
      const [removed] = next.splice(index, 1);
      next.splice(targetIndex, 0, removed);
      return next;
    });
  };

  const removeStep = (index: number) => {
    setSteps((prev) => (prev.length === 1 ? prev : prev.filter((_, i) => i !== index)));
  };

  const addStep = () => {
    setSteps((prev) => [...prev, { id: newId(), title: "", instructions: "" }]);
  };

  const handleSubmit = async () => {
    setErrorMessage(null);
    if (!canSubmit) {
      setErrorMessage("Checklist name and at least one step are required.");
      return;
    }

    setIsSubmitting(true);
    try {
      const response = await fetch(`/api/aircraft/${aircraftId}/checklists/create`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          phase,
          name: name.trim(),
          steps: steps
            .map((step) => ({
              title: step.title.trim(),
              instructions: step.instructions.trim()
            }))
            .filter((step) => step.title.length > 0)
        })
      });

      const payload = await response.json().catch(() => ({}));
      if (!response.ok) {
        setErrorMessage(payload.error ?? "Unable to create checklist.");
        return;
      }

      addToast("Checklist created and assigned.", "success");
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
        <Dialog.Content className="fixed inset-y-0 right-0 z-50 w-full max-w-3xl overflow-y-auto border-l border-slate-200 bg-white p-6 shadow-xl dark:border-slate-800 dark:bg-slate-950">
          <div className="flex items-start justify-between gap-4">
            <div>
              <Dialog.Title className="text-lg font-semibold text-slate-900 dark:text-slate-100">
                Create checklist
              </Dialog.Title>
              <Dialog.Description className="text-sm text-slate-600 dark:text-slate-400">
                Create a pre-flight or post-flight checklist and assign it to this aircraft.
              </Dialog.Description>
            </div>
            <Dialog.Close asChild>
              <button
                type="button"
                className="rounded-md border border-slate-200 p-2 text-slate-600 transition hover:text-slate-900 dark:border-slate-800 dark:text-slate-400 dark:hover:text-slate-100"
                aria-label="Close create checklist dialog"
              >
                <X className="h-4 w-4" />
              </button>
            </Dialog.Close>
          </div>

          <div className="mt-6 grid gap-4">
            <div className="grid gap-4 md:grid-cols-2">
              <div>
                <label className="mb-2 block text-xs font-semibold uppercase text-slate-600 dark:text-slate-400">
                  Category
                </label>
                <select
                  value={phase}
                  onChange={(e) => setPhase(e.target.value as ChecklistPhase)}
                  className="h-11 w-full rounded-md border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 shadow-sm outline-none focus-visible:ring-2 focus-visible:ring-brand-500 focus-visible:ring-offset-2 focus-visible:ring-offset-white dark:border-slate-800 dark:bg-slate-950 dark:text-slate-100 dark:focus-visible:ring-offset-slate-950"
                >
                  <option value="PREFLIGHT">Pre-Flight</option>
                  <option value="POSTFLIGHT">Post-Flight</option>
                </select>
              </div>
              <div>
                <label className="mb-2 block text-xs font-semibold uppercase text-slate-600 dark:text-slate-400">
                  Checklist name
                </label>
                <Input
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="e.g., SR20 pre-flight"
                />
              </div>
            </div>

            <div className="flex items-center justify-between gap-3">
              <p className="text-sm font-semibold text-slate-900 dark:text-slate-100">Steps</p>
              <Button type="button" variant="outline" size="sm" onClick={addStep}>
                <Plus className="mr-2 h-4 w-4" />
                Add step
              </Button>
            </div>

            <div className="space-y-3">
              {steps.map((step, index) => (
                <div
                  key={step.id}
                  className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-950/40"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-semibold text-slate-500 dark:text-slate-400">
                          {index + 1}
                        </span>
                        <Input
                          value={step.title}
                          onChange={(e) =>
                            setSteps((prev) =>
                              prev.map((s) => (s.id === step.id ? { ...s, title: e.target.value } : s))
                            )
                          }
                          placeholder="Step title"
                        />
                      </div>
                      <textarea
                        value={step.instructions}
                        onChange={(e) =>
                          setSteps((prev) =>
                            prev.map((s) =>
                              s.id === step.id ? { ...s, instructions: e.target.value } : s
                            )
                          )
                        }
                        placeholder="Instructions (optional)"
                        className="mt-3 min-h-[90px] w-full rounded-md border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 shadow-sm outline-none focus-visible:ring-2 focus-visible:ring-brand-500 focus-visible:ring-offset-2 focus-visible:ring-offset-white dark:border-slate-800 dark:bg-slate-950 dark:text-slate-100 dark:focus-visible:ring-offset-slate-950"
                      />
                    </div>

                    <div className="flex flex-col items-center gap-2">
                      <Button
                        type="button"
                        size="icon"
                        variant="outline"
                        onClick={() => moveStep(index, "up")}
                        disabled={index === 0}
                        aria-label="Move step up"
                      >
                        <ArrowUp className="h-4 w-4" />
                      </Button>
                      <Button
                        type="button"
                        size="icon"
                        variant="outline"
                        onClick={() => moveStep(index, "down")}
                        disabled={index === steps.length - 1}
                        aria-label="Move step down"
                      >
                        <ArrowDown className="h-4 w-4" />
                      </Button>
                      <Button
                        type="button"
                        size="icon"
                        variant="outline"
                        onClick={() => removeStep(index)}
                        disabled={steps.length === 1}
                        aria-label="Remove step"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                </div>
              ))}
            </div>

            {errorMessage ? <p className="text-sm text-rose-600 dark:text-rose-300">{errorMessage}</p> : null}

            <div className="flex flex-wrap gap-3">
              <FormSubmitButton
                type="button"
                pendingText="Creating..."
                disabled={isSubmitting || !canSubmit}
                onClick={handleSubmit}
              >
                Create checklist
              </FormSubmitButton>
              <Dialog.Close asChild>
                <Button type="button" variant="outline">
                  Cancel
                </Button>
              </Dialog.Close>
            </div>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}

