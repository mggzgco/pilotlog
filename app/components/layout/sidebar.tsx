"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Plane, ClipboardList, Receipt, Radar, BarChart3, Shield, PanelLeftClose, PanelLeftOpen } from "lucide-react";
import { SidebarAccount, SidebarAccountUser } from "@/app/components/layout/sidebar-account";
import { FlightTraksMark } from "@/app/components/branding/flighttraks-mark";
import { logoutAction } from "@/app/lib/actions/auth-actions";
import { useEffect, useMemo, useState } from "react";

export const navItems = [
  { href: "/dashboard", label: "Dashboard", icon: BarChart3 },
  { href: "/flights", label: "Flights", icon: Radar },
  { href: "/logbook", label: "Logbook", icon: ClipboardList },
  { href: "/costs", label: "Costs", icon: Receipt },
  { href: "/aircraft", label: "Aircraft", icon: Plane }
];

const adminNavItems = [{ href: "/admin", label: "Admin", icon: Shield }];

export function Sidebar({ user }: { user: any }) {
  // UX-001: persistent left navigation for core modules
  const pathname = usePathname();
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

  const title = useMemo(() => (collapsed ? "FlightTraks" : "FlightTraks"), [collapsed]);

  return (
    <aside
      className={[
        // Keep nav above maps (Leaflet/Mapbox) which can have aggressive z-index stacking.
        "app-sidebar relative z-[1000] hidden h-dvh flex-col border-r border-slate-200 bg-white py-6 dark:border-slate-800 dark:bg-slate-950 lg:flex",
        collapsed ? "w-16 px-2" : "w-64 px-5"
      ].join(" ")}
    >
      <div className={collapsed ? "mb-6 flex items-center justify-center" : "mb-6"}>
        {collapsed ? (
          <FlightTraksMark className="h-9 w-9" />
        ) : (
          <div className="flex items-center gap-3">
            <FlightTraksMark className="h-9 w-9" />
            <div className="min-w-0">
              <div className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500 dark:text-slate-400">
                FlightTraks
              </div>
              <div className="truncate text-xl font-semibold tracking-tight">{title}</div>
            </div>
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
        {navItems.concat(user?.role === "ADMIN" ? adminNavItems : []).map((item) => {
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
