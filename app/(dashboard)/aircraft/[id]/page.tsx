import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/app/lib/db";
import { requireUser } from "@/app/lib/auth/session";
import { assignAircraftChecklistAction, updateAircraftDetailsAction } from "@/app/lib/actions/aircraft-actions";
import { Card, CardContent, CardHeader } from "@/app/components/ui/card";
import { Button } from "@/app/components/ui/button";
import { Input } from "@/app/components/ui/input";
import { FormSubmitButton } from "@/app/components/ui/form-submit-button";
import { CreateAircraftChecklistModal } from "@/app/components/aircraft/create-aircraft-checklist-modal";

const categoryOptions = [
  { value: "SINGLE_ENGINE_PISTON", label: "Single-engine piston" },
  { value: "MULTI_ENGINE_PISTON", label: "Multi-engine piston" },
  { value: "SINGLE_ENGINE_TURBINE", label: "Single-engine turbine" },
  { value: "MULTI_ENGINE_TURBINE", label: "Multi-engine turbine" },
  { value: "JET", label: "Jet" },
  { value: "HELICOPTER", label: "Helicopter" },
  { value: "GLIDER", label: "Glider" },
  { value: "OTHER", label: "Other" }
] as const;

export default async function AircraftDetailPage({
  params
}: {
  params: { id: string };
}) {
  const user = await requireUser();

  const aircraft = await prisma.aircraft.findFirst({
    where: { id: params.id, userId: user.id },
    include: {
      preflightChecklistTemplate: { include: { items: { orderBy: { personalOrder: "asc" } } } },
      postflightChecklistTemplate: { include: { items: { orderBy: { personalOrder: "asc" } } } }
    }
  });

  if (!aircraft) {
    notFound();
  }

  const templates = await prisma.checklistTemplate.findMany({
    where: { userId: user.id },
    select: { id: true, name: true, phase: true, isDefault: true },
    orderBy: [{ phase: "asc" }, { isDefault: "desc" }, { createdAt: "desc" }]
  });

  const preflightTemplates = templates.filter((t) => t.phase === "PREFLIGHT");
  const postflightTemplates = templates.filter((t) => t.phase === "POSTFLIGHT");

  const renderChecklistTemplate = (
    template:
      | (typeof aircraft.preflightChecklistTemplate & { items?: Array<any> })
      | null,
    label: string
  ) => {
    if (!template) {
      return (
        <div className="rounded-lg border border-dashed border-slate-200 bg-white p-4 text-sm text-slate-600 dark:border-slate-800 dark:bg-slate-950/40 dark:text-slate-400">
          No {label} checklist assigned yet.
        </div>
      );
    }

    return (
      <div className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-950/40">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="text-base font-semibold text-slate-900 dark:text-slate-100">
              {template.name}
            </p>
            <p className="text-xs text-slate-600 dark:text-slate-400">
              {(template.items ?? []).filter((item: any) => item.kind !== "SECTION").length} step
              {(template.items ?? []).filter((item: any) => item.kind !== "SECTION").length === 1 ? "" : "s"}
            </p>
          </div>
          <Button asChild variant="outline" size="sm">
            <Link href="/checklists">Edit templates</Link>
          </Button>
        </div>

        {(template.items?.length ?? 0) === 0 ? (
          <p className="mt-3 text-sm text-slate-600 dark:text-slate-400">No steps yet.</p>
        ) : (
          (() => {
            const items = (template.items ?? []) as any[];
            const sections = items
              .filter((item) => item.kind === "SECTION")
              .sort((a, b) => (a.personalOrder ?? a.order ?? 0) - (b.personalOrder ?? b.order ?? 0));
            const steps = items.filter((item) => item.kind !== "SECTION");
            const stepsByParent = steps.reduce<Record<string, any[]>>((acc, step) => {
              const key = step.parentId ?? "__root__";
              acc[key] ??= [];
              acc[key].push(step);
              return acc;
            }, {});
            Object.values(stepsByParent).forEach((group) =>
              group.sort((a, b) => (a.personalOrder ?? a.order ?? 0) - (b.personalOrder ?? b.order ?? 0))
            );

            const rootSteps = stepsByParent["__root__"] ?? [];

            return (
              <div className="mt-4 space-y-4 text-sm text-slate-900 dark:text-slate-100">
                {rootSteps.length > 0 ? (
                  <ol className="space-y-2">
                    {rootSteps.map((item, index) => (
                      <li
                        key={item.id}
                        className="rounded-md border border-slate-200 px-3 py-2 dark:border-slate-800"
                      >
                        <div className="flex gap-2">
                          <span className="text-xs font-semibold text-slate-500 dark:text-slate-400">
                            {index + 1}.
                          </span>
                          <div className="min-w-0">
                            <p className="font-medium">{item.title}</p>
                            {item.details ? (
                              <p className="mt-1 text-xs text-slate-600 dark:text-slate-400">
                                {item.details}
                              </p>
                            ) : null}
                          </div>
                        </div>
                      </li>
                    ))}
                  </ol>
                ) : null}

                {sections.map((section) => {
                  const children = stepsByParent[section.id] ?? [];
                  return (
                    <div key={section.id} className="space-y-2">
                      <p className="text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
                        {section.title}
                      </p>
                      {section.details ? (
                        <p className="text-xs text-slate-600 dark:text-slate-400">
                          {section.details}
                        </p>
                      ) : null}
                      {children.length === 0 ? (
                        <p className="text-sm text-slate-600 dark:text-slate-400">
                          No sub-steps yet.
                        </p>
                      ) : (
                        <ol className="space-y-2">
                          {children.map((item, index) => (
                            <li
                              key={item.id}
                              className="rounded-md border border-slate-200 px-3 py-2 dark:border-slate-800"
                            >
                              <div className="flex gap-2">
                                <span className="text-xs font-semibold text-slate-500 dark:text-slate-400">
                                  {String.fromCharCode(97 + index)}.)
                                </span>
                                <div className="min-w-0">
                                  <p className="font-medium">{item.title}</p>
                                  {item.details ? (
                                    <p className="mt-1 text-xs text-slate-600 dark:text-slate-400">
                                      {item.details}
                                    </p>
                                  ) : null}
                                </div>
                              </div>
                            </li>
                          ))}
                        </ol>
                      )}
                    </div>
                  );
                })}
              </div>
            );
          })()
        )}
      </div>
    );
  };

  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <Button asChild variant="ghost">
          <Link href="/aircraft">← Back to aircraft</Link>
        </Button>
        <div>
          <h2 className="text-2xl font-semibold">{aircraft.tailNumber}</h2>
          <p className="text-sm text-slate-400">
            {[aircraft.manufacturer, aircraft.model].filter(Boolean).join(" ") || "—"} ·{" "}
            {aircraft.category
              ? categoryOptions.find((opt) => opt.value === aircraft.category)?.label ?? "Other"
              : "Other"}
          </p>
        </div>
      </div>

      <Card>
        <CardHeader>
          <p className="text-sm text-slate-400">Aircraft details</p>
        </CardHeader>
        <CardContent className="space-y-4">
          <form action={updateAircraftDetailsAction} className="grid gap-4 lg:grid-cols-3">
            <input type="hidden" name="aircraftId" value={aircraft.id} />
            <Input name="tailNumber" placeholder="Tail number" required defaultValue={aircraft.tailNumber} />
            <Input
              name="manufacturer"
              placeholder="Manufacturer"
              defaultValue={aircraft.manufacturer ?? ""}
            />
            <Input name="model" placeholder="Model" defaultValue={aircraft.model ?? ""} />
            <label className="text-sm text-slate-300 lg:col-span-3">
              <span className="mb-1 block text-xs uppercase text-slate-500">Type</span>
              <select
                name="category"
                className="h-11 w-full rounded-md border border-slate-700 bg-slate-950 px-3 text-sm text-slate-100"
                defaultValue={aircraft.category ?? "OTHER"}
              >
                {categoryOptions.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </select>
            </label>
            <div className="lg:col-span-3">
              <Button type="submit">Save details</Button>
            </div>
          </form>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <p className="text-sm text-slate-600 dark:text-slate-400">Checklists</p>
            <CreateAircraftChecklistModal aircraftId={aircraft.id} />
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <p className="text-xs font-semibold uppercase text-slate-500 dark:text-slate-400">
              Pre-Flight
            </p>
            <form action={assignAircraftChecklistAction} className="mt-2 flex flex-wrap items-end gap-3">
              <input type="hidden" name="aircraftId" value={aircraft.id} />
              <input type="hidden" name="phase" value="PREFLIGHT" />
              <input type="hidden" name="scope" value="aircraft" />
              <label className="min-w-[260px] flex-1 text-sm text-slate-600 dark:text-slate-400">
                <span className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
                  Assigned template
                </span>
                <select
                  name="templateId"
                  defaultValue={aircraft.preflightChecklistTemplateId ?? ""}
                  className="h-11 w-full rounded-md border border-slate-200 bg-white px-3 text-sm text-slate-900 shadow-sm dark:border-slate-800 dark:bg-slate-950 dark:text-slate-100"
                >
                  <option value="">None</option>
                  {preflightTemplates.map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.name}
                      {t.isDefault ? " (default)" : ""}
                    </option>
                  ))}
                </select>
              </label>
              <FormSubmitButton type="submit" pendingText="Assigning...">
                Assign
              </FormSubmitButton>
            </form>
            <div className="mt-2">
              {renderChecklistTemplate(aircraft.preflightChecklistTemplate as any, "pre-flight")}
            </div>
          </div>
          <div>
            <p className="text-xs font-semibold uppercase text-slate-500 dark:text-slate-400">
              Post-Flight
            </p>
            <form action={assignAircraftChecklistAction} className="mt-2 flex flex-wrap items-end gap-3">
              <input type="hidden" name="aircraftId" value={aircraft.id} />
              <input type="hidden" name="phase" value="POSTFLIGHT" />
              <input type="hidden" name="scope" value="aircraft" />
              <label className="min-w-[260px] flex-1 text-sm text-slate-600 dark:text-slate-400">
                <span className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
                  Assigned template
                </span>
                <select
                  name="templateId"
                  defaultValue={aircraft.postflightChecklistTemplateId ?? ""}
                  className="h-11 w-full rounded-md border border-slate-200 bg-white px-3 text-sm text-slate-900 shadow-sm dark:border-slate-800 dark:bg-slate-950 dark:text-slate-100"
                >
                  <option value="">None</option>
                  {postflightTemplates.map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.name}
                      {t.isDefault ? " (default)" : ""}
                    </option>
                  ))}
                </select>
              </label>
              <FormSubmitButton type="submit" pendingText="Assigning...">
                Assign
              </FormSubmitButton>
            </form>
            <div className="mt-2">
              {renderChecklistTemplate(aircraft.postflightChecklistTemplate as any, "post-flight")}
            </div>
          </div>
          <p className="text-xs text-slate-600 dark:text-slate-400">
            Flights will only show checklists when a pre-flight and/or post-flight checklist is assigned to the aircraft.
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <p className="text-sm text-slate-400">Aircraft photo</p>
        </CardHeader>
        <CardContent className="space-y-4">
          {aircraft.photoStoragePath ? (
            <div className="max-w-xl overflow-hidden rounded-lg border border-slate-800 bg-slate-950/30">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={`/api/aircraft/${aircraft.id}/photo`}
                alt={`${aircraft.tailNumber} photo`}
                className="h-64 w-full object-cover"
              />
            </div>
          ) : (
            <div className="rounded-lg border border-dashed border-slate-800 p-4 text-sm text-slate-400">
              No photo uploaded yet.
            </div>
          )}

          <form
            action={`/api/aircraft/${aircraft.id}/photo/upload`}
            method="post"
            encType="multipart/form-data"
            className="grid gap-3 lg:grid-cols-3"
          >
            <Input name="photo" type="file" accept="image/png,image/jpeg" required className="lg:col-span-2" />
            <div className="flex items-end">
              <FormSubmitButton type="submit" pendingText="Uploading...">
                Upload photo
              </FormSubmitButton>
            </div>
            <p className="lg:col-span-3 text-xs text-slate-500">
              JPG/PNG up to 10MB. This photo will appear on flight details for this aircraft.
            </p>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
