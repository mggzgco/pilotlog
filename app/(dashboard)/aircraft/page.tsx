import { prisma } from "@/app/lib/db";
import { getCurrentSession } from "@/app/lib/session";
import { createAircraftAction } from "@/app/lib/actions/aircraft-actions";
import { Card, CardContent, CardHeader } from "@/app/components/ui/card";
import { Button } from "@/app/components/ui/button";
import { Input } from "@/app/components/ui/input";

export default async function AircraftPage() {
  const { user } = await getCurrentSession();
  if (!user) {
    return null;
  }

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
          <div className="space-y-3">
            {aircraft.length === 0 && (
              <p className="text-sm text-slate-500">No aircraft listed.</p>
            )}
            {aircraft.map((plane) => (
              <div
                key={plane.id}
                className="flex items-center justify-between rounded-lg border border-slate-800 p-4"
              >
                <div>
                  <p className="text-lg font-semibold">{plane.tailNumber}</p>
                  <p className="text-xs text-slate-400">{plane.model ?? "—"}</p>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
