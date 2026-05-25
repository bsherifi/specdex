import type { JSX } from "react";
import { createBrowserRouter } from "react-router-dom";
import { lazy, Suspense } from "react";
import { Layout } from "@/components/Layout";

const lazyRoute = (loader: () => Promise<{ default: () => JSX.Element }>) => {
  const Component = lazy(loader);
  return (
    <Suspense fallback={<div className="p-6 text-muted-foreground">Loading…</div>}>
      <Component />
    </Suspense>
  );
};

export const router = createBrowserRouter([
  {
    path: "/",
    element: <Layout />,
    children: [
      { index: true, element: lazyRoute(() => import("@/routes/Search")) },
      { path: "documents", element: lazyRoute(() => import("@/routes/Documents")) },
      { path: "documents/:id", element: lazyRoute(() => import("@/routes/DocumentViewer")) },
      { path: "kbs", element: lazyRoute(() => import("@/routes/KbList")) },
      { path: "kbs/:id", element: lazyRoute(() => import("@/routes/KbDetail")) },
      { path: "settings", element: lazyRoute(() => import("@/routes/Settings")) },
      { path: "onboarding", element: lazyRoute(() => import("@/routes/Onboarding")) },
      {
        path: "__design",
        element: lazyRoute(async () => ({
          default: (await import("@/dev/DesignShowcase")).DesignShowcase,
        })),
      },
    ],
  },
]);
