import { ReactNode } from "react";

export default function AuthLayout({ children }: { children: ReactNode }) {
  // UX-003: focused authentication layout
  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-950 p-6">
      <div className="w-full max-w-md rounded-2xl border border-slate-800 bg-slate-900 p-8 shadow-xl">
        <div className="mb-6 text-center">
          <p className="text-xs uppercase tracking-[0.3em] text-slate-400">Flight Training</p>
          <h1 className="text-2xl font-semibold text-white">Super App</h1>
        </div>
        {children}
      </div>
    </div>
  );
}
