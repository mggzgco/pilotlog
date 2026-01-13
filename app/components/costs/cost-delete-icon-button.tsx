"use client";

import type { FormEvent } from "react";
import { Trash2 } from "lucide-react";
import { Button } from "@/app/components/ui/button";

export function CostDeleteIconButton({
  costId,
  confirmMessage = "Delete this expense?"
}: {
  costId: string;
  confirmMessage?: string;
}) {
  const onSubmit = (event: FormEvent<HTMLFormElement>) => {
    if (!confirm(confirmMessage)) {
      event.preventDefault();
    }
  };

  return (
    <form action={`/api/costs/${costId}/delete`} method="post" onSubmit={onSubmit}>
      <Button
        type="submit"
        variant="ghost"
        size="icon"
        aria-label="Delete expense"
        title="Delete"
        className="hover:bg-rose-500/10"
      >
        <Trash2 className="h-4 w-4 text-slate-500 hover:text-rose-600 dark:text-slate-400 dark:hover:text-rose-300" />
      </Button>
    </form>
  );
}

