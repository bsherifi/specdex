import type { JSX, ReactNode } from "react";
import { cn } from "@/lib/utils";

interface FieldProps {
  label: string;
  required?: boolean | undefined;
  error?: string | undefined;
  children: ReactNode;
  className?: string;
}

/**
 * Shared label + control + error wrapper for entry-form fields (DESIGN-SYSTEM
 * §8). Controls inside should set `aria-invalid` when `error` is present so the
 * primitives render their destructive ring.
 */
export function Field({
  label,
  required,
  error,
  children,
  className,
}: FieldProps): JSX.Element {
  return (
    <div className={cn("flex flex-col gap-1.5", className)}>
      <label className="text-sm font-medium">
        {label}
        {required && <span className="ml-0.5 text-destructive">*</span>}
      </label>
      {children}
      {error && <p className="text-xs text-destructive">{error}</p>}
    </div>
  );
}
