import type { JSX } from "react";
import { Fragment } from "react";
import { Link, Outlet, useLocation } from "react-router-dom";
import { useFirstRunRedirect } from "@/hooks/useFirstRunRedirect";
import { AppSidebar } from "@/components/AppSidebar";
import { ThemeToggle } from "@/components/ThemeToggle";
import {
  SidebarInset,
  SidebarProvider,
  SidebarTrigger,
} from "@/components/ui/sidebar";
import { Separator } from "@/components/ui/separator";
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb";

interface Crumb {
  label: string;
  to?: string;
}

// Static, path-derived breadcrumb trail. Dynamic detail pages show a generic
// leaf label (we don't have the KB/document name in the shell); Phase 5 can
// inject the real name when those routes are restyled.
function buildCrumbs(pathname: string): Crumb[] {
  const seg = pathname.split("/").filter(Boolean);
  if (seg.length === 0) return [{ label: "Search" }];

  switch (seg[0]) {
    case "documents":
      return seg.length === 1
        ? [{ label: "Documents" }]
        : [{ label: "Documents", to: "/documents" }, { label: "Document" }];
    case "kbs":
      if (seg.length === 1) return [{ label: "Knowledge bases" }];
      if (seg.length === 2)
        return [
          { label: "Knowledge bases", to: "/kbs" },
          { label: "Knowledge base" },
        ];
      return [
        { label: "Knowledge bases", to: "/kbs" },
        { label: "Knowledge base", to: `/kbs/${seg[1]}` },
        { label: "Schema" },
      ];
    case "settings":
      return [{ label: "Settings" }];
    default:
      return [{ label: seg[0]! }];
  }
}

function Breadcrumbs({ pathname }: { pathname: string }): JSX.Element {
  const crumbs = buildCrumbs(pathname);
  return (
    <Breadcrumb>
      <BreadcrumbList>
        {crumbs.map((crumb, i) => {
          const isLast = i === crumbs.length - 1;
          return (
            <Fragment key={`${crumb.label}-${i}`}>
              <BreadcrumbItem>
                {isLast || !crumb.to ? (
                  <BreadcrumbPage>{crumb.label}</BreadcrumbPage>
                ) : (
                  <BreadcrumbLink asChild>
                    <Link to={crumb.to}>{crumb.label}</Link>
                  </BreadcrumbLink>
                )}
              </BreadcrumbItem>
              {!isLast && <BreadcrumbSeparator />}
            </Fragment>
          );
        })}
      </BreadcrumbList>
    </Breadcrumb>
  );
}

export function Layout(): JSX.Element {
  useFirstRunRedirect();
  const loc = useLocation();
  // Hide chrome on onboarding + design showcase; keep them independently
  // scrollable since the global body is overflow-hidden.
  const minimal =
    loc.pathname.startsWith("/onboarding") ||
    loc.pathname.startsWith("/__design");

  if (minimal) {
    return (
      <div className="h-svh overflow-auto">
        <Outlet />
      </div>
    );
  }

  return (
    <SidebarProvider>
      <AppSidebar />
      <SidebarInset>
        <header className="flex h-16 shrink-0 items-center gap-2 border-b border-border px-4">
          <SidebarTrigger className="-ml-1" />
          <Separator
            orientation="vertical"
            className="mr-2 data-[orientation=vertical]:h-4"
          />
          <Breadcrumbs pathname={loc.pathname} />
          <div className="ml-auto flex items-center gap-2">
            <ThemeToggle />
          </div>
        </header>
        <div
          key={loc.pathname}
          className="page-enter flex min-h-0 flex-1 flex-col gap-3 overflow-auto p-4"
        >
          <Outlet />
        </div>
      </SidebarInset>
    </SidebarProvider>
  );
}
