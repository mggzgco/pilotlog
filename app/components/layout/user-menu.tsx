"use client";

import * as DropdownMenu from "@radix-ui/react-dropdown-menu";
import Link from "next/link";
import { LogOut, User } from "lucide-react";
import { Button } from "@/app/components/ui/button";

interface UserMenuProps {
  firstName: string | null;
  lastName: string | null;
  name: string | null;
  email: string;
  onLogout: () => void;
}

export function UserMenu({ firstName, lastName, name, email, onLogout }: UserMenuProps) {
  const displayName = [firstName, lastName].filter(Boolean).join(" ") || name || "Pilot";
  const initialsSource = [firstName, lastName].filter(Boolean).join(" ") || name || email;
  const initials = initialsSource
    .split(" ")
    .map((part) => part[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();

  return (
    <DropdownMenu.Root>
      <DropdownMenu.Trigger asChild>
        <button
          className="flex h-10 w-10 items-center justify-center rounded-full bg-brand-600 text-sm font-semibold shadow-lg shadow-brand-600/30 transition hover:brightness-110 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-400"
          aria-label="Open user menu"
        >
          {initials}
        </button>
      </DropdownMenu.Trigger>
      <DropdownMenu.Portal>
        <DropdownMenu.Content
          className="z-50 mt-2 w-56 rounded-lg border border-slate-800 bg-slate-900 p-3 text-sm text-slate-100 shadow-lg"
          align="end"
          sideOffset={8}
          collisionPadding={12}
        >
          <div className="px-2 pb-3">
            <p className="text-sm font-medium">{displayName}</p>
            <p className="text-xs text-slate-400">{email}</p>
          </div>
          <DropdownMenu.Separator className="my-2 h-px bg-slate-800" />
          <DropdownMenu.Item asChild>
            <Link
              href="/profile"
              className="flex w-full items-center gap-2 rounded-md px-2 py-2 text-sm text-slate-200 outline-none transition hover:bg-slate-800 hover:text-white"
            >
              <User className="h-4 w-4" />
              Profile
            </Link>
          </DropdownMenu.Item>
          <DropdownMenu.Item asChild>
            <Button
              variant="ghost"
              className="w-full justify-start text-slate-200 hover:text-white"
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
