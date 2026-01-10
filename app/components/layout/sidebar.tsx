"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Plane, ClipboardList, Receipt, Radar, BarChart3, PanelLeftClose, PanelLeftOpen } from "lucide-react";
import { SidebarAccount, SidebarAccountUser } from "@/app/components/layout/sidebar-account";
import { logoutAction } from "@/app/lib/actions/auth-actions";
import { useEffect, useMemo, useState } from "react";

export const navItems = [
  { href: "/dashboard", label: "Dashboard", icon: BarChart3 },
  { href: "/flights", label: "Flights", icon: Radar },
  { href: "/logbook", label: "Logbook", icon: ClipboardList },
  { href: "/costs", label: "Costs", icon: Receipt },
  { href: "/aircraft", label: "Aircraft", icon: Plane }
];

export function Sidebar({ user }: { user: SidebarAccountUser }) {
  // UX-001: persistent left navigation for core modules
  const pathname = usePathname();
  const isChecklistFocus = pathname?.startsWith("/checklists");
  const storageKey = "pilotlog.sidebarCollapsed";
  const [collapsed, setCollapsed] = useState(false);

  useEffect(() => {
    try {
      const raw = window.localStorage.getItem(storageKey);
      if (raw === "1") setCollapsed(true);
      if (raw === "0") setCollapsed(false);
    } catch {
      // ignore
    }
  }, []);

  useEffect(() => {
    try {
      window.localStorage.setItem(storageKey, collapsed ? "1" : "0");
    } catch {
      // ignore
    }
  }, [collapsed]);

  const title = useMemo(() => (collapsed ? "PilotLog" : "Flight training"), [collapsed]);

  if (isChecklistFocus) {
    return null;
  }

  return (
    <aside
      className={[
        "app-sidebar hidden h-screen flex-col border-r border-slate-200 bg-white py-6 dark:border-slate-800 dark:bg-slate-950 lg:flex",
        collapsed ? "w-16 px-2" : "w-64 px-5"
      ].join(" ")}
    >
      <div className={collapsed ? "mb-6 flex items-center justify-center" : "mb-6 space-y-1"}>
        {!collapsed ? (
          <>
            <div className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500 dark:text-slate-400">
              PilotLog
            </div>
            <div className="text-xl font-semibold tracking-tight">{title}</div>
          </>
        ) : (
          <div className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500 dark:text-slate-400">
            PL
          </div>
        )}
      </div>

      <button
        type="button"
        onClick={() => setCollapsed((v) => !v)}
        className={[
          "mb-4 flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 transition hover:bg-slate-50 dark:border-slate-800 dark:bg-slate-950 dark:text-slate-300 dark:hover:bg-slate-900",
          collapsed ? "mx-auto w-12 justify-center px-0" : "w-full"
        ].join(" ")}
        aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
        title={collapsed ? "Expand sidebar" : "Collapse sidebar"}
      >
        {collapsed ? <PanelLeftOpen className="h-4 w-4" /> : <PanelLeftClose className="h-4 w-4" />}
        {!collapsed ? <span>Collapse</span> : null}
      </button>

      <nav className="flex flex-1 flex-col gap-2">
        {navItems.map((item) => {
          const Icon = item.icon;
          const active = pathname === item.href || pathname?.startsWith(`${item.href}/`);
          return (
            <Link
              key={item.href}
              href={item.href}
              className={[
                "flex items-center gap-3 rounded-lg px-3 py-2 text-sm transition",
                collapsed ? "justify-center px-0" : "",
                active
                  ? "bg-slate-100 text-slate-900 dark:bg-slate-900 dark:text-white"
                  : "text-slate-700 hover:bg-slate-100 hover:text-slate-900 dark:text-slate-300 dark:hover:bg-slate-900 dark:hover:text-white"
              ].join(" ")}
              title={collapsed ? item.label : undefined}
            >
              <Icon className="h-4 w-4" />
              {!collapsed ? item.label : null}
            </Link>
          );
        })}
      </nav>
      <div className="mt-6 border-t border-slate-200 pt-4 dark:border-slate-800">
        <SidebarAccount user={user} onLogout={logoutAction} collapsed={collapsed} />
      </div>
    </aside>
  );
}
