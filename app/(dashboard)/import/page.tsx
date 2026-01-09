import { importFlightsAction } from "@/app/lib/actions/flight-actions";
import { Card, CardContent, CardHeader } from "@/app/components/ui/card";
import { Button } from "@/app/components/ui/button";
import { Input } from "@/app/components/ui/input";

export default function ImportPage() {
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
    </div>
  );
}
