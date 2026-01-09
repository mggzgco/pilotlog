import Link from "next/link";
import { prisma } from "@/app/lib/db";
import { getCurrentSession } from "@/app/lib/session";
import { createPlannedFlightAction } from "@/app/lib/actions/planned-flight-actions";
import { Card, CardContent, CardHeader } from "@/app/components/ui/card";
import { Button } from "@/app/components/ui/button";
import { Input } from "@/app/components/ui/input";

export default async function PlannedFlightsPage() {
  const { user } = await getCurrentSession();
  if (!user) {
    return null;
  }

  const plannedFlights = await prisma.plannedFlight.findMany({
    where: { userId: user.id },
    orderBy: { createdAt: "desc" }
  });

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-semibold">Planned flights</h2>
        <p className="text-sm text-slate-400">
          Build pre-flight checklists and match ADS-B data after landing.
        </p>
      </div>

      <Card>
        <CardHeader>
          <p className="text-sm text-slate-400">Plan a flight</p>
        </CardHeader>
        <CardContent>
          {/* CHK-001: capture planned flight details before departure */}
          <form
            action={createPlannedFlightAction}
            className="grid gap-3 md:grid-cols-3"
          >
            <Input name="tailNumber" placeholder="Tail number" required />
            <Input name="plannedAt" type="datetime-local" />
            <div className="md:col-span-3">
              <Button type="submit">Create planned flight</Button>
            </div>
          </form>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <p className="text-sm text-slate-400">Upcoming & recent plans</p>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {plannedFlights.length === 0 && (
              <p className="text-sm text-slate-500">No planned flights yet.</p>
            )}
            {plannedFlights.map((plan) => (
              <Link
                key={plan.id}
                href={`/planned-flights/${plan.id}`}
                className="block rounded-lg border border-slate-800 p-4 text-sm text-slate-200 hover:border-slate-700"
              >
                <div className="flex items-center justify-between">
                  <p className="font-semibold">{plan.tailNumber}</p>
                  <p className="text-xs text-slate-400">
                    {plan.plannedAt
                      ? new Date(plan.plannedAt).toLocaleString()
                      : "Date/time TBD"}
                  </p>
                </div>
                <div className="mt-2 flex flex-wrap gap-2 text-xs text-slate-400">
                  <span>
                    Pre-flight: {plan.preflightSignedAt ? "Signed" : "Pending"}
                  </span>
                  <span>
                    Post-flight: {plan.postflightSignedAt ? "Signed" : "Pending"}
                  </span>
                  <span>ADS-B: {plan.adsbMatchStatus}</span>
                </div>
              </Link>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
