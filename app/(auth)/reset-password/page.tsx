import { ResetPasswordForm } from "@/app/components/forms/auth-forms";

export default function ResetPasswordPage({
  searchParams
}: {
  searchParams?: { token?: string };
}) {
  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-semibold">Set new password</h2>
        <p className="text-sm text-slate-400">Single-use token required.</p>
      </div>
      <ResetPasswordForm token={searchParams?.token} />
    </div>
  );
}
