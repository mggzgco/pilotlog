import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/app/lib/db";
import { requireUser } from "@/app/lib/auth/session";
import { assignAircraftChecklistAction, updateAircraftDetailsAction } from "@/app/lib/actions/aircraft-actions";
import { Card, CardContent, CardHeader } from "@/app/components/ui/card";
import { Button } from "@/app/components/ui/button";
import { Input } from "@/app/components/ui/input";
import { FormSubmitButton } from "@/app/components/ui/form-submit-button";
import { AircraftDocumentViewer } from "@/app/components/aircraft/aircraft-document-viewer";
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
      preflightChecklistTemplate: {
        select: { id: true, name: true, _count: { select: { items: true } } }
      },
      postflightChecklistTemplate: {
        select: { id: true, name: true, _count: { select: { items: true } } }
      },
      documents: {
        select: {
          id: true,
          originalFilename: true,
          contentType: true,
          sizeBytes: true,
          createdAt: true
        },
        orderBy: { createdAt: "desc" }
      }
    }
  });

  if (!aircraft) {
    notFound();
  }

  const templates = await prisma.checklistTemplate.findMany({
    where: { OR: [{ userId: user.id }, { userId: null }] },
    select: { id: true, userId: true, name: true, phase: true, isDefault: true },
    orderBy: [{ phase: "asc" }, { isDefault: "desc" }, { createdAt: "desc" }]
  });

  const preflightTemplates = templates.filter((t) => t.phase === "PREFLIGHT");
  const postflightTemplates = templates.filter((t) => t.phase === "POSTFLIGHT");
  const splitByScope = (list: typeof templates) => ({
    global: list.filter((t) => t.userId === null),
    personal: list.filter((t) => t.userId !== null)
  });

  const renderChecklistTemplate = (
    template: typeof aircraft.preflightChecklistTemplate | null,
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
              {template._count?.items ?? 0} item
              {(template._count?.items ?? 0) === 1 ? "" : "s"}
            </p>
          </div>
          <Button asChild variant="outline" size="sm">
            <Link href={`/checklists/${template.id}`}>Open template</Link>
          </Button>
        </div>
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
          <p className="text-sm text-slate-400">Aircraft</p>
        </CardHeader>
        <CardContent className="grid gap-6 lg:grid-cols-3">
          <div className="space-y-4">
            {aircraft.photoStoragePath ? (
              <div className="overflow-hidden rounded-lg border border-slate-800 bg-slate-950/30">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={`/api/aircraft/${aircraft.id}/photo`}
                  alt={`${aircraft.tailNumber} photo`}
                  className="h-56 w-full object-cover"
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
              className="grid gap-3"
            >
              <Input name="photo" type="file" accept="image/png,image/jpeg" required />
              <FormSubmitButton type="submit" pendingText="Uploading...">
                Upload photo
              </FormSubmitButton>
              <p className="text-xs text-slate-500">
                JPG/PNG up to 20MB. This photo will appear on flight details for this aircraft.
              </p>
            </form>
          </div>

          <div className="lg:col-span-2">
            <form action={updateAircraftDetailsAction} className="grid gap-4 lg:grid-cols-3">
              <input type="hidden" name="aircraftId" value={aircraft.id} />
              <Input
                name="tailNumber"
                placeholder="Tail number"
                required
                defaultValue={aircraft.tailNumber}
              />
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
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <p className="text-sm text-slate-600 dark:text-slate-400">Checklists</p>
            <div className="flex flex-wrap gap-2">
              <Button asChild variant="outline" size="sm">
                <Link href="/checklists">Manage checklists</Link>
              </Button>
              <CreateAircraftChecklistModal aircraftId={aircraft.id} />
            </div>
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
              <label className="w-full min-w-0 text-sm text-slate-600 dark:text-slate-400 sm:min-w-[260px] sm:flex-1">
                <span className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
                  Assigned template
                </span>
                <select
                  name="templateId"
                  defaultValue={aircraft.preflightChecklistTemplateId ?? ""}
                  className="h-11 w-full rounded-md border border-slate-200 bg-white px-3 text-sm text-slate-900 shadow-sm dark:border-slate-800 dark:bg-slate-950 dark:text-slate-100"
                >
                  <option value="">None</option>
                  {(() => {
                    const grouped = splitByScope(preflightTemplates);
                    return (
                      <>
                        {grouped.global.length > 0 ? (
                          <optgroup label="Global Checklists">
                            {grouped.global.map((t) => (
                              <option key={t.id} value={t.id}>
                                {t.name}
                                {t.isDefault ? " (default)" : ""}
                              </option>
                            ))}
                          </optgroup>
                        ) : null}
                        {grouped.personal.length > 0 ? (
                          <optgroup label="Your templates">
                            {grouped.personal.map((t) => (
                              <option key={t.id} value={t.id}>
                                {t.name}
                                {t.isDefault ? " (default)" : ""}
                              </option>
                            ))}
                          </optgroup>
                        ) : null}
                      </>
                    );
                  })()}
                </select>
              </label>
              <FormSubmitButton type="submit" pendingText="Assigning...">
                Assign
              </FormSubmitButton>
            </form>
            <div className="mt-2">{renderChecklistTemplate(aircraft.preflightChecklistTemplate, "pre-flight")}</div>
          </div>
          <div>
            <p className="text-xs font-semibold uppercase text-slate-500 dark:text-slate-400">
              Post-Flight
            </p>
            <form action={assignAircraftChecklistAction} className="mt-2 flex flex-wrap items-end gap-3">
              <input type="hidden" name="aircraftId" value={aircraft.id} />
              <input type="hidden" name="phase" value="POSTFLIGHT" />
              <input type="hidden" name="scope" value="aircraft" />
              <label className="w-full min-w-0 text-sm text-slate-600 dark:text-slate-400 sm:min-w-[260px] sm:flex-1">
                <span className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
                  Assigned template
                </span>
                <select
                  name="templateId"
                  defaultValue={aircraft.postflightChecklistTemplateId ?? ""}
                  className="h-11 w-full rounded-md border border-slate-200 bg-white px-3 text-sm text-slate-900 shadow-sm dark:border-slate-800 dark:bg-slate-950 dark:text-slate-100"
                >
                  <option value="">None</option>
                  {(() => {
                    const grouped = splitByScope(postflightTemplates);
                    return (
                      <>
                        {grouped.global.length > 0 ? (
                          <optgroup label="Global Checklists">
                            {grouped.global.map((t) => (
                              <option key={t.id} value={t.id}>
                                {t.name}
                                {t.isDefault ? " (default)" : ""}
                              </option>
                            ))}
                          </optgroup>
                        ) : null}
                        {grouped.personal.length > 0 ? (
                          <optgroup label="Your templates">
                            {grouped.personal.map((t) => (
                              <option key={t.id} value={t.id}>
                                {t.name}
                                {t.isDefault ? " (default)" : ""}
                              </option>
                            ))}
                          </optgroup>
                        ) : null}
                      </>
                    );
                  })()}
                </select>
              </label>
              <FormSubmitButton type="submit" pendingText="Assigning...">
                Assign
              </FormSubmitButton>
            </form>
            <div className="mt-2">{renderChecklistTemplate(aircraft.postflightChecklistTemplate, "post-flight")}</div>
          </div>
          <p className="text-xs text-slate-600 dark:text-slate-400">
            Flights will only show checklists when a pre-flight and/or post-flight checklist is assigned to the aircraft.
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <p className="text-sm text-slate-400">Documents</p>
        </CardHeader>
        <CardContent className="space-y-4">
          <form
            action={`/api/aircraft/${aircraft.id}/documents/upload`}
            method="post"
            encType="multipart/form-data"
            className="grid gap-3 lg:grid-cols-3"
          >
            <Input
              name="documents"
              type="file"
              multiple
              accept="application/pdf,image/png,image/jpeg"
              required
              className="lg:col-span-2"
            />
            <div className="flex items-end">
              <FormSubmitButton type="submit" pendingText="Uploading...">
                Upload documents
              </FormSubmitButton>
            </div>
            <p className="lg:col-span-3 text-xs text-slate-500">
              PDF/JPG/PNG up to 20MB each. Great for POH/manuals, checklists, etc.
            </p>
          </form>

          {(aircraft.documents?.length ?? 0) === 0 ? (
            <div className="rounded-lg border border-dashed border-slate-800 p-4 text-sm text-slate-400">
              No documents uploaded yet.
            </div>
          ) : (
            <div className="overflow-hidden rounded-lg border border-slate-800">
              <table className="w-full text-sm">
                <thead className="bg-slate-900 text-xs uppercase text-slate-500">
                  <tr>
                    <th className="px-4 py-3 text-left font-medium">File</th>
                    <th className="px-4 py-3 text-left font-medium">Uploaded</th>
                    <th className="px-4 py-3 text-right font-medium">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800">
                  {aircraft.documents.map((doc) => (
                    <tr key={doc.id} className="text-slate-200">
                      <td className="px-4 py-3">
                        <a
                          className="text-sky-400 hover:underline"
                          href={`/api/aircraft/documents/${doc.id}/download`}
                        >
                          {doc.originalFilename}
                        </a>
                        {doc.sizeBytes ? (
                          <p className="mt-1 text-xs text-slate-500">
                            {Math.round(doc.sizeBytes / 1024)} KB
                          </p>
                        ) : null}
                      </td>
                      <td className="px-4 py-3 text-slate-400">{doc.createdAt.toLocaleString()}</td>
                      <td className="px-4 py-3 text-right">
                        <div className="flex flex-wrap justify-end gap-2">
                          <AircraftDocumentViewer
                            docId={doc.id}
                            filename={doc.originalFilename}
                          />
                          <form action={`/api/aircraft/documents/${doc.id}/delete`} method="post">
                            <FormSubmitButton type="submit" pendingText="Deleting...">
                              Delete
                            </FormSubmitButton>
                          </form>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
