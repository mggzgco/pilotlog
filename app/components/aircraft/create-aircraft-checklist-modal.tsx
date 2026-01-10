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
  itemLabel: string;
  acceptanceCriteria: string;
  officialOrder: number;
  personalOrder: number;
};

type SectionDraft = {
  id: string;
  title: string;
  instructions: string;
  officialOrder: number;
  personalOrder: number;
  steps: StepDraft[];
};

type CreateAircraftChecklistModalProps = {
  aircraftId: string;
  triggerLabel?: string;
};

const newId = () => Math.random().toString(16).slice(2);

const recomputePersonalOrders = (sections: SectionDraft[]): SectionDraft[] => {
  let counter = 1;
  return sections.map((section) => {
    const sectionPersonalOrder = counter++;
    const nextSection: SectionDraft = {
      ...section,
      personalOrder: sectionPersonalOrder,
      officialOrder:
        section.officialOrder === 0 || section.officialOrder === 999
          ? sectionPersonalOrder
          : section.officialOrder,
      steps: section.steps.map((step) => ({
        ...step,
        personalOrder: (() => {
          const personalOrder = counter++;
          return personalOrder;
        })(),
        officialOrder:
          step.officialOrder === 0 || step.officialOrder === 999
            ? counter - 1
            : step.officialOrder
      }))
    };
    return nextSection;
  });
};

export function CreateAircraftChecklistModal({
  aircraftId,
  triggerLabel = "Create checklist"
}: CreateAircraftChecklistModalProps) {
  const router = useRouter();
  const { addToast } = useToast();
  const [open, setOpen] = useState(false);
  const [phase, setPhase] = useState<ChecklistPhase>("PREFLIGHT");
  const [name, setName] = useState("");
  const [sections, setSections] = useState<SectionDraft[]>(
    recomputePersonalOrders([
      {
        id: newId(),
        title: "Cabin",
        instructions: "",
        officialOrder: 1,
        personalOrder: 1,
        steps: [
          {
            id: newId(),
            itemLabel: "",
            acceptanceCriteria: "",
            officialOrder: 2,
            personalOrder: 2
          }
        ]
      }
    ])
  );
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const canSubmit = useMemo(() => {
    const trimmedName = name.trim();
    const hasAnyStepTitle = sections.some((section) =>
      section.steps.some((step) => step.itemLabel.trim().length > 0)
    );
    return trimmedName.length > 0 && hasAnyStepTitle;
  }, [name, sections]);

  const reset = () => {
    setPhase("PREFLIGHT");
    setName("");
    setSections(
      recomputePersonalOrders([
        {
          id: newId(),
          title: "Cabin",
          instructions: "",
          officialOrder: 1,
          personalOrder: 1,
          steps: [
            {
              id: newId(),
              itemLabel: "",
              acceptanceCriteria: "",
              officialOrder: 2,
              personalOrder: 2
            }
          ]
        }
      ])
    );
    setErrorMessage(null);
  };

  const addSection = () => {
    setSections((prev) =>
      recomputePersonalOrders([
        ...prev,
        {
          id: newId(),
          title: "New section",
          instructions: "",
          officialOrder: 999,
          personalOrder: 0,
          steps: [
            {
              id: newId(),
              itemLabel: "",
              acceptanceCriteria: "",
              officialOrder: 999,
              personalOrder: 0
            }
          ]
        }
      ])
    );
  };

  const removeSection = (sectionId: string) => {
    setSections((prev) => {
      const next = prev.filter((s) => s.id !== sectionId);
      return recomputePersonalOrders(next.length === 0 ? prev : next);
    });
  };

  const moveSection = (sectionIndex: number, direction: "up" | "down") => {
    setSections((prev) => {
      const next = [...prev];
      const targetIndex = direction === "up" ? sectionIndex - 1 : sectionIndex + 1;
      if (targetIndex < 0 || targetIndex >= next.length) return prev;
      const [removed] = next.splice(sectionIndex, 1);
      next.splice(targetIndex, 0, removed);
      return recomputePersonalOrders(next);
    });
  };

  const addStep = (sectionId: string) => {
    setSections((prev) =>
      recomputePersonalOrders(
        prev.map((section) =>
          section.id === sectionId
            ? {
                ...section,
                steps: [
                  ...section.steps,
                  {
                    id: newId(),
                    itemLabel: "",
                    acceptanceCriteria: "",
                    officialOrder: 999,
                    personalOrder: 0
                  }
                ]
              }
            : section
        )
      )
    );
  };

  const removeStep = (sectionId: string, stepId: string) => {
    setSections((prev) =>
      recomputePersonalOrders(
        prev.map((section) => {
          if (section.id !== sectionId) return section;
          const nextSteps = section.steps.filter((s) => s.id !== stepId);
          return { ...section, steps: nextSteps.length === 0 ? section.steps : nextSteps };
        })
      )
    );
  };

  const moveStep = (
    sectionId: string,
    stepIndex: number,
    direction: "up" | "down"
  ) => {
    setSections((prev) =>
      recomputePersonalOrders(
        prev.map((section) => {
          if (section.id !== sectionId) return section;
          const nextSteps = [...section.steps];
          const targetIndex = direction === "up" ? stepIndex - 1 : stepIndex + 1;
          if (targetIndex < 0 || targetIndex >= nextSteps.length) return section;
          const [removed] = nextSteps.splice(stepIndex, 1);
          nextSteps.splice(targetIndex, 0, removed);
          return { ...section, steps: nextSteps };
        })
      )
    );
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
          sections: sections
            .map((section) => ({
              title: section.title.trim(),
              instructions: section.instructions.trim(),
              officialOrder: section.officialOrder,
              personalOrder: section.personalOrder,
              steps: section.steps
                .map((step) => ({
                  itemLabel: step.itemLabel.trim(),
                  acceptanceCriteria: step.acceptanceCriteria.trim(),
                  officialOrder: step.officialOrder,
                  personalOrder: step.personalOrder
                }))
                .filter((step) => step.itemLabel.length > 0)
            }))
            .filter((section) => section.title.length > 0)
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
              <p className="text-sm font-semibold text-slate-900 dark:text-slate-100">Checklist</p>
              <Button type="button" variant="outline" size="sm" onClick={addSection}>
                <Plus className="mr-2 h-4 w-4" />
                Add section
              </Button>
            </div>

            <div className="space-y-3">
              {sections.map((section, sectionIndex) => (
                <div
                  key={section.id}
                  className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-950/40"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0 flex-1 space-y-3">
                      <div className="flex flex-wrap items-center gap-3">
                        <span className="text-xs font-semibold text-slate-500 dark:text-slate-400">
                          Section
                        </span>
                        <Input
                          value={section.title}
                          onChange={(e) =>
                            setSections((prev) =>
                              prev.map((s) => (s.id === section.id ? { ...s, title: e.target.value } : s))
                            )
                          }
                          placeholder="Section title (e.g., Cabin)"
                        />
                        <div className="flex items-center gap-2">
                          <label className="text-xs font-semibold text-slate-500 dark:text-slate-400">
                            Official
                          </label>
                          <input
                            type="number"
                            className="h-10 w-24 rounded-md border border-slate-200 bg-white px-3 text-sm text-slate-900 shadow-sm dark:border-slate-800 dark:bg-slate-950 dark:text-slate-100"
                            value={section.officialOrder}
                            onChange={(e) =>
                              setSections((prev) =>
                                prev.map((s) =>
                                  s.id === section.id
                                    ? { ...s, officialOrder: Number(e.target.value || 0) }
                                    : s
                                )
                              )
                            }
                          />
                        </div>
                        <div className="flex items-center gap-2">
                          <label className="text-xs font-semibold text-slate-500 dark:text-slate-400">
                            Personal
                          </label>
                          <input
                            type="number"
                            readOnly
                            className="h-10 w-24 rounded-md border border-slate-200 bg-slate-50 px-3 text-sm text-slate-700 shadow-sm dark:border-slate-800 dark:bg-slate-900/40 dark:text-slate-200"
                            value={section.personalOrder}
                          />
                        </div>
                      </div>

                      <textarea
                        value={section.instructions}
                        onChange={(e) =>
                          setSections((prev) =>
                            prev.map((s) =>
                              s.id === section.id ? { ...s, instructions: e.target.value } : s
                            )
                          )
                        }
                        placeholder="Section instructions (optional)"
                        className="min-h-[80px] w-full rounded-md border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 shadow-sm outline-none focus-visible:ring-2 focus-visible:ring-brand-500 focus-visible:ring-offset-2 focus-visible:ring-offset-white dark:border-slate-800 dark:bg-slate-950 dark:text-slate-100 dark:focus-visible:ring-offset-slate-950"
                      />

                      <div className="flex items-center justify-between gap-3">
                        <p className="text-sm font-semibold text-slate-900 dark:text-slate-100">
                          Sub-steps
                        </p>
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          onClick={() => addStep(section.id)}
                        >
                          <Plus className="mr-2 h-4 w-4" />
                          Add sub-step
                        </Button>
                      </div>

                      <div className="space-y-2">
                        {section.steps.map((step, stepIndex) => (
                          <div
                            key={step.id}
                            className="rounded-lg border border-slate-200 bg-white p-3 shadow-sm dark:border-slate-800 dark:bg-slate-950/30"
                          >
                            <div className="flex items-start justify-between gap-3">
                              <div className="min-w-0 flex-1 space-y-2">
                                <div className="flex flex-wrap items-center gap-3">
                                  <span className="text-xs font-semibold text-slate-500 dark:text-slate-400">
                                    Step
                                  </span>
                                  <div className="grid w-full gap-3 md:grid-cols-2">
                                    <Input
                                      value={step.itemLabel}
                                      onChange={(e) =>
                                        setSections((prev) =>
                                          prev.map((s) =>
                                            s.id !== section.id
                                              ? s
                                              : {
                                                  ...s,
                                                  steps: s.steps.map((st) =>
                                                    st.id === step.id
                                                      ? { ...st, itemLabel: e.target.value }
                                                      : st
                                                  )
                                                }
                                          )
                                        )
                                      }
                                      placeholder='Item (e.g., "BAT 1 Switch")'
                                    />
                                    <Input
                                      value={step.acceptanceCriteria}
                                      onChange={(e) =>
                                        setSections((prev) =>
                                          prev.map((s) =>
                                            s.id !== section.id
                                              ? s
                                              : {
                                                  ...s,
                                                  steps: s.steps.map((st) =>
                                                    st.id === step.id
                                                      ? { ...st, acceptanceCriteria: e.target.value }
                                                      : st
                                                  )
                                                }
                                          )
                                        )
                                      }
                                      placeholder='Acceptance criteria (e.g., "ON")'
                                    />
                                  </div>
                                  <div className="flex items-center gap-2">
                                    <label className="text-xs font-semibold text-slate-500 dark:text-slate-400">
                                      Official
                                    </label>
                                    <input
                                      type="number"
                                      className="h-10 w-24 rounded-md border border-slate-200 bg-white px-3 text-sm text-slate-900 shadow-sm dark:border-slate-800 dark:bg-slate-950 dark:text-slate-100"
                                      value={step.officialOrder}
                                      onChange={(e) =>
                                        setSections((prev) =>
                                          prev.map((s) =>
                                            s.id !== section.id
                                              ? s
                                              : {
                                                  ...s,
                                                  steps: s.steps.map((st) =>
                                                    st.id === step.id
                                                      ? {
                                                          ...st,
                                                          officialOrder: Number(e.target.value || 0)
                                                        }
                                                      : st
                                                  )
                                                }
                                          )
                                        )
                                      }
                                    />
                                  </div>
                                  <div className="flex items-center gap-2">
                                    <label className="text-xs font-semibold text-slate-500 dark:text-slate-400">
                                      Personal
                                    </label>
                                    <input
                                      type="number"
                                      readOnly
                                      className="h-10 w-24 rounded-md border border-slate-200 bg-slate-50 px-3 text-sm text-slate-700 shadow-sm dark:border-slate-800 dark:bg-slate-900/40 dark:text-slate-200"
                                      value={step.personalOrder}
                                    />
                                  </div>
                                </div>

                                {/* sub-steps only carry item + acceptance criteria */}
                              </div>

                              <div className="flex flex-col items-center gap-2">
                                <Button
                                  type="button"
                                  size="icon"
                                  variant="outline"
                                  onClick={() => moveStep(section.id, stepIndex, "up")}
                                  disabled={stepIndex === 0}
                                  aria-label="Move step up"
                                >
                                  <ArrowUp className="h-4 w-4" />
                                </Button>
                                <Button
                                  type="button"
                                  size="icon"
                                  variant="outline"
                                  onClick={() => moveStep(section.id, stepIndex, "down")}
                                  disabled={stepIndex === section.steps.length - 1}
                                  aria-label="Move step down"
                                >
                                  <ArrowDown className="h-4 w-4" />
                                </Button>
                                <Button
                                  type="button"
                                  size="icon"
                                  variant="outline"
                                  onClick={() => removeStep(section.id, step.id)}
                                  disabled={section.steps.length === 1}
                                  aria-label="Remove step"
                                >
                                  <Trash2 className="h-4 w-4" />
                                </Button>
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>

                    <div className="flex flex-col items-center gap-2">
                      <Button
                        type="button"
                        size="icon"
                        variant="outline"
                        onClick={() => moveSection(sectionIndex, "up")}
                        disabled={sectionIndex === 0}
                        aria-label="Move section up"
                      >
                        <ArrowUp className="h-4 w-4" />
                      </Button>
                      <Button
                        type="button"
                        size="icon"
                        variant="outline"
                        onClick={() => moveSection(sectionIndex, "down")}
                        disabled={sectionIndex === sections.length - 1}
                        aria-label="Move section down"
                      >
                        <ArrowDown className="h-4 w-4" />
                      </Button>
                      <Button
                        type="button"
                        size="icon"
                        variant="outline"
                        onClick={() => removeSection(section.id)}
                        disabled={sections.length === 1}
                        aria-label="Remove section"
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

