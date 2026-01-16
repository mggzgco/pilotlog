import Link from "next/link";
import { LoginForm } from "@/app/components/forms/auth-forms";

export default function LoginPage({
  searchParams
}: {
  searchParams?: { registered?: string; approved?: string; rejected?: string; verified?: string };
}) {
  // UX-005: clear status messaging on auth screens
  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-semibold">Sign in</h2>
        <p className="text-sm text-slate-600 dark:text-slate-400">
          Access your training dashboard.
        </p>
      </div>
      {searchParams?.registered && (
        <div className="rounded-lg border border-brand-500/40 bg-brand-500/10 p-3 text-sm text-brand-200">
          Your account request was submitted successfully. You’ll be notified as soon as it’s activated.
        </div>
      )}
      {searchParams?.approved && (
        <div className="rounded-lg border border-emerald-500/40 bg-emerald-500/10 p-3 text-sm text-emerald-200">
          Approval complete. You can now sign in.
        </div>
      )}
      {searchParams?.verified && (
        <div className="rounded-lg border border-sky-500/40 bg-sky-500/10 p-3 text-sm text-sky-200">
          Email verified. Your account is pending approval.
        </div>
      )}
      {searchParams?.rejected && (
        <div className="rounded-lg border border-rose-500/40 bg-rose-500/10 p-3 text-sm text-rose-200">
          Your registration was rejected. Contact support if this is unexpected.
        </div>
      )}
      <LoginForm />
      <div className="flex items-center justify-between text-sm text-slate-600 dark:text-slate-400">
        <Link href="/forgot-password" className="hover:text-slate-900 dark:hover:text-white">
          Forgot password?
        </Link>
        <Link href="/register" className="hover:text-slate-900 dark:hover:text-white">
          Create account
        </Link>
      </div>
    </div>
  );
}
