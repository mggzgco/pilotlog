import { notFound } from "next/navigation";
import Link from "next/link";
import { prisma } from "@/app/lib/db";
import { requireAdmin } from "@/app/lib/auth/session";
import { Card, CardContent, CardHeader } from "@/app/components/ui/card";
import { Button } from "@/app/components/ui/button";
import { Input } from "@/app/components/ui/input";
import { FormSubmitButton } from "@/app/components/ui/form-submit-button";
import {
  adminCompleteOnboardingAction,
  adminGeneratePasswordResetLinkAction,
  adminGenerateVerificationLinkAction,
  adminForcePasswordResetAction,
  adminMarkEmailVerifiedAction,
  adminResendVerificationAction,
  adminSendApprovalEmailAction,
  adminSendRejectionEmailAction,
  adminSendWelcomeEmailAction,
  adminUpdateUserProfileAction
} from "@/app/lib/actions/admin-user-actions";

export default async function AdminUserDetailPage({
  params,
  searchParams
}: {
  params: { id: string };
  searchParams?: { manualLinkType?: string; manualLink?: string };
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
        deletedAt: true,
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
          <div>Deleted: {user.deletedAt ? user.deletedAt.toDateString() : "No"}</div>
          <div>Last login: {user.lastLoginAt ? user.lastLoginAt.toDateString() : "—"}</div>
          <div>Created: {user.createdAt.toDateString()}</div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <p className="text-sm text-slate-400">Edit profile</p>
        </CardHeader>
        <CardContent>
          <form action={adminUpdateUserProfileAction} className="grid gap-4 sm:grid-cols-2">
            <input type="hidden" name="userId" value={user.id} />
            <div className="space-y-1">
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
                Email
              </p>
              <Input name="email" type="email" required defaultValue={user.email} />
            </div>
            <div className="space-y-1">
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
                Name
              </p>
              <Input name="name" defaultValue={user.name ?? ""} />
            </div>
            <div className="space-y-1">
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
                Phone
              </p>
              <Input name="phone" defaultValue={user.phone ?? ""} />
            </div>
            <div className="space-y-1">
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
                Role
              </p>
              <select
                name="role"
                defaultValue={user.role}
                className="h-11 w-full rounded-md border border-slate-200 bg-white px-3 text-sm text-slate-900 shadow-sm dark:border-slate-800 dark:bg-slate-950 dark:text-slate-100"
              >
                <option value="USER">User</option>
                <option value="ADMIN">Admin</option>
              </select>
            </div>
            <div className="space-y-1">
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
                Status
              </p>
              <select
                name="status"
                defaultValue={user.status}
                className="h-11 w-full rounded-md border border-slate-200 bg-white px-3 text-sm text-slate-900 shadow-sm dark:border-slate-800 dark:bg-slate-950 dark:text-slate-100"
              >
                <option value="PENDING">Pending</option>
                <option value="ACTIVE">Active</option>
                <option value="DISABLED">Disabled</option>
              </select>
            </div>
            <div className="flex items-center gap-2 pt-6 text-sm text-slate-600 dark:text-slate-400">
              <input
                id="verified"
                name="verified"
                value="true"
                type="checkbox"
                className="h-4 w-4"
                defaultChecked={Boolean(user.emailVerifiedAt)}
              />
              <label htmlFor="verified">Email verified</label>
            </div>
            <div className="space-y-1 sm:col-span-2">
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
                Admin note (optional)
              </p>
              <Input name="reason" placeholder="Reason for changes" />
            </div>
            <div className="sm:col-span-2 flex justify-end">
              <FormSubmitButton pendingText="Saving...">Save changes</FormSubmitButton>
            </div>
          </form>
        </CardContent>
      </Card>

      {searchParams?.manualLink ? (
        <Card>
          <CardHeader>
            <p className="text-sm text-slate-400">Manual link</p>
          </CardHeader>
          <CardContent className="space-y-3 text-sm text-slate-200">
            <p className="text-slate-400">
              Share this {searchParams.manualLinkType ?? "manual"} link with the user.
            </p>
            <Input value={decodeURIComponent(searchParams.manualLink)} readOnly />
            <p className="text-xs text-slate-500">
              For security, treat this link like a password reset. It is visible only to admins.
            </p>
          </CardContent>
        </Card>
      ) : null}

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
          <p className="text-sm text-slate-400">Manual onboarding</p>
        </CardHeader>
        <CardContent className="flex flex-wrap gap-2">
          <form action={adminMarkEmailVerifiedAction}>
            <input type="hidden" name="userId" value={user.id} />
            <Input name="reason" placeholder="Reason" className="mb-2 h-9 w-48" />
            <Button type="submit" variant="outline">
              Mark email verified
            </Button>
          </form>
          <form action={adminCompleteOnboardingAction}>
            <input type="hidden" name="userId" value={user.id} />
            <Input name="reason" placeholder="Reason" className="mb-2 h-9 w-48" />
            <Button type="submit" variant="outline">
              Complete onboarding
            </Button>
          </form>
          <form action={adminGenerateVerificationLinkAction}>
            <input type="hidden" name="userId" value={user.id} />
            <Input name="reason" placeholder="Reason" className="mb-2 h-9 w-48" />
            <Button type="submit" variant="outline">
              Generate verification link
            </Button>
          </form>
          <form action={adminGeneratePasswordResetLinkAction}>
            <input type="hidden" name="userId" value={user.id} />
            <Input name="reason" placeholder="Reason" className="mb-2 h-9 w-48" />
            <Button type="submit" variant="outline">
              Generate reset link
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

