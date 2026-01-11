"use client";

import * as DropdownMenu from "@radix-ui/react-dropdown-menu";
import Link from "next/link";
import { LogOut, User } from "lucide-react";
import { Button } from "@/app/components/ui/button";

export type SidebarAccountUser = {
  name?: string | null;
  firstName?: string | null;
  lastName?: string | null;
  email?: string | null;
};

type SidebarAccountProps = {
  user: any;
  onLogout: () => void;
  collapsed?: boolean;
};

function initialsForUser(user: SidebarAccountUser) {
  const initialsSource =
    [user.firstName, user.lastName].filter(Boolean).join(" ") || user.name || user.email || "Pilot";
  return initialsSource
    .split(" ")
    .map((part) => part[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();
}

function displayNameForUser(user: SidebarAccountUser) {
  return [user.firstName, user.lastName].filter(Boolean).join(" ") || user.name || user.email || "Pilot";
}

export function SidebarAccount({ user, onLogout, collapsed = false }: SidebarAccountProps) {
  const initials = initialsForUser(user);
  const displayName = displayNameForUser(user);
  const email = user.email || "";

  return (
    <DropdownMenu.Root>
      <DropdownMenu.Trigger asChild>
        <button
          type="button"
          className="flex w-full items-center gap-3 rounded-lg border border-slate-200 bg-white px-3 py-2 text-left transition hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 focus-visible:ring-offset-2 focus-visible:ring-offset-white dark:border-slate-800 dark:bg-slate-950 dark:hover:bg-slate-900 dark:focus-visible:ring-offset-slate-950"
          aria-label="Open account menu"
          title={collapsed && email ? `${displayName} · ${email}` : displayName}
        >
          <div className="flex h-9 w-9 items-center justify-center rounded-full bg-brand-600 text-sm font-semibold text-white shadow-lg shadow-brand-600/20">
            {initials}
          </div>
          {!collapsed ? (
            <div className="min-w-0 flex-1">
              <div className="truncate text-sm font-semibold text-slate-900 dark:text-slate-100">
                {displayName}
              </div>
              <div className="truncate text-xs text-slate-600 dark:text-slate-400">
                {email}
              </div>
            </div>
          ) : null}
        </button>
      </DropdownMenu.Trigger>

      <DropdownMenu.Portal>
        <DropdownMenu.Content
          className="z-50 w-60 rounded-lg border border-slate-200 bg-white p-2 text-sm text-slate-900 shadow-lg dark:border-slate-800 dark:bg-slate-950 dark:text-slate-100"
          side="top"
          align={collapsed ? "center" : "start"}
          sideOffset={10}
          collisionPadding={12}
        >
          <DropdownMenu.Item asChild>
            <Link
              href="/profile"
              className="flex w-full items-center gap-2 rounded-md px-2 py-2 text-sm text-slate-700 outline-none transition hover:bg-slate-100 hover:text-slate-900 dark:text-slate-200 dark:hover:bg-slate-900 dark:hover:text-white"
            >
              <User className="h-4 w-4" />
              Profile
            </Link>
          </DropdownMenu.Item>

          <DropdownMenu.Separator className="my-1 h-px bg-slate-200 dark:bg-slate-800" />

          <DropdownMenu.Item asChild>
            <Button
              variant="ghost"
              className="w-full justify-start text-slate-700 hover:text-slate-900 dark:text-slate-200 dark:hover:text-white"
              onClick={onLogout}
            >
              <LogOut className="mr-2 h-4 w-4" />
              Logout
            </Button>
          </DropdownMenu.Item>
        </DropdownMenu.Content>
      </DropdownMenu.Portal>
    </DropdownMenu.Root>
  );
}

