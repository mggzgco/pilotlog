import Link from "next/link";
import { prisma } from "@/app/lib/db";
import { requireAdmin } from "@/app/lib/auth/session";
import { Card, CardContent, CardHeader } from "@/app/components/ui/card";
import { Button } from "@/app/components/ui/button";
import {
  adminCreateGlobalChecklistTemplateAction,
  adminDeleteGlobalChecklistTemplateAction,
  adminImportGroendykmSr20TemplatesAction,
  adminSetGlobalChecklistTemplateDefaultAction
} from "@/app/lib/actions/admin-checklist-actions";
import { Input } from "@/app/components/ui/input";

const phases = [
  { value: "PREFLIGHT", label: "Pre-flight" },
  { value: "POSTFLIGHT", label: "Post-flight" }
] as const;

export default async function AdminChecklistsPage() {
  await requireAdmin();

  const templates = await prisma.checklistTemplate.findMany({
    where: { userId: null },
    select: { id: true, name: true, phase: true, isDefault: true, createdAt: true },
    orderBy: [{ phase: "asc" }, { isDefault: "desc" }, { createdAt: "desc" }]
  });

  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <h2 className="text-2xl font-semibold">Global checklist templates</h2>
        <p className="text-sm text-slate-400">
          These templates are available to all users when assigning checklists to an aircraft.
        </p>
      </div>

      <Card>
        <CardHeader>
          <p className="text-sm text-slate-400">Tools</p>
        </CardHeader>
        <CardContent className="flex flex-wrap items-center justify-between gap-3">
          <p className="text-sm text-slate-500">
            Import SR20 templates from `groendykm@icloud.com` into the global checklist library.
          </p>
          <form action={adminImportGroendykmSr20TemplatesAction}>
            <Button type="submit" variant="outline">
              Import SR20 templates
            </Button>
          </form>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <p className="text-sm text-slate-400">Create global template</p>
        </CardHeader>
        <CardContent>
          <form
            action={adminCreateGlobalChecklistTemplateAction}
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
                {phases.map((p) => (
                  <option key={p.value} value={p.value}>
                    {p.label}
                  </option>
                ))}
              </select>
            </label>
            <div className="flex flex-wrap items-center justify-between gap-3 lg:justify-end">
              <label className="flex items-center gap-2 text-sm text-slate-300">
                <input
                  type="checkbox"
                  name="isDefault"
                  className="h-5 w-5 rounded border-slate-600 bg-slate-950"
                />
                Make default
              </label>
              <Button type="submit">Create</Button>
            </div>
          </form>
        </CardContent>
      </Card>

      {phases.map((phase) => {
        const list = templates.filter((t) => t.phase === phase.value);
        return (
          <Card key={phase.value}>
            <CardHeader>
              <div className="flex items-center justify-between">
                <p className="text-sm text-slate-400">{phase.label} templates</p>
                <span className="text-xs text-slate-500">
                  {list.length} template{list.length === 1 ? "" : "s"}
                </span>
              </div>
            </CardHeader>
            <CardContent className="space-y-3">
              {list.length === 0 ? (
                <p className="text-sm text-slate-500">No global templates yet.</p>
              ) : (
                list.map((t) => (
                  <div
                    key={t.id}
                    className="flex flex-col gap-3 rounded-lg border border-slate-800 bg-slate-950/40 p-4 md:flex-row md:items-center md:justify-between"
                  >
                    <div className="min-w-0">
                      <p className="truncate text-base font-semibold text-slate-100">{t.name}</p>
                      <p className="text-xs text-slate-500">{t.createdAt.toDateString()}</p>
                    </div>
                    <div className="flex flex-wrap items-center gap-2">
                      {t.isDefault ? (
                        <span className="rounded-full bg-brand-600/20 px-3 py-1 text-xs text-brand-200">
                          Default
                        </span>
                      ) : (
                        <form action={adminSetGlobalChecklistTemplateDefaultAction}>
                          <input type="hidden" name="templateId" value={t.id} />
                          <Button type="submit" variant="outline" size="sm">
                            Set default
                          </Button>
                        </form>
                      )}
                      <Button asChild variant="outline" size="sm">
                        <Link href={`/admin/checklists/${t.id}`}>Edit</Link>
                      </Button>
                      <form action={adminDeleteGlobalChecklistTemplateAction}>
                        <input type="hidden" name="templateId" value={t.id} />
                        <Button
                          type="submit"
                          variant="outline"
                          size="sm"
                          className="border-rose-500/40 text-rose-600 hover:bg-rose-50 dark:text-rose-300 dark:hover:bg-rose-500/10"
                        >
                          Delete
                        </Button>
                      </form>
                    </div>
                  </div>
                ))
              )}
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}

