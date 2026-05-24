import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import type { JSX, ReactNode } from "react";
import { cn } from "@/lib/utils";

export type ToastVariant = "info" | "success" | "warning" | "error";

export interface Toast {
  id: string;
  title: string;
  description?: string;
  variant?: ToastVariant;
  durationMs?: number;
}

interface ToastApi {
  push: (t: Omit<Toast, "id">) => void;
  dismiss: (id: string) => void;
}

const ToastContext = createContext<ToastApi | null>(null);

export function useToast(): ToastApi {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error("useToast must be used inside <ToastHost>");
  return ctx;
}

const VARIANT_STYLES: Record<ToastVariant, string> = {
  info: "border-border bg-card text-foreground",
  success: "border-emerald-500/40 bg-emerald-500/10 text-foreground",
  warning: "border-amber-500/40 bg-amber-500/10 text-foreground",
  error: "border-destructive/40 bg-destructive/10 text-foreground",
};

export function ToastHost({ children }: { children: ReactNode }): JSX.Element {
  const [toasts, setToasts] = useState<Toast[]>([]);

  const dismiss = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const push = useCallback((t: Omit<Toast, "id">) => {
    const id = window.crypto.randomUUID();
    const next: Toast = { variant: "info", durationMs: 5000, ...t, id };
    setToasts((prev) => [...prev, next]);
  }, []);

  useEffect(() => {
    if (toasts.length === 0) return;
    const timers = toasts.map((t) =>
      window.setTimeout(() => dismiss(t.id), t.durationMs ?? 5000),
    );
    return () => timers.forEach((tm) => window.clearTimeout(tm));
  }, [toasts, dismiss]);

  const api = useMemo<ToastApi>(() => ({ push, dismiss }), [push, dismiss]);

  return (
    <ToastContext.Provider value={api}>
      {children}
      <div className="pointer-events-none fixed bottom-4 right-4 z-50 flex flex-col gap-2">
        {toasts.map((t) => (
          <div
            key={t.id}
            role="status"
            className={cn(
              "pointer-events-auto min-w-[18rem] max-w-sm rounded-md border p-3 shadow-md backdrop-blur",
              VARIANT_STYLES[t.variant ?? "info"],
            )}
          >
            <p className="text-sm font-medium">{t.title}</p>
            {t.description && (
              <p className="mt-1 text-sm text-muted-foreground">{t.description}</p>
            )}
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}
