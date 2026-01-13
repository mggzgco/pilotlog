"use client";

import * as Dialog from "@radix-ui/react-dialog";
import { useState } from "react";
import { Button } from "@/app/components/ui/button";

export function ReceiptViewer({
  receiptId,
  filename,
  triggerLabel = "View"
}: {
  receiptId: string;
  filename: string;
  triggerLabel?: string;
}) {
  const [open, setOpen] = useState(false);

  return (
    <Dialog.Root open={open} onOpenChange={setOpen}>
      <Dialog.Trigger asChild>
        <Button type="button" variant="outline" size="sm">
          {triggerLabel}
        </Button>
      </Dialog.Trigger>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-[2000] bg-slate-950/70 backdrop-blur-sm" />
        <Dialog.Content className="fixed inset-4 z-[2010] overflow-hidden rounded-xl border border-slate-200 bg-white shadow-xl dark:border-slate-800 dark:bg-slate-950">
          <div className="flex items-center justify-between gap-3 border-b border-slate-200 px-4 py-3 dark:border-slate-800">
            <div className="min-w-0">
              <p className="truncate text-sm font-semibold text-slate-900 dark:text-slate-100">
                {filename}
              </p>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                In-app viewer
              </p>
            </div>
            <div className="flex items-center gap-2">
              <Button asChild variant="ghost" size="sm">
                <a href={`/api/receipts/${receiptId}/download`}>Download</a>
              </Button>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setOpen(false)}
              >
                Close
              </Button>
            </div>
          </div>
          <iframe
            title={filename}
            src={`/api/receipts/${receiptId}/preview`}
            className="h-[calc(100%-52px)] w-full bg-white dark:bg-slate-950"
          />
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}

