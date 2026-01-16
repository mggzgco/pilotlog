import { prisma } from "@/app/lib/db";
import { requireAdmin } from "@/app/lib/auth/session";
import { approveUserAction, rejectUserAction } from "@/app/lib/actions/admin-actions";
import { Card, CardContent, CardHeader } from "@/app/components/ui/card";
import { Button } from "@/app/components/ui/button";

export default async function AdminPendingUsersPage() {
  await requireAdmin();

  const pending = await prisma.user.findMany({
    where: { status: "PENDING" },
    orderBy: { createdAt: "asc" }
  });

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-semibold">Pending users</h2>
        <p className="text-sm text-slate-400">
          Review pending accounts awaiting approval.
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
              <div
                key={pendingUser.id}
                className="flex flex-col gap-3 rounded-lg border border-slate-800 p-4 lg:flex-row md:items-center md:justify-between"
              >
                <div>
                  <p className="text-lg font-semibold">{pendingUser.name ?? "—"}</p>
                  <p className="text-xs text-slate-400">{pendingUser.email}</p>
                  <p className="text-xs text-slate-500">{pendingUser.phone ?? "No phone"}</p>
                </div>
                <div className="flex gap-2">
                  <form action={approveUserAction}>
                    <input type="hidden" name="userId" value={pendingUser.id} />
                    <Button type="submit">Approve</Button>
                  </form>
                  <form action={rejectUserAction}>
                    <input type="hidden" name="userId" value={pendingUser.id} />
                    <Button type="submit" className="bg-rose-500/20 text-rose-100">
                      Reject
                    </Button>
                  </form>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

