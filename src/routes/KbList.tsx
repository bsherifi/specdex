import { useEffect, useState, type JSX } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { Database, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyState } from "@/components/shared";
import { KbCreateDialog } from "@/components/KbCreateDialog";
import { kbListSummaries, unwrap } from "@/lib/tauri";
import { useStore } from "@/lib/store";

interface KbSummary {
  id: string;
  name: string;
  description: string | null;
  highlight_color: string;
  entry_count: number;
  updated_at: string;
}

export default function KbList(): JSX.Element {
  const [kbs, setKbs] = useState<KbSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialog, setDialog] = useState(false);
  const staleCounter = useStore((s) => s.kbsStaleCounter);
  const location = useLocation();
  const navigate = useNavigate();

  const reload = async () => {
    setKbs(unwrap<KbSummary[]>(await kbListSummaries()));
    setLoading(false);
  };

  useEffect(() => {
    void reload();
  }, [staleCounter]);

  // The Cmd+K palette's "New knowledge base" action routes here with this flag.
  useEffect(() => {
    if ((location.state as { create?: boolean } | null)?.create) {
      setDialog(true);
      navigate(location.pathname, { replace: true, state: null });
    }
  }, [location, navigate]);

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Knowledge bases</h1>
        <Button onClick={() => setDialog(true)}>
          <Plus className="mr-2 h-4 w-4" /> New KB
        </Button>
      </div>

      {loading ? (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="rounded-lg border border-border bg-card p-4">
              <div className="flex items-start justify-between">
                <Skeleton className="h-5 w-28" />
                <Skeleton className="size-4 rounded-full" />
              </div>
              <Skeleton className="mt-2 h-4 w-40" />
              <Skeleton className="mt-3 h-3 w-24" />
            </div>
          ))}
        </div>
      ) : kbs.length === 0 ? (
        <EmptyState
          icon={<Database />}
          title="No knowledge bases yet"
          description="Create your first KB to start ingesting documents."
          action={<Button onClick={() => setDialog(true)}>Create KB</Button>}
        />
      ) : (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {kbs.map((kb) => (
            <Link
              key={kb.id}
              to={`/kbs/${kb.id}`}
              className="rounded-lg border border-border bg-card p-4 hover:bg-accent"
            >
              <div className="flex items-start justify-between">
                <div>
                  <h3 className="font-semibold">{kb.name}</h3>
                  {kb.description && (
                    <p className="mt-1 text-sm text-muted-foreground line-clamp-2">{kb.description}</p>
                  )}
                </div>
                <div
                  className="h-4 w-4 rounded-full"
                  style={{ backgroundColor: kb.highlight_color }}
                />
              </div>
              <div className="mt-3 text-xs text-muted-foreground">
                {kb.entry_count} entries · updated {new Date(kb.updated_at).toLocaleDateString()}
              </div>
            </Link>
          ))}
        </div>
      )}

      <KbCreateDialog
        open={dialog}
        existingCount={kbs.length}
        onClose={() => setDialog(false)}
        onCreated={() => void reload()}
      />
    </div>
  );
}
