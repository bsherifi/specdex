import type { JSX } from "react";
import { useEffect, useState } from "react";
import { useTheme } from "next-themes";
import { Monitor, Moon, Sun } from "lucide-react";

const OPTIONS = [
  { value: "light", label: "Light", icon: Sun },
  { value: "dark", label: "Dark", icon: Moon },
  { value: "system", label: "System", icon: Monitor },
] as const;

/**
 * Segmented Light / Dark / System control backed by next-themes. Renders a
 * neutral placeholder until mounted so SSR/first-paint can't mismatch the
 * resolved theme (next-themes guidance for non-Next apps).
 */
export function ThemeToggle(): JSX.Element {
  const { theme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  const active = mounted ? (theme ?? "system") : "system";

  return (
    <div
      className="inline-flex h-9 items-center gap-0.5 rounded-lg bg-muted p-[3px]"
      role="group"
      aria-label="Theme"
    >
      {OPTIONS.map(({ value, label, icon: Icon }) => (
        <button
          key={value}
          type="button"
          aria-pressed={active === value}
          title={label}
          onClick={() => setTheme(value)}
          className={`inline-flex size-7 items-center justify-center rounded-md transition-colors ${
            active === value
              ? "bg-background text-foreground shadow-sm"
              : "text-muted-foreground hover:text-foreground"
          }`}
        >
          <Icon className="size-4" />
          <span className="sr-only">{label}</span>
        </button>
      ))}
    </div>
  );
}
