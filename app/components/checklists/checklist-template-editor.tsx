"use client";

import { ArrowDown, ArrowUp, Plus, Save, Trash2 } from "lucide-react";
import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/app/components/ui/button";
import { Input } from "@/app/components/ui/input";
import { useToast } from "@/app/components/ui/toast-provider";

type Item = {
  id: string;
  kind: "SECTION" | "STEP";
  parentId: string | null;
  title: string;
  details: string | null;
  itemLabel?: string | null;
  acceptanceCriteria?: string | null;
  officialOrder: number;
  personalOrder: number;
};

type SectionDraft = {
  key: string;
  title: string;
  instructions: string;
  officialOrder: number;
  steps: Array<{
    key: string;
    itemLabel: string;
    acceptanceCriteria: string;
    instructions: string;
    officialOrder: number;
  }>;
};

function toDraft(items: Item[]): SectionDraft[] {
  const sections = items
    .filter((i) => i.kind === "SECTION")
    .sort((a, b) => a.personalOrder - b.personalOrder);
  const steps = items
    .filter((i) => i.kind !== "SECTION")
    .sort((a, b) => a.personalOrder - b.personalOrder);
  const stepsByParent = steps.reduce<Record<string, Item[]>>((acc, step) => {
    const key = step.parentId ?? "__root__";
    acc[key] ??= [];
    acc[key].push(step);
    return acc;
  }, {});
  Object.values(stepsByParent).forEach((group) => group.sort((a, b) => a.personalOrder - b.personalOrder));

  return sections.map((section) => ({
    key: section.id,
    title: section.title,
    instructions: section.details ?? "",
    officialOrder: section.officialOrder,
    steps: (stepsByParent[section.id] ?? []).map((step) => ({
      key: step.id,
      itemLabel: step.itemLabel ?? "",
      acceptanceCriteria: step.acceptanceCriteria ?? "",
      instructions: step.details ?? "",
      officialOrder: step.officialOrder
    }))
  }));
}

const newKey = () => Math.random().toString(16).slice(2);

export function ChecklistTemplateEditor({
  templateId,
  initialName,
  initialItems
}: {
  templateId: string;
  initialName: string;
  initialItems: Item[];
}) {
  const router = useRouter();
  const { addToast } = useToast();
  const [name, setName] = useState(initialName);
  const [sections, setSections] = useState<SectionDraft[]>(
    () => toDraft(initialItems).length > 0 ? toDraft(initialItems) : [{
      key: newKey(),
      title: "Cabin",
      instructions: "",
      officialOrder: 1,
      steps: [{ key: newKey(), itemLabel: "", acceptanceCriteria: "", instructions: "", officialOrder: 2 }]
    }]
  );
  const [saving, setSaving] = useState(false);

  const canSave = useMemo(() => {
    if (!name.trim()) return false;
    return sections.some((s) => s.steps.some((st) => st.itemLabel.trim().length > 0));
  }, [name, sections]);

  const moveSection = (index: number, dir: "up" | "down") => {
    setSections((prev) => {
      const next = [...prev];
      const target = dir === "up" ? index - 1 : index + 1;
      if (target < 0 || target >= next.length) return prev;
      const [removed] = next.splice(index, 1);
      next.splice(target, 0, removed);
      return next;
    });
  };

  const addSection = () => {
    setSections((prev) => [
      ...prev,
      {
        key: newKey(),
        title: "New section",
        instructions: "",
        officialOrder: 999,
        steps: [{ key: newKey(), itemLabel: "", acceptanceCriteria: "", instructions: "", officialOrder: 999 }]
      }
    ]);
  };

  const removeSection = (key: string) => {
    setSections((prev) => (prev.length === 1 ? prev : prev.filter((s) => s.key !== key)));
  };

  const addStep = (sectionKey: string) => {
    setSections((prev) =>
      prev.map((s) =>
        s.key !== sectionKey
          ? s
          : {
              ...s,
              steps: [
                ...s.steps,
                { key: newKey(), itemLabel: "", acceptanceCriteria: "", instructions: "", officialOrder: 999 }
              ]
            }
      )
    );
  };

  const moveStep = (sectionKey: string, index: number, dir: "up" | "down") => {
    setSections((prev) =>
      prev.map((s) => {
        if (s.key !== sectionKey) return s;
        const nextSteps = [...s.steps];
        const target = dir === "up" ? index - 1 : index + 1;
        if (target < 0 || target >= nextSteps.length) return s;
        const [removed] = nextSteps.splice(index, 1);
        nextSteps.splice(target, 0, removed);
        return { ...s, steps: nextSteps };
      })
    );
  };

  const removeStep = (sectionKey: string, stepKey: string) => {
    setSections((prev) =>
      prev.map((s) => {
        if (s.key !== sectionKey) return s;
        const nextSteps = s.steps.filter((st) => st.key !== stepKey);
        return { ...s, steps: nextSteps.length === 0 ? s.steps : nextSteps };
      })
    );
  };

  const save = async () => {
    if (!canSave) {
      addToast("Enter a name and at least one step.", "error");
      return;
    }
    setSaving(true);
    try {
      const res = await fetch(`/api/checklists/${templateId}/update`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: name.trim(),
          sections: sections.map((s) => ({
            title: s.title.trim(),
            instructions: s.instructions.trim(),
            officialOrder: s.officialOrder,
            steps: s.steps
              .map((st) => ({
                itemLabel: st.itemLabel.trim(),
                acceptanceCriteria: st.acceptanceCriteria.trim(),
                instructions: st.instructions.trim(),
                officialOrder: st.officialOrder
              }))
              .filter((st) => st.itemLabel.length > 0)
          }))
        })
      });
      const payload = await res.json().catch(() => ({}));
      if (!res.ok) {
        addToast(payload.error ?? "Failed to save checklist.", "error");
        return;
      }
      if (payload?.newTemplateId) {
        addToast("Saved as your own checklist copy.", "success");
        router.push(`/checklists/${payload.newTemplateId}`);
        router.refresh();
        return;
      }
      addToast("Checklist saved.", "success");
      router.refresh();
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div className="w-full min-w-0 sm:min-w-[260px] sm:flex-1">
          <p className="text-xs font-semibold uppercase text-slate-500 dark:text-slate-400">Name</p>
          <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Checklist name" />
        </div>
        <div className="flex flex-wrap gap-2">
          <Button type="button" variant="outline" onClick={addSection}>
            <Plus className="h-4 w-4" />
            Add section
          </Button>
          <Button type="button" onClick={save} disabled={saving || !canSave}>
            <Save className="h-4 w-4" />
            {saving ? "Saving..." : "Save"}
          </Button>
        </div>
      </div>

      <div className="space-y-4">
        {sections.map((section, sectionIndex) => (
          <div key={section.key} className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-950/40">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0 flex-1 space-y-3">
                <div className="flex flex-wrap items-center gap-3">
                  <Input
                    value={section.title}
                    onChange={(e) =>
                      setSections((prev) => prev.map((s) => (s.key === section.key ? { ...s, title: e.target.value } : s)))
                    }
                    placeholder="Section title (e.g., Cabin)"
                  />
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-semibold text-slate-500 dark:text-slate-400">Official</span>
                    <input
                      type="number"
                      className="h-10 w-24 rounded-md border border-slate-200 bg-white px-3 text-sm text-slate-900 shadow-sm dark:border-slate-800 dark:bg-slate-950 dark:text-slate-100"
                      value={section.officialOrder}
                      onChange={(e) =>
                        setSections((prev) =>
                          prev.map((s) =>
                            s.key === section.key ? { ...s, officialOrder: Number(e.target.value || 0) } : s
                          )
                        )
                      }
                    />
                  </div>
                </div>

                <textarea
                  value={section.instructions}
                  onChange={(e) =>
                    setSections((prev) =>
                      prev.map((s) => (s.key === section.key ? { ...s, instructions: e.target.value } : s))
                    )
                  }
                  placeholder="Section instructions (optional)"
                  className="min-h-[80px] w-full rounded-md border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 shadow-sm outline-none focus-visible:ring-2 focus-visible:ring-brand-500 focus-visible:ring-offset-2 focus-visible:ring-offset-white dark:border-slate-800 dark:bg-slate-950 dark:text-slate-100 dark:focus-visible:ring-offset-slate-950"
                />

                <div className="flex items-center justify-between gap-3">
                  <p className="text-sm font-semibold text-slate-900 dark:text-slate-100">Sub-steps</p>
                  <Button type="button" size="sm" variant="outline" onClick={() => addStep(section.key)}>
                    <Plus className="h-4 w-4" />
                    Add sub-step
                  </Button>
                </div>

                <div className="space-y-2">
                  {section.steps.map((step, stepIndex) => (
                    <div key={step.key} className="rounded-lg border border-slate-200 bg-white p-3 shadow-sm dark:border-slate-800 dark:bg-slate-950/30">
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0 flex-1 space-y-2">
                          <div className="flex flex-wrap items-center gap-3">
                            <div className="grid w-full gap-3 md:grid-cols-2">
                            <Input
                              value={step.itemLabel}
                              onChange={(e) =>
                                setSections((prev) =>
                                  prev.map((s) =>
                                    s.key !== section.key
                                      ? s
                                      : {
                                          ...s,
                                          steps: s.steps.map((st) =>
                                            st.key === step.key ? { ...st, itemLabel: e.target.value } : st
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
                                    s.key !== section.key
                                      ? s
                                      : {
                                          ...s,
                                          steps: s.steps.map((st) =>
                                            st.key === step.key
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
                            <textarea
                              value={step.instructions}
                              onChange={(e) =>
                                setSections((prev) =>
                                  prev.map((s) =>
                                    s.key !== section.key
                                      ? s
                                      : {
                                          ...s,
                                          steps: s.steps.map((st) =>
                                            st.key === step.key ? { ...st, instructions: e.target.value } : st
                                          )
                                        }
                                  )
                                )
                              }
                              placeholder="Instruction (optional)"
                              className="min-h-[70px] w-full rounded-md border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 shadow-sm outline-none focus-visible:ring-2 focus-visible:ring-brand-500 focus-visible:ring-offset-2 focus-visible:ring-offset-white dark:border-slate-800 dark:bg-slate-950 dark:text-slate-100 dark:focus-visible:ring-offset-slate-950"
                            />
                            <div className="flex items-center gap-2">
                              <span className="text-xs font-semibold text-slate-500 dark:text-slate-400">Official</span>
                              <input
                                type="number"
                                className="h-10 w-24 rounded-md border border-slate-200 bg-white px-3 text-sm text-slate-900 shadow-sm dark:border-slate-800 dark:bg-slate-950 dark:text-slate-100"
                                value={step.officialOrder}
                                onChange={(e) =>
                                  setSections((prev) =>
                                    prev.map((s) =>
                                      s.key !== section.key
                                        ? s
                                        : {
                                            ...s,
                                            steps: s.steps.map((st) =>
                                              st.key === step.key
                                                ? { ...st, officialOrder: Number(e.target.value || 0) }
                                                : st
                                            )
                                          }
                                    )
                                  )
                                }
                              />
                            </div>
                          </div>
                          {/* sub-steps: item + acceptance criteria + optional instruction */}
                        </div>
                        <div className="flex flex-col items-center gap-2">
                          <Button
                            type="button"
                            size="icon"
                            variant="outline"
                            onClick={() => moveStep(section.key, stepIndex, "up")}
                            disabled={stepIndex === 0}
                            aria-label="Move step up"
                          >
                            <ArrowUp className="h-4 w-4" />
                          </Button>
                          <Button
                            type="button"
                            size="icon"
                            variant="outline"
                            onClick={() => moveStep(section.key, stepIndex, "down")}
                            disabled={stepIndex === section.steps.length - 1}
                            aria-label="Move step down"
                          >
                            <ArrowDown className="h-4 w-4" />
                          </Button>
                          <Button
                            type="button"
                            size="icon"
                            variant="outline"
                            onClick={() => removeStep(section.key, step.key)}
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
                  onClick={() => removeSection(section.key)}
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
    </div>
  );
}

