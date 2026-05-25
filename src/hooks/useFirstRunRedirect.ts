import { useEffect } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { identityGet, kbListSummaries } from "@/lib/tauri";

// Commands return the tauri-specta `{ status, data | error }` wrapper (see the
// contract note in `@/lib/tauri`); narrow on `status` rather than casting past it.
function unwrap<T>(res: unknown): T {
  const r = res as { status: "ok"; data: T } | { status: "error"; error: unknown };
  if (r.status === "error") throw new Error(JSON.stringify(r.error));
  return r.data;
}

export function useFirstRunRedirect(): void {
  const navigate = useNavigate();
  const loc = useLocation();
  useEffect(() => {
    if (loc.pathname.startsWith("/onboarding") || loc.pathname.startsWith("/__design")) return;
    void Promise.all([identityGet(), kbListSummaries()]).then(([idRes, kbRes]) => {
      const id = unwrap<unknown>(idRes) ?? null;
      const kbs = unwrap<unknown[]>(kbRes);
      if (id === null && kbs.length === 0) {
        navigate("/onboarding");
      }
    });
  }, [navigate, loc.pathname]);
}
