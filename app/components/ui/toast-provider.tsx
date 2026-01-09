"use client";

import type { ReactNode } from "react";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState
} from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { CheckCircle2, Info, XCircle } from "lucide-react";
import { cn } from "@/app/lib/utils";

type ToastVariant = "success" | "error" | "info";

interface ToastMessage {
  id: string;
  message: string;
  variant: ToastVariant;
}

interface ToastContextValue {
  addToast: (message: string, variant?: ToastVariant) => void;
}

const ToastContext = createContext<ToastContextValue | null>(null);

export function useToast() {
  const context = useContext(ToastContext);
  if (!context) {
    throw new Error("useToast must be used within ToastProvider");
  }
  return context;
}

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<ToastMessage[]>([]);
  const searchParams = useSearchParams();
  const pathname = usePathname();
  const router = useRouter();

  const addToast = useCallback((message: string, variant: ToastVariant = "info") => {
    const id = `toast-${Date.now()}-${Math.random().toString(16).slice(2)}`;
    setToasts((prev) => [...prev, { id, message, variant }]);
    setTimeout(() => {
      setToasts((prev) => prev.filter((toast) => toast.id !== id));
    }, 4000);
  }, []);

  useEffect(() => {
    const message = searchParams.get("toast");
    if (!message) {
      return;
    }

    const variant = (searchParams.get("toastType") as ToastVariant | null) ?? "success";
    addToast(message, variant);

    const nextParams = new URLSearchParams(searchParams);
    nextParams.delete("toast");
    nextParams.delete("toastType");
    const nextQuery = nextParams.toString();
    router.replace(nextQuery ? `${pathname}?${nextQuery}` : pathname, {
      scroll: false
    });
  }, [addToast, pathname, router, searchParams]);

  const value = useMemo(() => ({ addToast }), [addToast]);

  return (
    <ToastContext.Provider value={value}>
      {children}
      <div
        className="fixed right-6 top-6 z-50 flex w-full max-w-xs flex-col gap-3"
        role="status"
        aria-live="polite"
      >
        {toasts.map((toast) => {
          const icon =
            toast.variant === "success" ? (
              <CheckCircle2 className="h-4 w-4 text-emerald-400" />
            ) : toast.variant === "error" ? (
              <XCircle className="h-4 w-4 text-rose-400" />
            ) : (
              <Info className="h-4 w-4 text-sky-400" />
            );

          return (
            <div
              key={toast.id}
              className={cn(
                "flex items-start gap-3 rounded-lg border border-slate-800 bg-slate-900/95 px-4 py-3 text-sm text-slate-100 shadow-lg backdrop-blur",
                toast.variant === "error" && "border-rose-500/40",
                toast.variant === "success" && "border-emerald-500/40"
              )}
            >
              {icon}
              <p className="flex-1">{toast.message}</p>
            </div>
          );
        })}
      </div>
    </ToastContext.Provider>
  );
}
