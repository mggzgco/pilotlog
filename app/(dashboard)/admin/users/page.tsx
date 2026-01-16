import Link from "next/link";
import { prisma } from "@/app/lib/db";
import { requireAdmin } from "@/app/lib/auth/session";
import { Card, CardContent, CardHeader } from "@/app/components/ui/card";
import { Button } from "@/app/components/ui/button";
import { Input } from "@/app/components/ui/input";
import { CreateUserModal } from "@/app/components/admin/create-user-modal";
import { UserRowMenu } from "@/app/components/admin/user-row-menu";

export default async function AdminUsersPage({
  searchParams
}: {
  searchParams?: {
    toast?: string;
    toastType?: string;
    q?: string;
    status?: string;
    role?: string;
    verified?: string;
    includeDeleted?: string;
    page?: string;
  };
}) {
  const admin = await requireAdmin();

  const query = searchParams?.q?.trim();
  const statusFilter = searchParams?.status?.trim();
  const roleFilter = searchParams?.role?.trim();
  const verifiedFilter = searchParams?.verified?.trim();
  const includeDeleted = searchParams?.includeDeleted === "1";
  const page = Math.max(1, Number(searchParams?.page ?? 1) || 1);
  const pageSize = 25;

  const where: Record<string, unknown> = {};
  if (!includeDeleted) {
    where.deletedAt = null;
  }
  if (statusFilter && statusFilter !== "ALL") {
    where.status = statusFilter;
  }
  if (roleFilter && roleFilter !== "ALL") {
    where.role = roleFilter;
  }
  if (verifiedFilter === "verified") {
    where.emailVerifiedAt = { not: null };
  }
  if (verifiedFilter === "unverified") {
    where.emailVerifiedAt = null;
  }
  if (query) {
    where.OR = [
      { email: { contains: query, mode: "insensitive" } },
      { name: { contains: query, mode: "insensitive" } },
      { phone: { contains: query, mode: "insensitive" } }
    ];
  }

  const [users, total] = await Promise.all([
    prisma.user.findMany({
      where,
      orderBy: [{ status: "asc" }, { createdAt: "desc" }],
      skip: (page - 1) * pageSize,
      take: pageSize,
      select: {
        id: true,
        email: true,
        name: true,
        phone: true,
        role: true,
        status: true,
        createdAt: true,
        emailVerifiedAt: true,
        lastLoginAt: true,
        deletedAt: true
      }
    }),
    prisma.user.count({ where })
  ]);

  const inactiveCutoff = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000);

  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <h2 className="text-2xl font-semibold">User management</h2>
        <p className="text-sm text-slate-400">
          Manage accounts, roles, approvals, and password resets.
        </p>
        <div className="pt-2">
          <CreateUserModal />
        </div>
      </div>

      {searchParams?.toast ? (
        <div
          className={[
            "rounded-lg border p-3 text-sm",
            searchParams.toastType === "error"
              ? "border-rose-500/40 bg-rose-50 text-rose-800 dark:bg-rose-500/10 dark:text-rose-200"
              : "border-emerald-500/40 bg-emerald-50 text-emerald-800 dark:bg-emerald-500/10 dark:text-emerald-200"
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
          <form className="mb-4 flex flex-wrap items-end gap-3" method="get">
            <div className="space-y-1">
              <label className="text-xs uppercase text-slate-500">Search</label>
              <Input name="q" defaultValue={query} placeholder="Email, name, phone" />
            </div>
            <div className="space-y-1">
              <label className="text-xs uppercase text-slate-500">Status</label>
              <select
                name="status"
                defaultValue={statusFilter ?? "ALL"}
                className="h-11 rounded-md border border-slate-200 bg-white px-3 text-sm text-slate-900 shadow-sm dark:border-slate-800 dark:bg-slate-950 dark:text-slate-100"
              >
                <option value="ALL">All</option>
                <option value="PENDING">Pending</option>
                <option value="ACTIVE">Active</option>
                <option value="DISABLED">Disabled</option>
              </select>
            </div>
            <div className="space-y-1">
              <label className="text-xs uppercase text-slate-500">Role</label>
              <select
                name="role"
                defaultValue={roleFilter ?? "ALL"}
                className="h-11 rounded-md border border-slate-200 bg-white px-3 text-sm text-slate-900 shadow-sm dark:border-slate-800 dark:bg-slate-950 dark:text-slate-100"
              >
                <option value="ALL">All</option>
                <option value="USER">User</option>
                <option value="ADMIN">Admin</option>
              </select>
            </div>
            <div className="space-y-1">
              <label className="text-xs uppercase text-slate-500">Verified</label>
              <select
                name="verified"
                defaultValue={verifiedFilter ?? "all"}
                className="h-11 rounded-md border border-slate-200 bg-white px-3 text-sm text-slate-900 shadow-sm dark:border-slate-800 dark:bg-slate-950 dark:text-slate-100"
              >
                <option value="all">All</option>
                <option value="verified">Verified</option>
                <option value="unverified">Unverified</option>
              </select>
            </div>
            <label className="flex items-center gap-2 text-xs text-slate-500">
              <input
                type="checkbox"
                name="includeDeleted"
                value="1"
                defaultChecked={includeDeleted}
                className="h-4 w-4 rounded border-slate-300"
              />
              Include deleted
            </label>
            <Button type="submit" variant="outline" size="sm">
              Apply
            </Button>
          </form>
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
                    u.deletedAt
                      ? "DELETED"
                      : u.status === "PENDING"
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
                          {u.deletedAt ? ` · Deleted ${u.deletedAt.toDateString()}` : ""}
                        </div>
                      </td>
                      <td className="px-4 py-3">{u.name ?? "—"}</td>
                      <td className="px-4 py-3">
                        <div className="text-sm text-slate-700 dark:text-slate-200">
                          {statusLabel}
                        </div>
                        <div className="text-xs text-slate-500">
                          {u.emailVerifiedAt ? "Verified" : "Unverified"}
                        </div>
                      </td>
                      <td className="px-4 py-3">{u.role}</td>
                      <td className="px-4 py-3">
                        <div className="flex justify-end">
                          <UserRowMenu
                            userId={u.id}
                            email={u.email}
                            name={u.name}
                            phone={u.phone}
                            role={u.role}
                            emailVerifiedAt={u.emailVerifiedAt}
                            status={u.status}
                            deletedAt={u.deletedAt}
                          />
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          <div className="mt-4 flex items-center justify-between text-sm text-slate-500">
            <span>
              Showing {(page - 1) * pageSize + 1}–{Math.min(page * pageSize, total)} of {total}
            </span>
            <div className="flex gap-2">
              <Button
                asChild
                variant="outline"
                size="sm"
                disabled={page === 1}
              >
                <Link
                  href={{
                    pathname: "/admin/users",
                    query: { ...searchParams, page: Math.max(1, page - 1).toString() }
                  }}
                >
                  Prev
                </Link>
              </Button>
              <Button
                asChild
                variant="outline"
                size="sm"
                disabled={page * pageSize >= total}
              >
                <Link
                  href={{
                    pathname: "/admin/users",
                    query: { ...searchParams, page: (page + 1).toString() }
                  }}
                >
                  Next
                </Link>
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

