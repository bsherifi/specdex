import type { JSX } from "react";
import { Link, NavLink, Outlet, useLocation } from "react-router-dom";
import { Search, FileText, Database, Settings as SettingsIcon } from "lucide-react";
import { cn } from "@/lib/utils";

const NAV = [
  { to: "/", label: "Search", icon: Search },
  { to: "/documents", label: "Documents", icon: FileText },
  { to: "/kbs", label: "Knowledge bases", icon: Database },
  { to: "/settings", label: "Settings", icon: SettingsIcon },
] as const;

export function Layout(): JSX.Element {
  const loc = useLocation();
  // Hide chrome on onboarding + design showcase.
  const minimal = loc.pathname.startsWith("/onboarding") || loc.pathname.startsWith("/__design");

  if (minimal) {
    return <Outlet />;
  }

  return (
    <div className="min-h-screen bg-background text-foreground">
      <aside className="fixed inset-y-0 left-0 z-20 flex w-48 flex-col border-r border-border bg-card p-3">
        <Link to="/" className="mb-6 inline-flex items-center gap-2 text-lg font-semibold">
          Specdex
        </Link>
        <nav className="flex flex-col gap-1">
          {NAV.map(({ to, label, icon: Icon }) => (
            <NavLink
              key={to}
              to={to}
              end={to === "/"}
              className={({ isActive }) =>
                cn(
                  "inline-flex items-center gap-2 rounded-md px-2 py-1.5 text-sm",
                  isActive
                    ? "bg-accent text-accent-foreground"
                    : "text-muted-foreground hover:bg-muted hover:text-foreground",
                )
              }
            >
              <Icon className="h-4 w-4" />
              {label}
            </NavLink>
          ))}
        </nav>
      </aside>
      <main className="ml-48 min-h-screen p-6">
        <Outlet />
      </main>
    </div>
  );
}
