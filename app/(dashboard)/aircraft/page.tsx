import { prisma } from "@/app/lib/db";
import { requireUser } from "@/app/lib/auth/session";
import { createAircraftAction } from "@/app/lib/actions/aircraft-actions";
import { Card, CardContent, CardHeader } from "@/app/components/ui/card";
import { Button } from "@/app/components/ui/button";
import { Input } from "@/app/components/ui/input";

export default async function AircraftPage() {
  const user = await requireUser();

  const aircraft = await prisma.aircraft.findMany({
    where: { userId: user.id },
    orderBy: { createdAt: "desc" }
  });

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-semibold">Aircraft</h2>
        <p className="text-sm text-slate-400">Maintain your fleet list.</p>
      </div>

      <Card>
        <CardHeader>
          <p className="text-sm text-slate-400">Add aircraft</p>
        </CardHeader>
        <CardContent>
          <form action={createAircraftAction} className="grid gap-3 md:grid-cols-3">
            <Input name="tailNumber" placeholder="Tail number" required />
            <Input name="model" placeholder="Model" />
            <div className="md:col-span-3">
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
                  <th className="px-4 py-3 text-left font-medium">Model</th>
                  <th className="px-4 py-3 text-left font-medium">Added</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800">
                {aircraft.length === 0 ? (
                  <tr>
                    <td className="px-4 py-4 text-sm text-slate-500" colSpan={3}>
                      No aircraft listed.
                    </td>
                  </tr>
                ) : (
                  aircraft.map((plane) => (
                    <tr key={plane.id} className="text-slate-200">
                      <td className="px-4 py-3">{plane.tailNumber}</td>
                      <td className="px-4 py-3">{plane.model ?? "—"}</td>
                      <td className="px-4 py-3 text-slate-400">
                        {plane.createdAt.toDateString()}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
