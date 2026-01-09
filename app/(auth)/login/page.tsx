import Link from "next/link";
import { LoginForm } from "@/app/components/forms/auth-forms";

export default function LoginPage({
  searchParams
}: {
  searchParams?: { registered?: string; approved?: string; rejected?: string };
}) {
  // UX-005: clear status messaging on auth screens
  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-semibold">Sign in</h2>
        <p className="text-sm text-slate-400">Access your training dashboard.</p>
      </div>
      {searchParams?.registered && (
        <div className="rounded-lg border border-brand-500/40 bg-brand-500/10 p-3 text-sm text-brand-200">
          Registration received. Await approval.
        </div>
      )}
      {searchParams?.approved && (
        <div className="rounded-lg border border-emerald-500/40 bg-emerald-500/10 p-3 text-sm text-emerald-200">
          Approval complete. You can now sign in.
        </div>
      )}
      {searchParams?.rejected && (
        <div className="rounded-lg border border-rose-500/40 bg-rose-500/10 p-3 text-sm text-rose-200">
          Your registration was rejected. Contact support if this is unexpected.
        </div>
      )}
      <LoginForm />
      <div className="flex items-center justify-between text-sm text-slate-400">
        <Link href="/forgot-password" className="hover:text-white">
          Forgot password?
        </Link>
        <Link href="/register" className="hover:text-white">
          Create account
        </Link>
      </div>
    </div>
  );
}
