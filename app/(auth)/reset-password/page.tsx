import { ResetPasswordForm } from "@/app/components/forms/auth-forms";
import { validatePasswordResetToken } from "@/app/lib/auth/password-reset";

export default async function ResetPasswordPage({
  searchParams
}: {
  searchParams?: { token?: string };
}) {
  const token = searchParams?.token;
  const validation = token ? await validatePasswordResetToken(token) : { valid: false };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-semibold">Set new password</h2>
        <p className="text-sm text-slate-400">Single-use token required.</p>
      </div>
      <ResetPasswordForm token={token} tokenValid={validation.valid} />
    </div>
  );
}
