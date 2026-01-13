import { MobileNav } from "@/app/components/layout/mobile-nav";
import { FlightTraksMarkInverted } from "@/app/components/branding/flighttraks-mark";

interface TopbarProps {
  user: any;
}

export function Topbar({ user }: TopbarProps) {
  // UX-002: top header with initials avatar dropdown
  return (
    <header className="app-topbar sticky top-0 z-40 border-b border-slate-900 bg-slate-950 px-6 py-4 text-slate-100">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <MobileNav user={user} />
          <div className="hidden sm:block">
            <FlightTraksMarkInverted className="h-8 w-8" />
          </div>
          <div>
            <h1 className="text-base font-semibold tracking-tight text-slate-100">FlightTraks</h1>
            <p className="text-sm text-slate-300">
              Plan, import, and log every flight.
            </p>
          </div>
        </div>
      </div>
    </header>
  );
}
