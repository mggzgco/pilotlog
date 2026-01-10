"use client";

import * as Dialog from "@radix-ui/react-dialog";
import { X } from "lucide-react";
import { Button } from "@/app/components/ui/button";

type CompleteFlightActionProps = {
  label: string;
  title: string;
  description?: string;
  children: React.ReactNode;
};

export function CompleteFlightAction({
  label,
  title,
  description,
  children
}: CompleteFlightActionProps) {
  return (
    <Dialog.Root>
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-slate-800 bg-slate-950/40 px-4 py-3">
        <div>
          <p className="text-sm font-semibold text-slate-100">{label}</p>
          {description ? (
            <p className="text-xs text-slate-400">{description}</p>
          ) : null}
        </div>
        <Dialog.Trigger asChild>
          <Button variant="outline" size="sm">
            Open
          </Button>
        </Dialog.Trigger>
      </div>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-40 bg-slate-950/70 backdrop-blur-sm" />
        <Dialog.Content className="fixed inset-y-0 right-0 z-50 w-full max-w-2xl overflow-y-auto border-l border-slate-800 bg-slate-950 p-6 shadow-xl">
          <div className="flex items-start justify-between gap-4">
            <div>
              <Dialog.Title className="text-lg font-semibold text-slate-100">
                {title}
              </Dialog.Title>
              {description ? (
                <Dialog.Description className="text-sm text-slate-400">
                  {description}
                </Dialog.Description>
              ) : null}
            </div>
            <Dialog.Close asChild>
              <button
                type="button"
                className="rounded-md border border-slate-800 p-2 text-slate-400 transition hover:text-slate-100"
                aria-label={`Close ${label}`}
              >
                <X className="h-4 w-4" />
              </button>
            </Dialog.Close>
          </div>
          <div className="mt-6 space-y-4">{children}</div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
