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

  const addToast = useCallback((message: string, variant: ToastVariant = "info") => {
    const id = `toast-${Date.now()}-${Math.random().toString(16).slice(2)}`;
    setToasts((prev) => [...prev, { id, message, variant }]);
    setTimeout(() => {
      setToasts((prev) => prev.filter((toast) => toast.id !== id));
    }, 4000);
  }, []);

  useEffect(() => {
    // Avoid next/navigation hooks here to prevent server-side rendering context issues.
    // Read from window after mount and then clean the query string via history API.
    const params = new URLSearchParams(window.location.search);
    const message = params.get("toast");
    if (!message) {
      return;
    }

    const variant = (params.get("toastType") as ToastVariant | null) ?? "success";
    addToast(message, variant);

    const nextParams = new URLSearchParams(params);
    nextParams.delete("toast");
    nextParams.delete("toastType");
    const nextQuery = nextParams.toString();
    const nextUrl = nextQuery ? `${window.location.pathname}?${nextQuery}` : window.location.pathname;
    window.history.replaceState(null, "", nextUrl);
  }, [addToast]);

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
                "flex items-start gap-3 rounded-lg border border-slate-200 bg-white/95 px-4 py-3 text-sm text-slate-900 shadow-lg backdrop-blur dark:border-slate-800 dark:bg-slate-950/95 dark:text-slate-100",
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
