import Link from "next/link";
import { Plane, ClipboardList, Receipt, Radar, User2, ShieldCheck } from "lucide-react";

interface SidebarProps {
  user: {
    name: string | null;
    email: string;
    role: "USER" | "ADMIN";
  };
}

const navItems = [
  { href: "/dashboard", label: "Dashboard", icon: Plane },
  { href: "/flights", label: "Flights", icon: Radar },
  { href: "/import", label: "ADS-B Import", icon: ClipboardList },
  { href: "/logbook", label: "Logbook", icon: ClipboardList },
  { href: "/costs", label: "Costs", icon: Receipt },
  { href: "/aircraft", label: "Aircraft", icon: Plane },
  { href: "/profile", label: "Profile", icon: User2 }
];

export function Sidebar({ user }: SidebarProps) {
  // UX-001: persistent left navigation for core modules
  return (
    <aside className="hidden w-64 flex-col border-r border-slate-800 bg-slate-950 p-6 md:flex">
      <div className="mb-8">
        <div className="text-sm uppercase tracking-[0.2em] text-slate-400">Flight Training</div>
        <div className="text-2xl font-semibold">Super App</div>
      </div>
      <nav className="flex flex-1 flex-col gap-2">
        {navItems.map((item) => {
          const Icon = item.icon;
          return (
            <Link
              key={item.href}
              href={item.href}
              className="flex items-center gap-3 rounded-lg px-3 py-2 text-sm text-slate-300 transition hover:bg-slate-800 hover:text-white"
            >
              <Icon className="h-4 w-4" />
              {item.label}
            </Link>
          );
        })}
        {user.role === "ADMIN" && (
          <Link
            href="/admin/approvals"
            className="mt-4 flex items-center gap-3 rounded-lg border border-slate-800 px-3 py-2 text-sm text-slate-200 hover:bg-slate-800"
          >
            <ShieldCheck className="h-4 w-4" />
            Approvals
          </Link>
        )}
      </nav>
      <div className="text-xs text-slate-500">Secure by Lucia sessions</div>
    </aside>
  );
}
