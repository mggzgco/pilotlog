import Link from "next/link";
import { prisma } from "@/app/lib/db";
import { requireAdmin } from "@/app/lib/auth/session";
import { Card, CardContent, CardHeader } from "@/app/components/ui/card";
import { Button } from "@/app/components/ui/button";
import { Input } from "@/app/components/ui/input";
import { formatDateTime24 } from "@/app/lib/utils";

export default async function AdminAuditPage({
  searchParams
}: {
  searchParams?: { q?: string; action?: string; page?: string };
}) {
  await requireAdmin();

  const query = searchParams?.q?.trim();
  const actionFilter = searchParams?.action?.trim();
  const page = Math.max(1, Number(searchParams?.page ?? 1) || 1);
  const pageSize = 50;

  const where: Record<string, unknown> = {};
  if (actionFilter) {
    where.action = { contains: actionFilter, mode: "insensitive" };
  }
  if (query) {
    where.OR = [
      { entityId: { contains: query, mode: "insensitive" } },
      { user: { is: { email: { contains: query, mode: "insensitive" } } } },
      { user: { is: { name: { contains: query, mode: "insensitive" } } } }
    ];
  }

  const [events, total] = await Promise.all([
    prisma.auditEvent.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * pageSize,
      take: pageSize,
      include: {
        user: { select: { email: true, name: true } }
      }
    }),
    prisma.auditEvent.count({ where })
  ]);

  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <h2 className="text-2xl font-semibold">Audit log</h2>
        <p className="text-sm text-slate-400">
          Monitor admin and authentication events across the system.
        </p>
      </div>

      <Card>
        <CardHeader>
          <p className="text-sm text-slate-400">Filters</p>
        </CardHeader>
        <CardContent>
          <form className="flex flex-wrap items-end gap-3" method="get">
            <div className="space-y-1">
              <label className="text-xs uppercase text-slate-500">Search</label>
              <Input name="q" defaultValue={query} placeholder="User email, name, entity id" />
            </div>
            <div className="space-y-1">
              <label className="text-xs uppercase text-slate-500">Action</label>
              <Input name="action" defaultValue={actionFilter} placeholder="AUTH_APPROVED" />
            </div>
            <Button type="submit" variant="outline" size="sm">
              Apply
            </Button>
          </form>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <p className="text-sm text-slate-400">Events</p>
        </CardHeader>
        <CardContent>
          <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-950/40">
            <table className="w-full text-sm">
              <thead className="bg-slate-50 text-xs font-semibold uppercase text-slate-500 dark:bg-slate-900/60 dark:text-slate-400">
                <tr>
                  <th className="px-4 py-3 text-left font-medium">Time</th>
                  <th className="px-4 py-3 text-left font-medium">Action</th>
                  <th className="px-4 py-3 text-left font-medium">User</th>
                  <th className="px-4 py-3 text-left font-medium">Entity</th>
                  <th className="px-4 py-3 text-left font-medium">IP</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 dark:divide-slate-800">
                {events.length === 0 ? (
                  <tr>
                    <td className="px-4 py-4 text-slate-400" colSpan={5}>
                      No audit events found.
                    </td>
                  </tr>
                ) : (
                  events.map((event) => (
                    <tr key={event.id} className="text-slate-200">
                      <td className="px-4 py-3 text-slate-400">
                        {formatDateTime24(new Date(event.createdAt))}
                      </td>
                      <td className="px-4 py-3">{event.action}</td>
                      <td className="px-4 py-3 text-slate-400">
                        {event.user?.email ?? "System"}
                      </td>
                      <td className="px-4 py-3 text-slate-400">
                        {event.entityType ? `${event.entityType}:${event.entityId ?? "—"}` : "—"}
                      </td>
                      <td className="px-4 py-3 text-slate-400">{event.ipAddress ?? "—"}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
          <div className="mt-4 flex items-center justify-between text-sm text-slate-500">
            <span>
              Showing {(page - 1) * pageSize + 1}–{Math.min(page * pageSize, total)} of {total}
            </span>
            <div className="flex gap-2">
              <Button asChild variant="outline" size="sm" disabled={page === 1}>
                <Link
                  href={{
                    pathname: "/admin/audit",
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
                    pathname: "/admin/audit",
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
