"use client";

import * as Dialog from "@radix-ui/react-dialog";
import { useEffect, useMemo, useState } from "react";
import { Share2, X } from "lucide-react";
import { Button } from "@/app/components/ui/button";
import { useToast } from "@/app/components/ui/toast-provider";

type SharePayload = {
  shareUrl: string;
  imageUrl: string;
  defaultText: string;
  composerUrl: string;
  x: {
    configured: boolean;
    connected: boolean;
    username: string | null;
    connectUrl: string;
  };
};

export function ShareToXButton({ flightId }: { flightId: string }) {
  const { addToast } = useToast();
  const [open, setOpen] = useState(false);
  const [payload, setPayload] = useState<SharePayload | null>(null);
  const [text, setText] = useState("");
  const [loading, setLoading] = useState(false);
  const [posting, setPosting] = useState(false);

  useEffect(() => {
    if (!open) return;
    setLoading(true);
    fetch(`/api/flights/${encodeURIComponent(flightId)}/share`, {
      headers: { accept: "application/json" }
    })
      .then((r) => r.json())
      .then((json) => {
        if (json?.error) throw new Error(json.error);
        setPayload(json as SharePayload);
        setText((json as SharePayload).defaultText ?? "");
      })
      .catch((e) => {
        addToast(e?.message ?? "Failed to prepare share.", "error");
        setOpen(false);
      })
      .finally(() => setLoading(false));
  }, [open, flightId, addToast]);

  const canPostDirectly = Boolean(payload?.x.configured && payload?.x.connected);

  const onPost = async () => {
    if (!payload) return;
    setPosting(true);
    try {
      const res = await fetch("/api/integrations/x/post", {
        method: "POST",
        headers: { "content-type": "application/json", accept: "application/json" },
        body: JSON.stringify({ text })
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.error ?? "Failed to post to X.");
      addToast("Posted to X.", "success");
      setOpen(false);
    } catch (e: any) {
      addToast(e?.message ?? "Failed to post to X.", "error");
    } finally {
      setPosting(false);
    }
  };

  const composerHref = useMemo(() => payload?.composerUrl ?? "#", [payload]);

  return (
    <Dialog.Root open={open} onOpenChange={setOpen}>
      <Dialog.Trigger asChild>
        <Button size="icon" variant="ghost" title="Share to X" aria-label="Share to X">
          <Share2 className="h-4 w-4" />
        </Button>
      </Dialog.Trigger>

      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-[2000] bg-slate-950/70 backdrop-blur-sm" />
        <Dialog.Content className="fixed left-[50%] top-[50%] z-[2010] w-[95vw] max-w-3xl -translate-x-[50%] -translate-y-[50%] overflow-hidden rounded-xl border border-slate-200 bg-white shadow-xl dark:border-slate-800 dark:bg-slate-950">
          <div className="flex items-center justify-between gap-3 border-b border-slate-200 px-4 py-3 dark:border-slate-800">
            <div className="min-w-0">
              <Dialog.Title className="truncate text-sm font-semibold text-slate-900 dark:text-slate-100">
                Share flight to X
              </Dialog.Title>
              <Dialog.Description className="text-xs text-slate-500 dark:text-slate-400">
                Posts a link that renders a large-image card in X.
              </Dialog.Description>
            </div>
            <div className="flex items-center gap-2">
              <Button type="button" variant="outline" size="sm" onClick={() => setOpen(false)}>
                Close
              </Button>
            </div>
          </div>

          {loading || !payload ? (
            <div className="p-6 text-sm text-slate-600 dark:text-slate-400">Preparing share…</div>
          ) : (
            <div className="grid gap-4 p-4 lg:grid-cols-2">
              <div className="space-y-3">
                <div className="overflow-hidden rounded-xl border border-slate-200 dark:border-slate-800">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={payload.imageUrl} alt="Share card" className="w-full" />
                </div>
                <div className="text-xs text-slate-500 dark:text-slate-400">
                  Share link:{" "}
                  <a className="underline" href={payload.shareUrl} target="_blank" rel="noreferrer">
                    {payload.shareUrl}
                  </a>
                </div>
              </div>

              <div className="space-y-3">
                <div>
                  <label className="text-xs font-semibold text-slate-600 dark:text-slate-400">
                    Post text (editable)
                  </label>
                  <textarea
                    className="mt-1 h-44 w-full rounded-lg border border-slate-200 bg-white p-3 text-sm text-slate-900 shadow-sm outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-500/30 dark:border-slate-800 dark:bg-slate-950 dark:text-slate-100"
                    value={text}
                    onChange={(e) => setText(e.target.value)}
                  />
                </div>

                <div className="flex flex-wrap items-center justify-end gap-2">
                  <Button asChild variant="outline">
                    <a href={composerHref} target="_blank" rel="noreferrer">
                      Open X composer
                    </a>
                  </Button>

                  {payload.x.configured && !payload.x.connected ? (
                    <Button asChild>
                      <a href={payload.x.connectUrl}>
                        <X className="mr-2 h-4 w-4" />
                        Connect X
                      </a>
                    </Button>
                  ) : null}

                  <Button onClick={onPost} disabled={!canPostDirectly || posting}>
                    {posting ? "Posting…" : "Post to X"}
                  </Button>
                </div>

                {!payload.x.configured ? (
                  <p className="text-xs text-amber-600 dark:text-amber-300">
                    X OAuth is not configured on the server. You can still use “Open X composer”.
                  </p>
                ) : !payload.x.connected ? (
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    Connect your X account to post directly from FlightTraks.
                  </p>
                ) : (
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    Connected as @{payload.x.username ?? "your account"}.
                  </p>
                )}
              </div>
            </div>
          )}
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}

