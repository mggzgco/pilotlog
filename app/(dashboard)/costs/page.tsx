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
  const currencyFormatter = new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD"
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
            <Input name="category" placeholder="Category" required />
            <Input name="amount" placeholder="Amount" type="number" step="0.01" required />
            <Input name="date" type="date" required />
            <Input name="vendor" placeholder="Vendor" />
            <Input name="notes" placeholder="Notes" className="md:col-span-2" />
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
                  <th className="px-4 py-3 text-left font-medium">Category</th>
                  <th className="px-4 py-3 text-left font-medium">Vendor</th>
                  <th className="px-4 py-3 text-left font-medium">Notes</th>
                  <th className="px-4 py-3 text-left font-medium">Amount</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800">
                {costs.length === 0 ? (
                  <tr>
                    <td className="px-4 py-4 text-sm text-slate-500" colSpan={5}>
                      No expenses logged.
                    </td>
                  </tr>
                ) : (
                  costs.map((cost) => (
                    <tr key={cost.id} className="text-slate-200">
                      <td className="px-4 py-3 text-slate-400">
                        {cost.date.toDateString()}
                      </td>
                      <td className="px-4 py-3">{cost.category}</td>
                      <td className="px-4 py-3">{cost.vendor ?? "—"}</td>
                      <td className="px-4 py-3">{cost.notes ?? "—"}</td>
                      <td className="px-4 py-3">
                        {currencyFormatter.format(cost.amountCents / 100)}
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
