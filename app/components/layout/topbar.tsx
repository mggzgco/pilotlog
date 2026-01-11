import { MobileNav } from "@/app/components/layout/mobile-nav";

interface TopbarProps {
  user: any;
}

export function Topbar({ user }: TopbarProps) {
  // UX-002: top header with initials avatar dropdown
  return (
    <header className="app-topbar sticky top-0 z-40 border-b border-slate-200 bg-white/80 px-6 py-4 backdrop-blur dark:border-slate-800 dark:bg-slate-950/80">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <MobileNav user={user} />
          <div>
            <h1 className="text-base font-semibold tracking-tight">PilotLog</h1>
            <p className="text-sm text-slate-600 dark:text-slate-400">
              Plan, import, and log every flight.
            </p>
          </div>
        </div>
      </div>
    </header>
  );
}
