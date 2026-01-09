import { UserMenu } from "@/app/components/layout/user-menu";
import { logoutAction } from "@/app/lib/actions/auth-actions";

interface TopbarProps {
  user: {
    name: string | null;
    email: string;
  };
}

export function Topbar({ user }: TopbarProps) {
  // UX-002: top header with initials avatar dropdown
  return (
    <header className="flex items-center justify-between border-b border-slate-800 bg-slate-950 px-6 py-4">
      <div>
        <h1 className="text-lg font-semibold">Flight Training Super App</h1>
        <p className="text-sm text-slate-400">Plan, import, and log every flight.</p>
      </div>
      <UserMenu name={user.name} email={user.email} onLogout={logoutAction} />
    </header>
  );
}
