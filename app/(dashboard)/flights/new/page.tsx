import { prisma } from "@/app/lib/db";
import { requireUser } from "@/app/lib/session";
import { Card, CardContent, CardHeader } from "@/app/components/ui/card";
import { PlanFlightForm } from "@/app/components/flights/plan-flight-form";

export default async function NewPlannedFlightPage() {
  const user = await requireUser();
  const profile = await prisma.user.findUnique({
    where: { id: user.id },
    select: { homeAirport: true, homeTimeZone: true }
  });
  const aircraft = await prisma.aircraft.findMany({
    where: { userId: user.id },
    orderBy: { tailNumber: "asc" }
  });
  const users = await prisma.user.findMany({
    orderBy: [{ lastName: "asc" }, { firstName: "asc" }],
    select: { id: true, firstName: true, lastName: true, name: true, email: true }
  });
  const participantOptions = users.map((entry) => ({
    id: entry.id,
    label:
      [entry.firstName, entry.lastName].filter(Boolean).join(" ") ||
      entry.name ||
      entry.email
  }));

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-semibold">Plan a flight</h2>
        <p className="text-sm text-slate-400">
          Create a planned flight with pre-flight and post-flight checklists.
        </p>
      </div>

      <Card>
        <CardHeader>
          <p className="text-sm text-slate-400">Planned flight details</p>
        </CardHeader>
        <CardContent>
          <PlanFlightForm
            aircraftOptions={aircraft}
            participantOptions={participantOptions}
            defaultDepartureLabel={profile?.homeAirport ?? ""}
            defaultTimeZone={profile?.homeTimeZone ?? ""}
          />
        </CardContent>
      </Card>
    </div>
  );
}
