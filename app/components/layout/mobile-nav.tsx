"use client";

import * as Dialog from "@radix-ui/react-dialog";
import Link from "next/link";
import { Menu, X } from "lucide-react";
import { navItems } from "@/app/components/layout/sidebar";
import { Button } from "@/app/components/ui/button";
import { usePathname } from "next/navigation";

interface MobileNavProps {
  user: {
    name: string | null;
    email: string;
    role: "USER" | "ADMIN";
  };
}

export function MobileNav({ user }: MobileNavProps) {
  const pathname = usePathname();
  const isChecklistFocus = pathname?.startsWith("/checklists");

  if (isChecklistFocus) {
    return null;
  }

  return (
    <Dialog.Root>
      <Dialog.Trigger asChild>
        <Button
          size="sm"
          variant="outline"
          className="lg:hidden"
          aria-label="Open navigation"
        >
          <Menu className="h-4 w-4" />
        </Button>
      </Dialog.Trigger>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-40 bg-slate-950/70 backdrop-blur-sm" />
        <Dialog.Content className="fixed inset-y-0 left-0 z-50 w-72 overflow-y-auto border-r border-slate-800 bg-slate-950 p-6 shadow-xl">
          <div className="flex items-center justify-between">
            <div>
              <div className="text-xs uppercase tracking-[0.2em] text-slate-400">
                Flight Training
              </div>
              <div className="text-lg font-semibold text-slate-100">Super App</div>
            </div>
            <Dialog.Close asChild>
              <button
                className="rounded-md p-2 text-slate-400 hover:bg-slate-800 hover:text-white"
                aria-label="Close navigation"
              >
                <X className="h-4 w-4" />
              </button>
            </Dialog.Close>
          </div>

          <nav className="mt-6 flex flex-col gap-2">
            {navItems.map((item) => {
              const Icon = item.icon;
              return (
                <Dialog.Close asChild key={item.href}>
                  <Link
                    href={item.href}
                    className="flex items-center gap-3 rounded-lg px-3 py-2 text-sm text-slate-300 transition hover:bg-slate-800 hover:text-white"
                  >
                    <Icon className="h-4 w-4" />
                    {item.label}
                  </Link>
                </Dialog.Close>
              );
            })}
          </nav>

          <div className="mt-8 text-xs text-slate-500">
            Signed in as {user.name ?? user.email}
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
