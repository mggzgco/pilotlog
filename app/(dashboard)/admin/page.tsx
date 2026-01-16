import Link from "next/link";
import { requireAdmin } from "@/app/lib/auth/session";
import { Card, CardContent, CardHeader } from "@/app/components/ui/card";
import { Button } from "@/app/components/ui/button";
import { checkMailerStatus } from "@/app/lib/email/mailer";

export default async function AdminHomePage() {
  await requireAdmin();
  const mailerStatus = await checkMailerStatus();

  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <h2 className="text-2xl font-semibold">Administration</h2>
        <p className="text-sm text-slate-400">
          Manage users, approvals, and global checklists.
        </p>
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <Card>
          <CardHeader>
            <p className="text-sm text-slate-400">User approvals</p>
          </CardHeader>
          <CardContent className="space-y-3">
            <p className="text-sm text-slate-500">
              Review new signups before they can log in.
            </p>
            <Button asChild>
              <Link href="/admin/approvals">Open approvals</Link>
            </Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <p className="text-sm text-slate-400">User management</p>
          </CardHeader>
          <CardContent className="space-y-3">
            <p className="text-sm text-slate-500">
              Update roles, force password resets, and delete users.
            </p>
            <Button asChild>
              <Link href="/admin/users">Manage users</Link>
            </Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <p className="text-sm text-slate-400">Global checklists</p>
          </CardHeader>
          <CardContent className="space-y-3">
            <p className="text-sm text-slate-500">
              Create templates available to all users.
            </p>
            <Button asChild>
              <Link href="/admin/checklists">Manage global templates</Link>
            </Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <p className="text-sm text-slate-400">Email templates</p>
          </CardHeader>
          <CardContent className="space-y-3">
            <p className="text-sm text-slate-500">
              Preview lifecycle emails and verify formatting.
            </p>
            <Button asChild>
              <Link href="/admin/email-templates">View templates</Link>
            </Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <p className="text-sm text-slate-400">Audit log</p>
          </CardHeader>
          <CardContent className="space-y-3">
            <p className="text-sm text-slate-500">
              Review admin actions, approvals, and authentication activity.
            </p>
            <Button asChild>
              <Link href="/admin/audit">View audit log</Link>
            </Button>
          </CardContent>
        </Card>
      </div>

      {!mailerStatus.ok ? (
        <div className="rounded-lg border border-rose-500/40 bg-rose-50 p-3 text-sm text-rose-800 dark:bg-rose-500/10 dark:text-rose-200">
          Mailer warning: {mailerStatus.error ?? "Mailer verification failed."} Emails will not send
          until SMTP credentials are fixed.
        </div>
      ) : null}
    </div>
  );
}

