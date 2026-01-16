import Link from "next/link";

export default function AccountDisabledPage() {
  return (
    <div className="space-y-4">
      <h2 className="text-xl font-semibold">Account disabled</h2>
      <p className="text-sm text-slate-600 dark:text-slate-400">
        Your account has been disabled. Contact support if you believe this is a mistake.
      </p>
      <Link href="/login" className="text-sm text-sky-600 hover:text-sky-700 dark:text-sky-400">
        Back to sign in
      </Link>
    </div>
  );
}

