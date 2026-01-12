"use client";

import * as DropdownMenu from "@radix-ui/react-dropdown-menu";
import Link from "next/link";
import { MoreHorizontal } from "lucide-react";
import { useRouter } from "next/navigation";
import { useToast } from "@/app/components/ui/toast-provider";

type FlightRowMenuProps = {
  flightId: string;
  menuItems: Array<{ label: string; href: string }>;
};

export function FlightRowMenu({ flightId, menuItems }: FlightRowMenuProps) {
  const router = useRouter();
  const { addToast } = useToast();

  return (
    <DropdownMenu.Root>
      <DropdownMenu.Trigger asChild>
        <button
          type="button"
          className="inline-flex items-center justify-center rounded-md border border-slate-200 bg-white p-2 text-slate-700 transition hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 focus-visible:ring-offset-2 focus-visible:ring-offset-white dark:border-slate-800 dark:bg-slate-950 dark:text-slate-200 dark:hover:bg-slate-900 dark:focus-visible:ring-offset-slate-950"
          aria-label="Open flight menu"
        >
          <MoreHorizontal className="h-4 w-4" />
        </button>
      </DropdownMenu.Trigger>
      <DropdownMenu.Portal>
        <DropdownMenu.Content
          className="z-50 min-w-[11rem] rounded-md border border-slate-200 bg-white py-2 text-sm text-slate-900 shadow-lg dark:border-slate-800 dark:bg-slate-950 dark:text-slate-100"
          align="end"
          sideOffset={8}
          collisionPadding={12}
        >
          {menuItems.map((item) => (
            <DropdownMenu.Item key={item.href} asChild>
              <Link
                href={item.href}
                className="block cursor-pointer px-3 py-2 outline-none transition hover:bg-slate-50 dark:hover:bg-slate-900"
              >
                {item.label}
              </Link>
            </DropdownMenu.Item>
          ))}
          <DropdownMenu.Separator className="my-1 h-px bg-slate-200 dark:bg-slate-800" />
          <DropdownMenu.Item
            onSelect={async (event) => {
              event.preventDefault();
              const ok = window.confirm("Delete this flight? This cannot be undone.");
              if (!ok) return;

              try {
                const response = await fetch(`/api/flights/${flightId}/delete`, {
                  method: "POST",
                  headers: { Accept: "application/json" }
                });
                if (!response.ok) {
                  const payload = await response.json().catch(() => ({}));
                  addToast(payload.error ?? "Unable to delete flight.", "error");
                  return;
                }
                addToast("Flight deleted.", "success");
                router.refresh();
              } catch {
                addToast("Unable to delete flight.", "error");
              }
            }}
            className="cursor-pointer px-3 py-2 text-left text-rose-600 outline-none transition hover:bg-rose-50 dark:text-rose-300 dark:hover:bg-rose-500/10"
          >
            Delete flight
          </DropdownMenu.Item>
        </DropdownMenu.Content>
      </DropdownMenu.Portal>
    </DropdownMenu.Root>
  );
}

