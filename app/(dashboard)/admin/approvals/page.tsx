import { prisma } from "@/app/lib/db";
import { requireAdmin } from "@/app/lib/auth/session";
import { approveUserAction, rejectUserAction } from "@/app/lib/actions/admin-actions";
import { Card, CardContent, CardHeader } from "@/app/components/ui/card";
import { Button } from "@/app/components/ui/button";

export default async function ApprovalsPage() {
  await requireAdmin();

  // ADMIN-002: list pending accounts for approval
  const pending = await prisma.user.findMany({
    where: { status: "PENDING", deletedAt: null },
    orderBy: { createdAt: "asc" },
    select: {
      id: true,
      name: true,
      email: true,
      phone: true,
      emailVerifiedAt: true
    }
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
              <div
                key={pendingUser.id}
                className="flex flex-col gap-3 rounded-lg border border-slate-800 p-4 lg:flex-row md:items-center md:justify-between"
              >
                <div>
                  <p className="text-lg font-semibold">{pendingUser.name ?? "—"}</p>
                  <p className="text-xs text-slate-400">{pendingUser.email}</p>
                  <p className="text-xs text-slate-500">
                    {pendingUser.phone ?? "No phone"} ·{" "}
                    {pendingUser.emailVerifiedAt ? "Email verified" : "Email not verified"}
                  </p>
                </div>
                <div className="flex gap-2">
                  <form action={approveUserAction}>
                    <input type="hidden" name="userId" value={pendingUser.id} />
                    {/* ADMIN-003: approve pending account */}
                    <Button type="submit">Approve</Button>
                  </form>
                  <form action={rejectUserAction}>
                    <input type="hidden" name="userId" value={pendingUser.id} />
                    {/* ADMIN-004: reject pending account */}
                    <Button
                      type="submit"
                      className="bg-rose-50 text-rose-800 dark:bg-rose-500/20 dark:text-rose-200"
                    >
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
