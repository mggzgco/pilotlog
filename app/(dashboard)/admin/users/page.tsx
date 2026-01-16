import Link from "next/link";
import { prisma } from "@/app/lib/db";
import { requireAdmin } from "@/app/lib/auth/session";
import { Card, CardContent, CardHeader } from "@/app/components/ui/card";
import { Button } from "@/app/components/ui/button";
import {
  adminDeleteUserAction,
  adminForcePasswordResetAction,
  adminResendVerificationAction,
  adminUpdateUserRoleAction,
  adminUpdateUserStatusAction
} from "@/app/lib/actions/admin-user-actions";

export default async function AdminUsersPage({
  searchParams
}: {
  searchParams?: { toast?: string; toastType?: string };
}) {
  const admin = await requireAdmin();

  const users = await prisma.user.findMany({
    orderBy: [{ status: "asc" }, { createdAt: "desc" }],
    select: {
      id: true,
      email: true,
      name: true,
      phone: true,
      role: true,
      status: true,
      createdAt: true,
      emailVerifiedAt: true,
      lastLoginAt: true
    }
  });

  const inactiveCutoff = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000);

  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <h2 className="text-2xl font-semibold">User management</h2>
        <p className="text-sm text-slate-400">
          Manage accounts, roles, approvals, and password resets.
        </p>
      </div>

      {searchParams?.toast ? (
        <div
          className={[
            "rounded-lg border p-3 text-sm",
            searchParams.toastType === "error"
              ? "border-rose-500/40 bg-rose-500/10 text-rose-200"
              : "border-emerald-500/40 bg-emerald-500/10 text-emerald-200"
          ].join(" ")}
        >
          {searchParams.toast}
        </div>
      ) : null}

      <Card>
        <CardHeader>
          <p className="text-sm text-slate-400">All users</p>
        </CardHeader>
        <CardContent>
          <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-950/40">
            <table className="w-full text-sm">
              <thead className="bg-slate-50 text-xs font-semibold uppercase text-slate-500 dark:bg-slate-900/60 dark:text-slate-400">
                <tr>
                  <th className="px-4 py-3 text-left font-medium">Email</th>
                  <th className="px-4 py-3 text-left font-medium">Name</th>
                  <th className="px-4 py-3 text-left font-medium">Status</th>
                  <th className="px-4 py-3 text-left font-medium">Role</th>
                  <th className="px-4 py-3 text-right font-medium">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 dark:divide-slate-800">
                {users.map((u) => {
                  const isSelf = u.id === admin.id;
                  const lastLogin = u.lastLoginAt ?? null;
                  const isInactive =
                    u.status === "ACTIVE" &&
                    ((lastLogin && lastLogin < inactiveCutoff) ||
                      (!lastLogin && u.createdAt < inactiveCutoff));
                  const statusLabel =
                    u.status === "PENDING"
                      ? "PENDING"
                      : u.status === "DISABLED"
                        ? "DISABLED"
                        : isInactive
                          ? "INACTIVE"
                          : "ACTIVE";
                  return (
                    <tr key={u.id} className="text-slate-900 dark:text-slate-100">
                      <td className="px-4 py-3">
                        <div className="font-semibold">
                          <Link
                            href={`/admin/users/${u.id}`}
                            className="text-sky-700 hover:text-sky-800 dark:text-sky-400 dark:hover:text-sky-300"
                          >
                            {u.email}
                          </Link>
                        </div>
                        <div className="text-xs text-slate-500">
                          {u.phone ?? "—"} · Created {u.createdAt.toDateString()}
                          {lastLogin ? ` · Last sign-in ${lastLogin.toDateString()}` : ""}
                        </div>
                      </td>
                      <td className="px-4 py-3">{u.name ?? "—"}</td>
                      <td className="px-4 py-3">
                        <form action={adminUpdateUserStatusAction} className="flex items-center gap-2">
                          <input type="hidden" name="userId" value={u.id} />
                          <select
                            name="status"
                            defaultValue={statusLabel}
                            disabled={isSelf}
                            className="h-10 rounded-md border border-slate-200 bg-white px-3 text-sm text-slate-900 shadow-sm dark:border-slate-800 dark:bg-slate-950 dark:text-slate-100"
                          >
                            <option value="ACTIVE">Active</option>
                            <option value="INACTIVE" disabled>
                              Inactive (90+ days)
                            </option>
                            <option value="DISABLED">Disabled</option>
                            <option value="PENDING">Pending</option>
                          </select>
                          <Button type="submit" variant="outline" size="sm" disabled={isSelf}>
                            Save
                          </Button>
                        </form>
                      </td>
                      <td className="px-4 py-3">
                        <form action={adminUpdateUserRoleAction} className="flex items-center gap-2">
                          <input type="hidden" name="userId" value={u.id} />
                          <select
                            name="role"
                            defaultValue={u.role}
                            disabled={isSelf}
                            className="h-10 rounded-md border border-slate-200 bg-white px-3 text-sm text-slate-900 shadow-sm dark:border-slate-800 dark:bg-slate-950 dark:text-slate-100"
                          >
                            <option value="USER">User</option>
                            <option value="ADMIN">Admin</option>
                          </select>
                          <Button type="submit" variant="outline" size="sm" disabled={isSelf}>
                            Save
                          </Button>
                        </form>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex flex-wrap justify-end gap-2">
                          <span className="self-center text-xs text-slate-500">
                            {u.emailVerifiedAt ? "Verified" : "Unverified"}
                          </span>
                          {!u.emailVerifiedAt ? (
                            <form action={adminResendVerificationAction}>
                              <input type="hidden" name="userId" value={u.id} />
                              <Button type="submit" variant="outline" size="sm">
                                Resend verify
                              </Button>
                            </form>
                          ) : null}
                          <form action={adminForcePasswordResetAction}>
                            <input type="hidden" name="userId" value={u.id} />
                            <Button type="submit" variant="outline" size="sm">
                              Force reset
                            </Button>
                          </form>
                          <form action={adminDeleteUserAction}>
                            <input type="hidden" name="userId" value={u.id} />
                            <Button
                              type="submit"
                              variant="outline"
                              size="sm"
                              className="border-rose-500/40 text-rose-600 hover:bg-rose-50 dark:text-rose-300 dark:hover:bg-rose-500/10"
                              disabled={isSelf}
                            >
                              Delete
                            </Button>
                          </form>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

