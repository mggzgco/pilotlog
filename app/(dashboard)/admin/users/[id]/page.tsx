import { notFound } from "next/navigation";
import Link from "next/link";
import { prisma } from "@/app/lib/db";
import { requireAdmin } from "@/app/lib/auth/session";
import { Card, CardContent, CardHeader } from "@/app/components/ui/card";
import { Button } from "@/app/components/ui/button";
import {
  adminForcePasswordResetAction,
  adminResendVerificationAction,
  adminSendApprovalEmailAction,
  adminSendRejectionEmailAction,
  adminSendWelcomeEmailAction
} from "@/app/lib/actions/admin-user-actions";

export default async function AdminUserDetailPage({
  params
}: {
  params: { id: string };
}) {
  await requireAdmin();

  const user = await prisma.user.findUnique({
    where: { id: params.id },
    select: {
      id: true,
      email: true,
      name: true,
      phone: true,
      status: true,
      role: true,
      createdAt: true,
      lastLoginAt: true,
      emailVerifiedAt: true,
      auditEvents: {
        orderBy: { createdAt: "desc" },
        take: 50
      }
    }
  });

  if (!user) {
    notFound();
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h2 className="text-2xl font-semibold">User detail</h2>
          <p className="text-sm text-slate-400">{user.email}</p>
        </div>
        <Button asChild variant="outline">
          <Link href="/admin/users">Back to users</Link>
        </Button>
      </div>

      <Card>
        <CardHeader>
          <p className="text-sm text-slate-400">Account info</p>
        </CardHeader>
        <CardContent className="space-y-2 text-sm text-slate-200">
          <div>Name: {user.name ?? "—"}</div>
          <div>Phone: {user.phone ?? "—"}</div>
          <div>Status: {user.status}</div>
          <div>Role: {user.role}</div>
          <div>Email verified: {user.emailVerifiedAt ? "Yes" : "No"}</div>
          <div>Last login: {user.lastLoginAt ? user.lastLoginAt.toDateString() : "—"}</div>
          <div>Created: {user.createdAt.toDateString()}</div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <p className="text-sm text-slate-400">Lifecycle actions</p>
        </CardHeader>
        <CardContent className="flex flex-wrap gap-2">
          {!user.emailVerifiedAt ? (
            <form action={adminResendVerificationAction}>
              <input type="hidden" name="userId" value={user.id} />
              <Button type="submit" variant="outline">
                Resend verification
              </Button>
            </form>
          ) : null}
          <form action={adminSendApprovalEmailAction}>
            <input type="hidden" name="userId" value={user.id} />
            <Button type="submit" variant="outline">
              Send approval email
            </Button>
          </form>
          <form action={adminSendWelcomeEmailAction}>
            <input type="hidden" name="userId" value={user.id} />
            <Button type="submit" variant="outline">
              Send welcome email
            </Button>
          </form>
          <form action={adminSendRejectionEmailAction}>
            <input type="hidden" name="userId" value={user.id} />
            <Button type="submit" variant="outline">
              Send rejection email
            </Button>
          </form>
          <form action={adminForcePasswordResetAction}>
            <input type="hidden" name="userId" value={user.id} />
            <Button type="submit" variant="outline">
              Force password reset
            </Button>
          </form>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <p className="text-sm text-slate-400">Recent audit events</p>
        </CardHeader>
        <CardContent>
          {user.auditEvents.length === 0 ? (
            <p className="text-sm text-slate-500">No audit events recorded.</p>
          ) : (
            <div className="overflow-hidden rounded-lg border border-slate-800">
              <table className="w-full text-sm">
                <thead className="bg-slate-900 text-xs uppercase text-slate-500">
                  <tr>
                    <th className="px-4 py-3 text-left font-medium">Time</th>
                    <th className="px-4 py-3 text-left font-medium">Type</th>
                    <th className="px-4 py-3 text-left font-medium">IP</th>
                    <th className="px-4 py-3 text-left font-medium">Agent</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800">
                  {user.auditEvents.map((event) => (
                    <tr key={event.id} className="text-slate-200">
                      <td className="px-4 py-3 text-slate-400">
                        {event.createdAt.toISOString()}
                      </td>
                      <td className="px-4 py-3">{event.action}</td>
                      <td className="px-4 py-3 text-slate-400">{event.ipAddress ?? "—"}</td>
                      <td className="px-4 py-3 text-slate-400">
                        {event.userAgent ? event.userAgent.slice(0, 40) : "—"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

