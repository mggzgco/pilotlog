import Link from "next/link";
import { prisma } from "@/app/lib/db";
import { requireUser } from "@/app/lib/auth/session";
import { createCostAction } from "@/app/lib/actions/cost-actions";
import { Card, CardContent, CardHeader } from "@/app/components/ui/card";
import { Button } from "@/app/components/ui/button";
import { Input } from "@/app/components/ui/input";

export default async function CostsPage() {
  const user = await requireUser();

  const costs = await prisma.costItem.findMany({
    where: { userId: user.id },
    orderBy: { date: "desc" }
  });

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-semibold">Costs</h2>
        <p className="text-sm text-slate-400">Track receipts and training spend.</p>
      </div>

      <Card>
        <CardHeader>
          <p className="text-sm text-slate-400">Add expense</p>
        </CardHeader>
        <CardContent>
          {/* COST-004: capture cost details and receipt */}
          <form action={createCostAction} className="grid gap-3 md:grid-cols-3">
            <Input name="amount" placeholder="Amount" required />
            <Input name="currency" placeholder="Currency" defaultValue="USD" />
            <Input name="date" type="date" required />
            <Input name="description" placeholder="Description" className="md:col-span-2" />
            <Input name="receipt" type="file" className="md:col-span-2" />
            <div className="md:col-span-3">
              <Button type="submit">Save expense</Button>
            </div>
          </form>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <p className="text-sm text-slate-400">Recent expenses</p>
        </CardHeader>
        <CardContent>
          <div className="overflow-hidden rounded-lg border border-slate-800">
            <table className="w-full text-sm">
              <thead className="bg-slate-900 text-xs uppercase text-slate-500">
                <tr>
                  <th className="px-4 py-3 text-left font-medium">Date</th>
                  <th className="px-4 py-3 text-left font-medium">Description</th>
                  <th className="px-4 py-3 text-left font-medium">Amount</th>
                  <th className="px-4 py-3 text-right font-medium">Receipt</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800">
                {costs.length === 0 ? (
                  <tr>
                    <td className="px-4 py-4 text-sm text-slate-500" colSpan={4}>
                      No expenses logged.
                    </td>
                  </tr>
                ) : (
                  costs.map((cost) => (
                    <tr key={cost.id} className="text-slate-200">
                      <td className="px-4 py-3 text-slate-400">
                        {cost.date.toDateString()}
                      </td>
                      <td className="px-4 py-3">{cost.description ?? "No description"}</td>
                      <td className="px-4 py-3">
                        {cost.currency} {Number(cost.amount).toFixed(2)}
                      </td>
                      <td className="px-4 py-3 text-right">
                        {cost.receiptPath ? (
                          /* COST-006: secure receipt downloads */
                          <Button size="sm" variant="outline" asChild>
                            <Link href={`/api/download/${cost.receiptPath}`}>Receipt</Link>
                          </Button>
                        ) : (
                          <span className="text-xs text-slate-500">—</span>
                        )}
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
