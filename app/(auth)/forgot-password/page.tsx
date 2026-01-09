import { ForgotPasswordForm } from "@/app/components/forms/auth-forms";

export default function ForgotPasswordPage() {
  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-semibold">Reset password</h2>
        <p className="text-sm text-slate-400">We'll email a reset link.</p>
      </div>
      <ForgotPasswordForm />
    </div>
  );
}
