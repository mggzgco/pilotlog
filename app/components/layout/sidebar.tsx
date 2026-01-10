"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Plane, ClipboardList, Receipt, Radar, BarChart3 } from "lucide-react";

export const navItems = [
  { href: "/dashboard", label: "Dashboard", icon: BarChart3 },
  { href: "/flights", label: "Flights", icon: Radar },
  { href: "/logbook", label: "Logbook", icon: ClipboardList },
  { href: "/costs", label: "Costs", icon: Receipt },
  { href: "/aircraft", label: "Aircraft", icon: Plane }
];

export function Sidebar() {
  // UX-001: persistent left navigation for core modules
  const pathname = usePathname();
  const isChecklistFocus = pathname?.startsWith("/checklists");

  if (isChecklistFocus) {
    return null;
  }

  return (
    <aside className="app-sidebar hidden w-64 flex-col border-r border-slate-800 bg-slate-950 p-6 lg:flex">
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
      </nav>
      <div className="text-xs text-slate-500">Secure by Lucia sessions</div>
    </aside>
  );
}
