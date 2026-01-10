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

  const categoryLabel = (value: string | null | undefined) => {
    switch (value) {
      case "SINGLE_ENGINE_PISTON":
        return "Single-engine piston";
      case "MULTI_ENGINE_PISTON":
        return "Multi-engine piston";
      case "SINGLE_ENGINE_TURBINE":
        return "Single-engine turbine";
      case "MULTI_ENGINE_TURBINE":
        return "Multi-engine turbine";
      case "JET":
        return "Jet";
      case "GLIDER":
        return "Glider";
      case "HELICOPTER":
        return "Helicopter";
      default:
        return "Other";
    }
  };

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
            <Input name="manufacturer" placeholder="Manufacturer" />
            <Input name="model" placeholder="Model" />
            <label className="text-sm text-slate-300 lg:col-span-3">
              <span className="mb-1 block text-xs uppercase text-slate-500">Type</span>
              <select
                name="category"
                className="h-11 w-full rounded-md border border-slate-700 bg-slate-950 px-3 text-sm text-slate-100"
                defaultValue="SINGLE_ENGINE_PISTON"
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
            </label>
            {aircraftTypes.length > 0 ? (
              <label className="text-sm text-slate-300 lg:col-span-3">
                <span className="mb-1 block text-xs uppercase text-slate-500">
                  Checklist profile (optional)
                </span>
                <select
                  name="aircraftTypeId"
                  className="h-11 w-full rounded-md border border-slate-700 bg-slate-950 px-3 text-sm text-slate-100"
                  defaultValue=""
                >
                  <option value="">No profile selected</option>
                  {aircraftTypes.map((type) => (
                    <option key={type.id} value={type.id}>
                      {type.name}
                    </option>
                  ))}
                </select>
              </label>
            ) : null}
            <div className="lg:col-span-3">
              <Button type="submit">Save aircraft</Button>
            </div>
          </form>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <p className="text-sm text-slate-600 dark:text-slate-400">Fleet</p>
        </CardHeader>
        <CardContent>
          <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-950/40">
            <table className="w-full text-sm">
              <thead className="bg-slate-50 text-xs font-semibold uppercase text-slate-500 dark:bg-slate-900/60 dark:text-slate-400">
                <tr>
                  <th className="px-4 py-3 text-left font-medium">Tail</th>
                  <th className="px-4 py-3 text-left font-medium">Manufacturer</th>
                  <th className="px-4 py-3 text-left font-medium">Model</th>
                  <th className="px-4 py-3 text-left font-medium">Type</th>
                  <th className="px-4 py-3 text-left font-medium">Checklist readiness</th>
                  <th className="px-4 py-3 text-left font-medium">Added</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 dark:divide-slate-800">
                {aircraft.length === 0 ? (
                  <tr>
                    <td className="px-4 py-4 text-sm text-slate-500" colSpan={6}>
                      No aircraft listed.
                    </td>
                  </tr>
                ) : (
                  aircraft.map((plane) => {
                    const readiness = readinessFor(plane);
                    const href = `/aircraft/${plane.id}`;
                    return (
                      <tr
                        key={plane.id}
                        className="text-slate-900 transition hover:bg-slate-50 dark:text-slate-100 dark:hover:bg-slate-900/40"
                      >
                        <td className="px-4 py-3">
                          <Link href={href} className="block font-semibold">
                            {plane.tailNumber}
                          </Link>
                        </td>
                        <td className="px-4 py-3">
                          <Link href={href} className="block">
                            {plane.manufacturer ?? "—"}
                          </Link>
                        </td>
                        <td className="px-4 py-3">
                          <Link href={href} className="block">
                            {plane.model ?? "—"}
                          </Link>
                        </td>
                        <td className="px-4 py-3">
                          <Link href={href} className="block">
                            {categoryLabel(plane.category)}
                          </Link>
                        </td>
                        <td className={`px-4 py-3 ${readiness.tone}`}>
                          <Link href={href} className="block">
                            {readiness.label}
                          </Link>
                        </td>
                        <td className="px-4 py-3 text-slate-600 dark:text-slate-400">
                          <Link href={href} className="block">
                            {plane.createdAt.toDateString()}
                          </Link>
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
