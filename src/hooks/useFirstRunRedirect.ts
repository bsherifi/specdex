import { useEffect } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { identityGet, kbListSummaries, unwrap } from "@/lib/tauri";

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
