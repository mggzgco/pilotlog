import { importFlightsAction } from "@/app/lib/actions/flight-actions";
import { requireUser } from "@/app/lib/auth/session";
import { Card, CardContent, CardHeader } from "@/app/components/ui/card";
import { Button } from "@/app/components/ui/button";
import { Input } from "@/app/components/ui/input";

export default async function ImportPage() {
  await requireUser();
  const imports: Array<{ id: string; tailNumber: string; range: string; status: string }> = [];

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-semibold">ADS-B Import</h2>
        <p className="text-sm text-slate-400">
          Pull flights by tail number and time window.
        </p>
      </div>

      <Card>
        <CardHeader>
          <p className="text-sm text-slate-400">Import criteria</p>
        </CardHeader>
        <CardContent>
          <form action={importFlightsAction} className="grid gap-3 md:grid-cols-3">
            <Input name="tailNumber" placeholder="Tail # (e.g. N12345)" required />
            <Input name="start" type="datetime-local" required />
            <Input name="end" type="datetime-local" required />
            <div className="md:col-span-3">
              <Button type="submit">Import flights</Button>
            </div>
          </form>
          <p className="mt-4 text-xs text-slate-500">
            Mock provider returns sample flights for tail number N12345.
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <p className="text-sm text-slate-400">Recent imports</p>
        </CardHeader>
        <CardContent>
          <div className="overflow-hidden rounded-lg border border-slate-800">
            <table className="w-full text-sm">
              <thead className="bg-slate-900 text-xs uppercase text-slate-500">
                <tr>
                  <th className="px-4 py-3 text-left font-medium">Tail</th>
                  <th className="px-4 py-3 text-left font-medium">Range</th>
                  <th className="px-4 py-3 text-left font-medium">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800">
                {imports.length === 0 ? (
                  <tr>
                    <td className="px-4 py-4 text-sm text-slate-500" colSpan={3}>
                      No imports yet.
                    </td>
                  </tr>
                ) : (
                  imports.map((record) => (
                    <tr key={record.id} className="text-slate-200">
                      <td className="px-4 py-3">{record.tailNumber}</td>
                      <td className="px-4 py-3">{record.range}</td>
                      <td className="px-4 py-3 text-slate-400">{record.status}</td>
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
