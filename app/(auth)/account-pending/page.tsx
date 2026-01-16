import Link from "next/link";
import { Button } from "@/app/components/ui/button";

export default function AccountPendingPage({
  searchParams
}: {
  searchParams?: { toast?: string; toastType?: string };
}) {
  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-semibold">Account pending</h2>
        <p className="text-sm text-slate-600 dark:text-slate-400">
          Check your email to verify your address. Once verified, an admin will
          review and approve your account.
        </p>
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

      <form action="/api/auth/resend-verification" method="post" className="space-y-3">
        <div>
          <label className="text-sm font-medium text-slate-700 dark:text-slate-300">
            Resend verification email
          </label>
          <input
            type="email"
            name="email"
            placeholder="you@example.com"
            className="mt-1 h-10 w-full rounded-md border border-slate-200 bg-white px-3 text-sm text-slate-900 shadow-sm dark:border-slate-800 dark:bg-slate-950 dark:text-slate-100"
          />
        </div>
        <Button type="submit">Resend verification</Button>
      </form>

      <div className="text-sm text-slate-600 dark:text-slate-400">
        <Link href="/login" className="hover:text-slate-900 dark:hover:text-white">
          Back to sign in
        </Link>
      </div>
    </div>
  );
}

