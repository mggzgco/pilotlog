import { redirect } from "next/navigation";
import { prisma } from "@/app/lib/db";
import { getCurrentSession } from "@/app/lib/session";
import { approveUserAction } from "@/app/lib/actions/admin-actions";
import { Card, CardContent, CardHeader } from "@/app/components/ui/card";
import { Button } from "@/app/components/ui/button";

export default async function ApprovalsPage() {
  const { user } = await getCurrentSession();
  if (!user) {
    return null;
  }

  if (user.role !== "ADMIN") {
    redirect("/dashboard");
  }

  // ADMIN-002: list pending accounts for approval
  const pending = await prisma.user.findMany({
    where: { approved: false },
    orderBy: { createdAt: "asc" }
  });

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-semibold">Pending approvals</h2>
        <p className="text-sm text-slate-400">
          Approve new pilot accounts before they can sign in.
        </p>
      </div>

      <Card>
        <CardHeader>
          <p className="text-sm text-slate-400">Requests</p>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {pending.length === 0 && (
              <p className="text-sm text-slate-500">No pending approvals.</p>
            )}
            {pending.map((pendingUser) => (
              <form
                key={pendingUser.id}
                action={approveUserAction}
                className="flex items-center justify-between rounded-lg border border-slate-800 p-4"
              >
                <div>
                  <p className="text-lg font-semibold">{pendingUser.name ?? "—"}</p>
                  <p className="text-xs text-slate-400">{pendingUser.email}</p>
                </div>
                <input type="hidden" name="userId" value={pendingUser.id} />
                {/* ADMIN-003: approve pending account */}
                <Button type="submit">Approve</Button>
              </form>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
