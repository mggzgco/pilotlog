"use client";

import * as DropdownMenu from "@radix-ui/react-dropdown-menu";
import { LogOut } from "lucide-react";
import { Button } from "@/app/components/ui/button";

interface UserMenuProps {
  name: string | null;
  email: string;
  onLogout: () => void;
}

export function UserMenu({ name, email, onLogout }: UserMenuProps) {
  const initials = (name || email)
    .split(" ")
    .map((part) => part[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();

  return (
    <DropdownMenu.Root>
      <DropdownMenu.Trigger asChild>
        <button className="flex h-10 w-10 items-center justify-center rounded-full bg-brand-600 text-sm font-semibold">
          {initials}
        </button>
      </DropdownMenu.Trigger>
      <DropdownMenu.Content
        className="z-50 mt-2 w-56 rounded-lg border border-slate-800 bg-slate-900 p-3 text-sm text-slate-100 shadow-lg"
        align="end"
      >
        <div className="px-2 pb-3">
          <p className="text-sm font-medium">{name ?? "Pilot"}</p>
          <p className="text-xs text-slate-400">{email}</p>
        </div>
        <DropdownMenu.Separator className="my-2 h-px bg-slate-800" />
        <DropdownMenu.Item asChild>
          <Button
            variant="ghost"
            className="w-full justify-start text-slate-200 hover:text-white"
            onClick={onLogout}
          >
            <LogOut className="mr-2 h-4 w-4" />
            Sign out
          </Button>
        </DropdownMenu.Item>
      </DropdownMenu.Content>
    </DropdownMenu.Root>
  );
}
