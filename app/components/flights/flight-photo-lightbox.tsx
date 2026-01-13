"use client";

import * as Dialog from "@radix-ui/react-dialog";
import { useEffect, useMemo, useState } from "react";
import { Button } from "@/app/components/ui/button";
import { Trash2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useToast } from "@/app/components/ui/toast-provider";

type Photo = {
  id: string;
  originalFilename: string;
};

export function FlightPhotoLightbox({
  photos
}: {
  photos: Photo[];
}) {
  const [open, setOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(0);

  const active = useMemo(() => photos[activeIndex] ?? null, [photos, activeIndex]);

  useEffect(() => {
    if (!open) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
      if (e.key === "ArrowLeft") setActiveIndex((i) => (i - 1 + photos.length) % photos.length);
      if (e.key === "ArrowRight") setActiveIndex((i) => (i + 1) % photos.length);
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [open, photos.length]);

  if (photos.length === 0) return null;

  return (
    <Dialog.Root open={open} onOpenChange={setOpen}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-[2000] bg-black/80 backdrop-blur-sm" />
        <Dialog.Content className="fixed inset-4 z-[2010] overflow-hidden rounded-xl border border-slate-800 bg-slate-950 shadow-xl">
          <div className="flex items-center justify-between gap-3 border-b border-slate-800 px-4 py-3">
            <div className="min-w-0">
              <p className="truncate text-sm font-semibold text-slate-100">
                {active?.originalFilename ?? "Photo"}
              </p>
              <p className="text-xs text-slate-400">
                {activeIndex + 1} / {photos.length} · Use ← / → to navigate
              </p>
            </div>
            <div className="flex items-center gap-2">
              {active ? (
                <Button asChild variant="ghost" size="sm">
                  <a href={`/api/receipts/${active.id}/download`}>Download</a>
                </Button>
              ) : null}
              <Button type="button" variant="outline" size="sm" onClick={() => setOpen(false)}>
                Close
              </Button>
            </div>
          </div>
          <div className="flex h-[calc(100%-52px)] items-center justify-center bg-black">
            {active ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={`/api/receipts/${active.id}/preview`}
                alt={active.originalFilename}
                className="max-h-full max-w-full object-contain"
              />
            ) : null}
          </div>
          <div className="absolute left-4 top-1/2 -translate-y-1/2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setActiveIndex((i) => (i - 1 + photos.length) % photos.length)}
            >
              Prev
            </Button>
          </div>
          <div className="absolute right-4 top-1/2 -translate-y-1/2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setActiveIndex((i) => (i + 1) % photos.length)}
            >
              Next
            </Button>
          </div>
        </Dialog.Content>
      </Dialog.Portal>

      {/* Hidden trigger, we open programmatically from thumbnails */}
      <Dialog.Trigger asChild>
        <button type="button" className="hidden" />
      </Dialog.Trigger>
    </Dialog.Root>
  );
}

export function FlightPhotoThumbGrid({
  photos
}: {
  photos: Photo[];
}) {
  const [lightboxOpen, setLightboxOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(0);
  const router = useRouter();
  const { addToast } = useToast();

  if (photos.length === 0) return null;

  return (
    <>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
        {photos.map((photo, idx) => (
          <button
            key={photo.id}
            type="button"
            className="group relative overflow-hidden rounded-xl border border-slate-800 bg-slate-950/40"
            onClick={() => {
              setActiveIndex(idx);
              setLightboxOpen(true);
            }}
            aria-label={`View ${photo.originalFilename}`}
          >
            <span className="absolute right-2 top-2 z-10 opacity-0 transition group-hover:opacity-100 group-focus-visible:opacity-100">
              <span
                role="button"
                tabIndex={0}
                className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-slate-700 bg-slate-950/80 text-slate-100 shadow-sm backdrop-blur hover:bg-slate-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500"
                onClick={async (e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  if (!window.confirm(`Delete "${photo.originalFilename}"?`)) return;
                  try {
                    const res = await fetch(`/api/receipts/${photo.id}/delete`, {
                      method: "POST",
                      headers: { Accept: "application/json" }
                    });
                    const data = (await res.json().catch(() => null)) as
                      | { ok?: boolean; error?: string }
                      | null;
                    if (!res.ok || !data?.ok) {
                      addToast(data?.error ?? "Failed to delete photo.", "error");
                      return;
                    }
                    addToast("Photo deleted.", "success");
                    router.refresh();
                  } catch {
                    addToast("Failed to delete photo.", "error");
                  }
                }}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === " ") {
                    e.preventDefault();
                    e.currentTarget.click();
                  }
                }}
                aria-label={`Delete ${photo.originalFilename}`}
              >
                <Trash2 className="h-4 w-4" />
              </span>
            </span>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={`/api/receipts/${photo.id}/preview`}
              alt={photo.originalFilename}
              className="h-40 w-full object-cover transition group-hover:scale-[1.02]"
            />
          </button>
        ))}
      </div>

      <Dialog.Root open={lightboxOpen} onOpenChange={setLightboxOpen}>
        <Dialog.Portal>
          <Dialog.Overlay className="fixed inset-0 z-[2000] bg-black/80 backdrop-blur-sm" />
          <Dialog.Content className="fixed inset-4 z-[2010] overflow-hidden rounded-xl border border-slate-800 bg-slate-950 shadow-xl">
            <div className="flex items-center justify-between gap-3 border-b border-slate-800 px-4 py-3">
              <div className="min-w-0">
                <p className="truncate text-sm font-semibold text-slate-100">
                  {photos[activeIndex]?.originalFilename ?? "Photo"}
                </p>
                <p className="text-xs text-slate-400">
                  {activeIndex + 1} / {photos.length} · Use ← / → to navigate
                </p>
              </div>
              <div className="flex items-center gap-2">
                <Button asChild variant="ghost" size="sm">
                  <a href={`/api/receipts/${photos[activeIndex]?.id}/download`}>Download</a>
                </Button>
                <Button type="button" variant="outline" size="sm" onClick={() => setLightboxOpen(false)}>
                  Close
                </Button>
              </div>
            </div>
            <LightboxBody
              photos={photos}
              activeIndex={activeIndex}
              setActiveIndex={setActiveIndex}
            />
          </Dialog.Content>
        </Dialog.Portal>
      </Dialog.Root>
    </>
  );
}

function LightboxBody({
  photos,
  activeIndex,
  setActiveIndex
}: {
  photos: Photo[];
  activeIndex: number;
  setActiveIndex: (idx: number | ((prev: number) => number)) => void;
}) {
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "ArrowLeft") setActiveIndex((i) => (i - 1 + photos.length) % photos.length);
      if (e.key === "ArrowRight") setActiveIndex((i) => (i + 1) % photos.length);
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [photos.length, setActiveIndex]);

  const active = photos[activeIndex];
  return (
    <div className="relative flex h-[calc(100%-52px)] items-center justify-center bg-black">
      {active ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={`/api/receipts/${active.id}/preview`}
          alt={active.originalFilename}
          className="max-h-full max-w-full object-contain"
        />
      ) : null}
      <div className="absolute left-4 top-1/2 -translate-y-1/2">
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => setActiveIndex((i) => (i - 1 + photos.length) % photos.length)}
        >
          Prev
        </Button>
      </div>
      <div className="absolute right-4 top-1/2 -translate-y-1/2">
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => setActiveIndex((i) => (i + 1) % photos.length)}
        >
          Next
        </Button>
      </div>
    </div>
  );
}

