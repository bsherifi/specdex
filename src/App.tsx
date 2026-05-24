import type { JSX } from "react";
import { DesignShowcase } from "@/dev/DesignShowcase";
import { useSystemTheme } from "@/hooks/useSystemTheme";

export function App(): JSX.Element {
  // Side effect: keeps `dark` class on <html> in sync with system theme.
  useSystemTheme();
  return <DesignShowcase />;
}
