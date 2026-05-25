import { useEffect } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { identityGet, kbListSummaries } from "@/lib/tauri";

export function useFirstRunRedirect(): void {
  const navigate = useNavigate();
  const loc = useLocation();
  useEffect(() => {
    if (loc.pathname.startsWith("/onboarding") || loc.pathname.startsWith("/__design")) return;
    void Promise.all([identityGet(), kbListSummaries()]).then(([id, kbs]) => {
      if (id === null && (kbs as unknown[]).length === 0) {
        navigate("/onboarding");
      }
    });
  }, [navigate, loc.pathname]);
}
