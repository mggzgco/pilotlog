"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Trash2 } from "lucide-react";
import { Button } from "@/app/components/ui/button";
import { useToast } from "@/app/components/ui/toast-provider";

export function FlightDeleteIconButton({
  flightId,
  className
}: {
  flightId: string;
  className?: string;
}) {
  const router = useRouter();
  const { addToast } = useToast();
  const [busy, setBusy] = useState(false);

  const onClick = async () => {
    const ok = window.confirm("Delete this flight? This cannot be undone.");
    if (!ok) return;

    setBusy(true);
    try {
      const response = await fetch(`/api/flights/${encodeURIComponent(flightId)}/delete`, {
        method: "POST",
        headers: { Accept: "application/json" }
      });

      if (!response.ok) {
        const payload = await response.json().catch(() => ({}));
        addToast(payload.error ?? "Unable to delete flight.", "error");
        return;
      }

      // Prefer URL toast so it survives navigation
      router.push(`/flights?toast=${encodeURIComponent("Flight deleted.")}&toastType=success`);
      router.refresh();
    } catch {
      addToast("Unable to delete flight.", "error");
    } finally {
      setBusy(false);
    }
  };

  return (
    <Button
      type="button"
      size="icon"
      variant="ghost"
      title="Delete flight"
      aria-label="Delete flight"
      className={className ?? "hover:bg-rose-500/10"}
      onClick={onClick}
      disabled={busy}
    >
      <Trash2 className="h-4 w-4 text-slate-500 hover:text-rose-600 dark:text-slate-400 dark:hover:text-rose-300" />
    </Button>
  );
}

