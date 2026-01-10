import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/app/lib/db";
import { requireUser } from "@/app/lib/auth/session";
import {
  assignAircraftChecklistAction,
  createChecklistFromAircraftAction,
  updateAircraftTypeAction
} from "@/app/lib/actions/aircraft-actions";
import { Card, CardContent, CardHeader } from "@/app/components/ui/card";
import { Button } from "@/app/components/ui/button";
import { Input } from "@/app/components/ui/input";
import { FormSubmitButton } from "@/app/components/ui/form-submit-button";

const phases = [
  { value: "PREFLIGHT", label: "Pre-flight" },
  { value: "POSTFLIGHT", label: "Post-flight" }
] as const;

export default async function AircraftDetailPage({
  params
}: {
  params: { id: string };
}) {
  const user = await requireUser();

  const [aircraft, aircraftTypes, templates] = await Promise.all([
    prisma.aircraft.findFirst({
      where: { id: params.id, userId: user.id },
      include: {
        aircraftType: {
          include: {
            defaultPreflightTemplate: true,
            defaultPostflightTemplate: true
          }
        },
        preflightChecklistTemplate: true,
        postflightChecklistTemplate: true
      }
    }),
    prisma.aircraftType.findMany({
      where: { userId: user.id },
      orderBy: { name: "asc" }
    }),
    prisma.checklistTemplate.findMany({
      where: { userId: user.id },
      orderBy: { name: "asc" }
    })
  ]);

  if (!aircraft) {
    notFound();
  }

  const templatesByPhase = phases.map((phase) => ({
    ...phase,
    templates: templates.filter((template) => template.phase === phase.value)
  }));

  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <Button asChild variant="ghost">
          <Link href="/aircraft">← Back to aircraft</Link>
        </Button>
        <div>
          <h2 className="text-2xl font-semibold">{aircraft.tailNumber}</h2>
          <p className="text-sm text-slate-400">
            {aircraft.model ? `${aircraft.model} · ` : ""}Manage checklist defaults and
            overrides for this tail number.
          </p>
        </div>
      </div>

      <Card>
        <CardHeader>
          <p className="text-sm text-slate-400">Aircraft details</p>
        </CardHeader>
        <CardContent className="space-y-4">
          <form action={updateAircraftTypeAction} className="grid gap-4 lg:grid-cols-2">
            <input type="hidden" name="aircraftId" value={aircraft.id} />
            <label className="text-sm text-slate-300">
              <span className="mb-1 block text-xs uppercase text-slate-500">
                Aircraft type
              </span>
              <select
                name="aircraftTypeId"
                className="h-11 w-full rounded-md border border-slate-700 bg-slate-950 px-3 text-sm text-slate-100"
                defaultValue={aircraft.aircraftTypeId ?? ""}
              >
                <option value="">No type selected</option>
                {aircraftTypes.map((type) => (
                  <option key={type.id} value={type.id}>
                    {type.name}
                  </option>
                ))}
                <option value="new">Create new type…</option>
              </select>
            </label>
            <label className="text-sm text-slate-300">
              <span className="mb-1 block text-xs uppercase text-slate-500">
                Create new type…
              </span>
              <Input
                name="newTypeName"
                placeholder="e.g., C172S"
                autoComplete="off"
              />
            </label>
            <div className="lg:col-span-2">
              <Button type="submit">Update type</Button>
            </div>
          </form>
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

      <Card>
        <CardHeader>
          <p className="text-sm text-slate-400">Checklist assignments</p>
        </CardHeader>
        <CardContent className="space-y-6">
          {templatesByPhase.map((phase) => {
            const overrideTemplate =
              phase.value === "PREFLIGHT"
                ? aircraft.preflightChecklistTemplate
                : aircraft.postflightChecklistTemplate;
            const typeDefault =
              phase.value === "PREFLIGHT"
                ? aircraft.aircraftType?.defaultPreflightTemplate
                : aircraft.aircraftType?.defaultPostflightTemplate;

            return (
              <div key={phase.value} className="rounded-lg border border-slate-800 p-4">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <p className="text-base font-semibold text-slate-100">
                      {phase.label}
                    </p>
                    <p className="text-xs text-slate-500">
                      Defaults are set on the aircraft type. Overrides apply only to this
                      tail number.
                    </p>
                  </div>
                </div>

                <div className="mt-4 grid gap-4 lg:grid-cols-2">
                  <div className="space-y-2 rounded-md border border-slate-800 px-4 py-3">
                    <p className="text-xs uppercase text-slate-500">Type default</p>
                    <p className="text-sm text-slate-200">
                      {typeDefault?.name ?? "Not assigned"}
                    </p>
                    {aircraft.aircraftType ? (
                      <form action={assignAircraftChecklistAction} className="space-y-2">
                        <input type="hidden" name="aircraftId" value={aircraft.id} />
                        <input type="hidden" name="phase" value={phase.value} />
                        <input type="hidden" name="scope" value="type" />
                        <select
                          name="templateId"
                          className="h-11 w-full rounded-md border border-slate-700 bg-slate-950 px-3 text-sm text-slate-100"
                          defaultValue={typeDefault?.id ?? ""}
                        >
                          <option value="">No default</option>
                          {phase.templates.map((template) => (
                            <option key={template.id} value={template.id}>
                              {template.name}
                            </option>
                          ))}
                        </select>
                        <Button type="submit" variant="outline" size="sm">
                          Update type default
                        </Button>
                      </form>
                    ) : (
                      <p className="text-xs text-slate-500">
                        Set an aircraft type to assign defaults.
                      </p>
                    )}
                  </div>

                  <div className="space-y-2 rounded-md border border-slate-800 px-4 py-3">
                    <p className="text-xs uppercase text-slate-500">Tail override</p>
                    <p className="text-sm text-slate-200">
                      {overrideTemplate?.name ?? "No override"}
                    </p>
                    <form action={assignAircraftChecklistAction} className="space-y-2">
                      <input type="hidden" name="aircraftId" value={aircraft.id} />
                      <input type="hidden" name="phase" value={phase.value} />
                      <input type="hidden" name="scope" value="aircraft" />
                      <select
                        name="templateId"
                        className="h-11 w-full rounded-md border border-slate-700 bg-slate-950 px-3 text-sm text-slate-100"
                        defaultValue={overrideTemplate?.id ?? ""}
                      >
                        <option value="">No override</option>
                        {phase.templates.map((template) => (
                          <option key={template.id} value={template.id}>
                            {template.name}
                          </option>
                        ))}
                      </select>
                      <Button type="submit" variant="outline" size="sm">
                        Update override
                      </Button>
                    </form>
                  </div>
                </div>

                <form
                  action={createChecklistFromAircraftAction}
                  className="mt-4 grid gap-3 lg:grid-cols-[1.4fr_0.8fr_auto]"
                >
                  <input type="hidden" name="aircraftId" value={aircraft.id} />
                  <input type="hidden" name="phase" value={phase.value} />
                  <Input
                    name="name"
                    placeholder={`New ${phase.label} checklist`}
                    required
                  />
                  <label className="text-sm text-slate-300">
                    <span className="mb-1 block text-xs uppercase text-slate-500">
                      Assign to
                    </span>
                    <select
                      name="scope"
                      className="h-11 w-full rounded-md border border-slate-700 bg-slate-950 px-3 text-sm text-slate-100"
                      defaultValue={aircraft.aircraftType ? "type" : "aircraft"}
                    >
                      {aircraft.aircraftType && (
                        <option value="type">Aircraft type default</option>
                      )}
                      <option value="aircraft">Tail override</option>
                    </select>
                  </label>
                  <div className="flex items-end">
                    <Button type="submit">Create checklist</Button>
                  </div>
                </form>
              </div>
            );
          })}
        </CardContent>
      </Card>
    </div>
  );
}
