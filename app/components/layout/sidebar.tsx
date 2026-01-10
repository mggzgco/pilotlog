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
    <aside className="app-sidebar hidden w-64 flex-col border-r border-slate-200 bg-white px-5 py-6 dark:border-slate-800 dark:bg-slate-950 lg:flex">
      <div className="mb-6 space-y-1">
        <div className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500 dark:text-slate-400">
          PilotLog
        </div>
        <div className="text-xl font-semibold tracking-tight">Flight training</div>
      </div>
      <nav className="flex flex-1 flex-col gap-2">
        {navItems.map((item) => {
          const Icon = item.icon;
          return (
            <Link
              key={item.href}
              href={item.href}
              className="flex items-center gap-3 rounded-lg px-3 py-2 text-sm text-slate-700 transition hover:bg-slate-100 hover:text-slate-900 dark:text-slate-300 dark:hover:bg-slate-900 dark:hover:text-white"
            >
              <Icon className="h-4 w-4" />
              {item.label}
            </Link>
          );
        })}
      </nav>
      <div className="text-xs text-slate-500 dark:text-slate-500">
        Secure sessions
      </div>
    </aside>
  );
}
