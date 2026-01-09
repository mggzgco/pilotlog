import { UserMenu } from "@/app/components/layout/user-menu";
import { logoutAction } from "@/app/lib/actions/auth-actions";
import { MobileNav } from "@/app/components/layout/mobile-nav";

interface TopbarProps {
  user: {
    name: string | null;
    firstName: string | null;
    lastName: string | null;
    email: string;
    role: "USER" | "ADMIN";
  };
}

export function Topbar({ user }: TopbarProps) {
  // UX-002: top header with initials avatar dropdown
  return (
    <header className="sticky top-0 z-40 border-b border-slate-800 bg-slate-950/95 px-6 py-4 backdrop-blur">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <MobileNav user={user} />
          <div>
            <h1 className="text-lg font-semibold">Flight Training Super App</h1>
            <p className="text-sm text-slate-400">Plan, import, and log every flight.</p>
          </div>
        </div>
        <div className="shrink-0">
          <UserMenu
            name={user.name}
            firstName={user.firstName}
            lastName={user.lastName}
            email={user.email}
            onLogout={logoutAction}
          />
        </div>
      </div>
    </header>
  );
}
