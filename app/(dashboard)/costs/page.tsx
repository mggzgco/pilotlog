import Link from "next/link";
import { prisma } from "@/app/lib/db";
import { getCurrentSession } from "@/app/lib/session";
import { createCostAction } from "@/app/lib/actions/cost-actions";
import { Card, CardContent, CardHeader } from "@/app/components/ui/card";
import { Button } from "@/app/components/ui/button";
import { Input } from "@/app/components/ui/input";

export default async function CostsPage() {
  const { user } = await getCurrentSession();
  if (!user) {
    return null;
  }

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
          <div className="space-y-3">
            {/* COST-005: list recent expenses */}
            {costs.length === 0 && (
              <p className="text-sm text-slate-500">No expenses logged.</p>
            )}
            {costs.map((cost) => (
              <div
                key={cost.id}
                className="flex items-center justify-between rounded-lg border border-slate-800 p-4"
              >
                <div>
                  <p className="text-lg font-semibold">
                    {cost.currency} {Number(cost.amount).toFixed(2)}
                  </p>
                  <p className="text-xs text-slate-400">
                    {cost.date.toDateString()} · {cost.description ?? "No description"}
                  </p>
                </div>
                {cost.receiptPath && (
                  /* COST-006: secure receipt downloads */
                  <Button variant="outline" asChild>
                    <Link href={`/api/download/${cost.receiptPath}`}>Receipt</Link>
                  </Button>
                )}
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
