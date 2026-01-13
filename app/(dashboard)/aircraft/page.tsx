import Link from "next/link";
import { prisma } from "@/app/lib/db";
import { requireUser } from "@/app/lib/auth/session";
import { Card, CardContent, CardHeader } from "@/app/components/ui/card";
import { Button } from "@/app/components/ui/button";
import { Input } from "@/app/components/ui/input";
import { CreateAircraftModal } from "@/app/components/aircraft/create-aircraft-modal";
import { AircraftRowMenu } from "@/app/components/aircraft/aircraft-row-menu";
import { CollapsibleCard } from "@/app/components/ui/collapsible-card";

type AircraftSearchParams = {
  search?: string;
  category?: string;
};

export default async function AircraftPage({ searchParams }: { searchParams?: AircraftSearchParams }) {
  const user = await requireUser();

  const search = (searchParams?.search ?? "").trim();
  const category = (searchParams?.category ?? "").trim();
  const allowedCategories = new Set([
    "SINGLE_ENGINE_PISTON",
    "MULTI_ENGINE_PISTON",
    "SINGLE_ENGINE_TURBINE",
    "MULTI_ENGINE_TURBINE",
    "JET",
    "GLIDER",
    "HELICOPTER",
    "OTHER"
  ]);
  const categoryFilter = allowedCategories.has(category) ? category : "";

  const [aircraft] = await Promise.all([
    prisma.aircraft.findMany({
      where: {
        userId: user.id,
        ...(categoryFilter ? { category: categoryFilter as any } : {}),
        ...(search
          ? {
              OR: [
                { tailNumber: { contains: search, mode: "insensitive" } },
                { manufacturer: { contains: search, mode: "insensitive" } },
                { model: { contains: search, mode: "insensitive" } }
              ]
            }
          : {})
      },
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
          <CreateAircraftModal triggerLabel="Create aircraft" />
          <Button asChild variant="outline">
            <Link href="/checklists">Manage checklists</Link>
          </Button>
        </div>
      </div>

      <CollapsibleCard title="Filters" defaultOpen={Boolean(search || categoryFilter)}>
        <form method="get" className="grid gap-3 lg:grid-cols-3">
          <Input name="search" placeholder="Search tail, manufacturer, model" defaultValue={search} />
          <select
            name="category"
            defaultValue={categoryFilter}
            className="h-11 rounded-md border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 shadow-sm outline-none focus-visible:ring-2 focus-visible:ring-brand-500 focus-visible:ring-offset-2 focus-visible:ring-offset-white dark:border-slate-800 dark:bg-slate-950 dark:text-slate-100 dark:focus-visible:ring-offset-slate-950"
          >
            <option value="">All types</option>
            <option value="SINGLE_ENGINE_PISTON">Single-engine piston</option>
            <option value="MULTI_ENGINE_PISTON">Multi-engine piston</option>
            <option value="SINGLE_ENGINE_TURBINE">Single-engine turbine</option>
            <option value="MULTI_ENGINE_TURBINE">Multi-engine turbine</option>
            <option value="JET">Jet</option>
            <option value="HELICOPTER">Helicopter</option>
            <option value="GLIDER">Glider</option>
            <option value="OTHER">Other</option>
          </select>
          <div className="flex flex-wrap gap-2 lg:col-span-3">
            <Button type="submit" variant="outline">
              Apply filters
            </Button>
            <Button asChild variant="ghost">
              <Link href="/aircraft">Reset</Link>
            </Button>
          </div>
        </form>
      </CollapsibleCard>

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
                  <th className="px-4 py-3 text-right font-medium">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 dark:divide-slate-800">
                {aircraft.length === 0 ? (
                  <tr>
                    <td className="px-4 py-4 text-sm text-slate-500" colSpan={7}>
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
                        <td className="px-4 py-3">
                          <div className="flex justify-end">
                            <AircraftRowMenu aircraftId={plane.id} />
                          </div>
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
