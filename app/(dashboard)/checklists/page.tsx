import { prisma } from "@/app/lib/db";
import { requireUser } from "@/app/lib/auth/session";
import { Card, CardContent, CardHeader } from "@/app/components/ui/card";
import { Button } from "@/app/components/ui/button";
import { Input } from "@/app/components/ui/input";
import {
  createChecklistTemplateAction,
  setChecklistTemplateDefaultAction
} from "@/app/lib/actions/checklist-template-actions";
import Link from "next/link";

const phases = [
  { value: "PREFLIGHT", label: "Pre-flight" },
  { value: "POSTFLIGHT", label: "Post-flight" }
] as const;

export default async function ChecklistsPage() {
  const user = await requireUser();

  const templates = await prisma.checklistTemplate.findMany({
    where: { userId: user.id },
    select: { id: true, name: true, phase: true, isDefault: true },
    orderBy: [{ phase: "asc" }, { createdAt: "desc" }]
  });

  const templatesByPhase = phases.map((phase) => ({
    ...phase,
    templates: templates.filter((template) => template.phase === phase.value)
  }));

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-semibold">Checklist templates</h2>
        <p className="text-sm text-slate-400">
          Build reusable pre-flight and post-flight checklists. Assign defaults on each
          aircraft type or override them per tail number.
        </p>
      </div>

      <Card>
        <CardHeader>
          <p className="text-sm text-slate-400">Create a new template</p>
        </CardHeader>
        <CardContent>
          <form
            action={createChecklistTemplateAction}
            className="grid gap-3 lg:grid-cols-[1.4fr_0.8fr_auto] lg:items-end"
          >
            <Input name="name" placeholder="Template name" required />
            <label className="text-sm text-slate-300">
              <span className="mb-1 block text-xs uppercase text-slate-500">Phase</span>
              <select
                name="phase"
                className="h-11 w-full rounded-md border border-slate-700 bg-slate-950 px-3 text-sm text-slate-100"
                defaultValue="PREFLIGHT"
              >
                {phases.map((phase) => (
                  <option key={phase.value} value={phase.value}>
                    {phase.label}
                  </option>
                ))}
              </select>
            </label>
            <div className="flex flex-wrap items-center justify-between gap-3 lg:justify-end">
              <label className="flex items-center gap-2 text-sm text-slate-300">
                <input
                  type="checkbox"
                  name="isDefault"
                  defaultChecked
                  className="h-5 w-5 rounded border-slate-600 bg-slate-950"
                />
                Make default
              </label>
              <Button type="submit">Create template</Button>
            </div>
          </form>
        </CardContent>
      </Card>

      {templatesByPhase.map((phase) => (
        <Card key={phase.value}>
          <CardHeader>
            <div className="flex items-center justify-between">
              <p className="text-sm text-slate-400">{phase.label} templates</p>
              <span className="text-xs text-slate-500">
                {phase.templates.length} template{phase.templates.length === 1 ? "" : "s"}
              </span>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            {phase.templates.length === 0 ? (
              <p className="text-sm text-slate-500">
                No custom templates yet. The system default will be used.
              </p>
            ) : (
              phase.templates.map((template) => (
                <div
                  key={template.id}
                  className="rounded-lg border border-slate-800 bg-slate-950/40 p-4"
                >
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <p className="text-base font-semibold text-slate-100">
                        {template.name}
                      </p>
                    </div>
                    <div className="flex flex-wrap items-center gap-2">
                      {template.isDefault ? (
                        <span className="rounded-full bg-brand-600/20 px-3 py-1 text-xs text-brand-200">
                          Default
                        </span>
                      ) : (
                        <form action={setChecklistTemplateDefaultAction}>
                          <input type="hidden" name="templateId" value={template.id} />
                          <Button type="submit" variant="outline" size="sm">
                            Set default
                          </Button>
                        </form>
                      )}
                      <Button asChild variant="outline" size="sm">
                        <Link href={`/checklists/${template.id}`}>Edit</Link>
                      </Button>
                    </div>
                  </div>
                </div>
              ))
            )}
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
