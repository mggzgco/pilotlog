"use client";

import * as Dialog from "@radix-ui/react-dialog";
import Link from "next/link";
import { Menu, X } from "lucide-react";
import { navItems } from "@/app/components/layout/sidebar";
import { Button } from "@/app/components/ui/button";
import { usePathname } from "next/navigation";
import { SidebarAccount } from "@/app/components/layout/sidebar-account";
import { logoutAction } from "@/app/lib/actions/auth-actions";

interface MobileNavProps {
  user: {
    name: string | null;
    firstName?: string | null;
    lastName?: string | null;
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
        <Dialog.Overlay className="fixed inset-0 z-40 bg-slate-950/30 backdrop-blur-sm dark:bg-slate-950/70" />
        <Dialog.Content className="fixed inset-y-0 left-0 z-50 w-72 overflow-y-auto border-r border-slate-200 bg-white p-6 shadow-xl dark:border-slate-800 dark:bg-slate-950">
          <div className="flex items-center justify-between">
            <div>
              <div className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500 dark:text-slate-400">
                PilotLog
              </div>
              <div className="text-lg font-semibold tracking-tight">Flight training</div>
            </div>
            <Dialog.Close asChild>
              <button
                className="rounded-md p-2 text-slate-600 transition hover:bg-slate-100 hover:text-slate-900 dark:text-slate-400 dark:hover:bg-slate-900 dark:hover:text-white"
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
                    className="flex items-center gap-3 rounded-lg px-3 py-2 text-sm text-slate-700 transition hover:bg-slate-100 hover:text-slate-900 dark:text-slate-300 dark:hover:bg-slate-900 dark:hover:text-white"
                  >
                    <Icon className="h-4 w-4" />
                    {item.label}
                  </Link>
                </Dialog.Close>
              );
            })}
          </nav>

          <div className="mt-8 border-t border-slate-200 pt-4 dark:border-slate-800">
            <SidebarAccount
              user={{
                name: user.name ?? null,
                firstName: (user as any).firstName ?? null,
                lastName: (user as any).lastName ?? null,
                email: user.email
              }}
              onLogout={logoutAction}
            />
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
