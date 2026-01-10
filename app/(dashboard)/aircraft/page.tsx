import Link from "next/link";
import { prisma } from "@/app/lib/db";
import { requireUser } from "@/app/lib/auth/session";
import { createAircraftAction } from "@/app/lib/actions/aircraft-actions";
import { Card, CardContent, CardHeader } from "@/app/components/ui/card";
import { Button } from "@/app/components/ui/button";
import { Input } from "@/app/components/ui/input";

export default async function AircraftPage() {
  const user = await requireUser();

  const [aircraft, aircraftTypes] = await Promise.all([
    prisma.aircraft.findMany({
      where: { userId: user.id },
      include: {
        aircraftType: {
          include: {
            defaultPreflightTemplate: true,
            defaultPostflightTemplate: true
          }
        },
        preflightChecklistTemplate: true,
        postflightChecklistTemplate: true
      },
      orderBy: { createdAt: "desc" }
    }),
    prisma.aircraftType.findMany({
      where: { userId: user.id },
      orderBy: { name: "asc" }
    })
  ]);

  const readinessFor = (plane: (typeof aircraft)[number]) => {
    const preflight =
      plane.preflightChecklistTemplate ?? plane.aircraftType?.defaultPreflightTemplate;
    const postflight =
      plane.postflightChecklistTemplate ?? plane.aircraftType?.defaultPostflightTemplate;
    if (preflight && postflight) {
      return { label: "Ready", tone: "text-emerald-300" };
    }
    if (preflight || postflight) {
      const missing = preflight ? "Post-flight" : "Pre-flight";
      return { label: `Missing ${missing}`, tone: "text-amber-300" };
    }
    return { label: "Not assigned", tone: "text-slate-400" };
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h2 className="text-2xl font-semibold">Aircraft</h2>
          <p className="text-sm text-slate-400">Maintain your fleet list.</p>
        </div>
        <div className="flex flex-wrap gap-3">
          <Button asChild>
            <Link href="#create-aircraft">Create Aircraft</Link>
          </Button>
          <Button asChild variant="outline">
            <Link href="/checklists">Manage checklists</Link>
          </Button>
        </div>
      </div>

      <Card id="create-aircraft">
        <CardHeader>
          <p className="text-sm text-slate-400">Add aircraft</p>
        </CardHeader>
        <CardContent>
          <form action={createAircraftAction} className="grid gap-3 lg:grid-cols-3">
            <Input name="tailNumber" placeholder="Tail number" required />
            <Input name="model" placeholder="Model" />
            <label className="text-sm text-slate-300 lg:col-span-1">
              <span className="mb-1 block text-xs uppercase text-slate-500">
                Aircraft type (optional)
              </span>
              <select
                name="aircraftTypeId"
                className="h-11 w-full rounded-md border border-slate-700 bg-slate-950 px-3 text-sm text-slate-100"
                defaultValue=""
              >
                <option value="">No type selected</option>
                {aircraftTypes.map((type) => (
                  <option key={type.id} value={type.id}>
                    {type.name}
                  </option>
                ))}
              </select>
            </label>
            <div className="lg:col-span-3">
              <Button type="submit">Save aircraft</Button>
            </div>
          </form>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <p className="text-sm text-slate-400">Fleet</p>
        </CardHeader>
        <CardContent>
          <div className="overflow-hidden rounded-lg border border-slate-800">
            <table className="w-full text-sm">
              <thead className="bg-slate-900 text-xs uppercase text-slate-500">
                <tr>
                  <th className="px-4 py-3 text-left font-medium">Tail</th>
                  <th className="px-4 py-3 text-left font-medium">Type</th>
                  <th className="px-4 py-3 text-left font-medium">Checklist readiness</th>
                  <th className="px-4 py-3 text-left font-medium">Added</th>
                  <th className="px-4 py-3 text-left font-medium">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800">
                {aircraft.length === 0 ? (
                  <tr>
                    <td className="px-4 py-4 text-sm text-slate-500" colSpan={5}>
                      No aircraft listed.
                    </td>
                  </tr>
                ) : (
                  aircraft.map((plane) => {
                    const readiness = readinessFor(plane);
                    return (
                      <tr key={plane.id} className="text-slate-200">
                        <td className="px-4 py-3">
                          <Link href={`/aircraft/${plane.id}`} className="font-semibold">
                            {plane.tailNumber}
                          </Link>
                        </td>
                        <td className="px-4 py-3">{plane.aircraftType?.name ?? "—"}</td>
                        <td className={`px-4 py-3 ${readiness.tone}`}>
                          {readiness.label}
                        </td>
                        <td className="px-4 py-3 text-slate-400">
                          {plane.createdAt.toDateString()}
                        </td>
                        <td className="px-4 py-3">
                          <Button asChild size="sm" variant="outline">
                            <Link href={`/aircraft/${plane.id}`}>Manage</Link>
                          </Button>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
