import { prisma } from "@/app/lib/db";
import { getCurrentSession } from "@/app/lib/session";
import { createLogbookEntryAction } from "@/app/lib/actions/logbook-actions";
import { Card, CardContent, CardHeader } from "@/app/components/ui/card";
import { Button } from "@/app/components/ui/button";
import { Input } from "@/app/components/ui/input";

export default async function LogbookPage() {
  const { user } = await getCurrentSession();
  if (!user) {
    return null;
  }

  const entries = await prisma.logbookEntry.findMany({
    where: { userId: user.id },
    orderBy: { date: "desc" }
  });

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-semibold">Logbook</h2>
        <p className="text-sm text-slate-400">Track PIC/SIC, night, and IFR time.</p>
      </div>

      <Card>
        <CardHeader>
          <p className="text-sm text-slate-400">Add logbook entry</p>
        </CardHeader>
        <CardContent>
          {/* LOG-002: capture PIC/SIC/night/IFR details */}
          <form action={createLogbookEntryAction} className="grid gap-3 lg:grid-cols-3">
            <Input name="date" type="date" required />
            <Input name="totalTime" placeholder="Total time" />
            <Input name="picTime" placeholder="PIC time" />
            <Input name="sicTime" placeholder="SIC time" />
            <Input name="nightTime" placeholder="Night" />
            <Input name="instrumentTime" placeholder="Instrument" />
            <Input name="remarks" placeholder="Remarks" className="lg:col-span-2" />
            <div className="lg:col-span-3">
              <Button type="submit">Save entry</Button>
            </div>
          </form>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <p className="text-sm text-slate-400">Recent entries</p>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {/* LOG-003: recent logbook history */}
            {entries.length === 0 && (
              <p className="text-sm text-slate-500">No logbook entries yet.</p>
            )}
            {entries.map((entry) => (
              <div
                key={entry.id}
                className="rounded-lg border border-slate-800 p-4 text-sm text-slate-200"
              >
                <div className="flex items-center justify-between">
                  <p className="font-semibold">{entry.date.toDateString()}</p>
                  {/* LOG-004: show total time per entry */}
                  <p>{Number(entry.totalTime ?? 0).toFixed(1)} hrs</p>
                </div>
                <p className="text-xs text-slate-400">{entry.remarks ?? "—"}</p>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
