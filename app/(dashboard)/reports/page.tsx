import { requireUser } from "@/app/lib/auth/session";
import { Card, CardContent, CardHeader } from "@/app/components/ui/card";

export default async function ReportsPage() {
  await requireUser();
  const reports: Array<{ id: string; name: string; period: string; status: string }> = [];

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-semibold">Reports</h2>
        <p className="text-sm text-slate-400">
          Generate summaries for flight hours, costs, and compliance.
        </p>
      </div>

      <Card>
        <CardHeader>
          <p className="text-sm text-slate-400">Saved reports</p>
        </CardHeader>
        <CardContent>
          <div className="overflow-hidden rounded-lg border border-slate-800">
            <table className="w-full text-sm">
              <thead className="bg-slate-900 text-xs uppercase text-slate-500">
                <tr>
                  <th className="px-4 py-3 text-left font-medium">Report</th>
                  <th className="px-4 py-3 text-left font-medium">Period</th>
                  <th className="px-4 py-3 text-left font-medium">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800">
                {reports.length === 0 ? (
                  <tr>
                    <td className="px-4 py-4 text-sm text-slate-500" colSpan={3}>
                      No reports created yet.
                    </td>
                  </tr>
                ) : (
                  reports.map((report) => (
                    <tr key={report.id} className="text-slate-200">
                      <td className="px-4 py-3">{report.name}</td>
                      <td className="px-4 py-3">{report.period}</td>
                      <td className="px-4 py-3 text-slate-400">{report.status}</td>
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
