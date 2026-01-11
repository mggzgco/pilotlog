import { ReactNode } from "react";
import { FlightTraksMark } from "@/app/components/branding/flighttraks-mark";

export default function AuthLayout({ children }: { children: ReactNode }) {
  // UX-003: focused authentication layout
  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-50 p-6 dark:bg-slate-950">
      <div className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-8 shadow-xl shadow-slate-200/40 dark:border-slate-800 dark:bg-slate-950 dark:shadow-slate-950/30">
        <div className="mb-6 text-center">
          <div className="mx-auto mb-3 flex justify-center">
            <FlightTraksMark className="h-12 w-12" />
          </div>
          <p className="text-xs font-semibold uppercase tracking-[0.25em] text-slate-500 dark:text-slate-400">
            FlightTraks
          </p>
          <h1 className="text-2xl font-semibold tracking-tight">Welcome</h1>
        </div>
        {children}
      </div>
    </div>
  );
}
