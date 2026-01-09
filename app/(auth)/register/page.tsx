import Link from "next/link";
import { RegisterForm } from "@/app/components/forms/auth-forms";

export default function RegisterPage() {
  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-semibold">Create account</h2>
        <p className="text-sm text-slate-400">Submit for approval to start logging.</p>
      </div>
      <RegisterForm />
      <div className="text-sm text-slate-400">
        Already approved?{" "}
        <Link href="/login" className="text-white hover:underline">
          Sign in
        </Link>
      </div>
    </div>
  );
}
