import { useEffect, useState } from "react";

export type Theme = "light" | "dark";

const MEDIA = "(prefers-color-scheme: dark)";

function read(): Theme {
  if (typeof window === "undefined") return "light";
  return window.matchMedia(MEDIA).matches ? "dark" : "light";
}

function applyClass(theme: Theme): void {
  const root = document.documentElement;
  if (theme === "dark") root.classList.add("dark");
  else root.classList.remove("dark");
}

/**
 * Tracks `prefers-color-scheme` and toggles the `dark` class on
 * `<html>` so Tailwind's `dark:` variants activate. Returns the
 * resolved theme so components can render conditional UI.
 */
export function useSystemTheme(): Theme {
  const [theme, setTheme] = useState<Theme>(read);

  useEffect(() => {
    applyClass(theme);
  }, [theme]);

  useEffect(() => {
    const mql = window.matchMedia(MEDIA);
    const onChange = (e: MediaQueryListEvent): void => {
      setTheme(e.matches ? "dark" : "light");
    };
    mql.addEventListener("change", onChange);
    return () => mql.removeEventListener("change", onChange);
  }, []);

  return theme;
}
