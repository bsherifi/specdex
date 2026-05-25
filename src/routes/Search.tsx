import { useEffect, useMemo, useRef, useState } from "react";
import type { JSX } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import { EmptyState, KbBadge } from "@/components/shared";
import { useDebounce } from "@/hooks/useDebounce";
import { searchEntries, searchSourceDocs, kbListSummaries, unwrap } from "@/lib/tauri";
import { cn } from "@/lib/utils";
import type { KbColorName } from "@/lib/theme";

interface EntryHit {
  entry_id: string;
  kb_id: string;
  kb_name: string;
  primary_value: string;
  score: number;
}

interface SourceDocHit {
  source_doc_id: string;
  filename: string;
  snippet_html: string;
  score: number;
}

interface KbSummary {
  id: string;
  name: string;
  highlight_color: string; // hex
  entry_count: number;
}

const LIMIT = 50;

function colorForHex(hex: string): KbColorName | undefined {
  // Map common palette hexes back to KB color names; if unknown, return undefined
  // and KbBadge falls back to "amber" via its default. (Plan 25 ensures hex
  // always comes from the palette, so the map covers v1.)
  const palette: Record<string, KbColorName> = {
    "#f59e0b": "amber",
    "#38bdf8": "sky",
    "#10b981": "emerald",
    "#ec4899": "pink",
    "#8b5cf6": "violet",
    "#f97316": "orange",
    "#06b6d4": "cyan",
    "#f43f5e": "rose",
  };
  return palette[hex.toLowerCase()];
}

/// Tantivy only emits `<b>` tags; we still sanitize defensively.
function sanitizeSnippet(html: string): string {
  return html
    .replace(/&/g, "&amp;")
    .replace(/<(?!\/?b\b)([^>]*)>/g, "&lt;$1&gt;");
}

export default function Search(): JSX.Element {
  const [q, setQ] = useState("");
  const debounced = useDebounce(q, 200);
  const [tab, setTab] = useState<"entries" | "docs">("entries");
  const [entryHits, setEntryHits] = useState<EntryHit[]>([]);
  const [docHits, setDocHits] = useState<SourceDocHit[]>([]);
  const [kbs, setKbs] = useState<KbSummary[]>([]);
  const [active, setActive] = useState(0);
  const navigate = useNavigate();
  const inputRef = useRef<HTMLInputElement>(null);

  // Slash-to-focus.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "/" && document.activeElement !== inputRef.current) {
        e.preventDefault();
        inputRef.current?.focus();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  useEffect(() => {
    void kbListSummaries().then((res) => setKbs(unwrap<KbSummary[]>(res)));
  }, []);

  useEffect(() => {
    setActive(0);
    if (!debounced.trim()) {
      setEntryHits([]);
      setDocHits([]);
      return;
    }
    if (tab === "entries") {
      void searchEntries(debounced, LIMIT).then((r) =>
        setEntryHits(unwrap<EntryHit[]>(r)),
      );
    } else {
      void searchSourceDocs(debounced, LIMIT).then((r) =>
        setDocHits(unwrap<SourceDocHit[]>(r)),
      );
    }
  }, [debounced, tab]);

  const results = tab === "entries" ? entryHits : docHits;
  const hasNoKbs = kbs.length === 0;

  const onKeyOnList = (e: React.KeyboardEvent<HTMLDivElement | HTMLInputElement>) => {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActive((i) => Math.min(i + 1, Math.max(results.length - 1, 0)));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActive((i) => Math.max(i - 1, 0));
    } else if (e.key === "Enter") {
      const hit = results[active];
      if (!hit) return;
      if (tab === "entries") {
        const h = hit as EntryHit;
        navigate(`/kbs/${h.kb_id}#entry-${h.entry_id}`);
      } else {
        const h = hit as SourceDocHit;
        navigate(`/documents/${h.source_doc_id}`);
      }
    }
  };

  const kbColor = useMemo(() => {
    const m: Record<string, KbColorName> = {};
    for (const kb of kbs) {
      const c = colorForHex(kb.highlight_color);
      if (c) m[kb.id] = c;
    }
    return m;
  }, [kbs]);

  return (
    <div className="mx-auto max-w-3xl">
      <Input
        ref={inputRef}
        placeholder="Search entries and documents… (press /)"
        value={q}
        onChange={(e) => setQ(e.target.value)}
        onKeyDown={onKeyOnList}
        autoFocus
      />
      <Tabs value={tab} onValueChange={(v) => setTab(v as "entries" | "docs")} className="mt-4">
        <TabsList>
          <TabsTrigger value="entries">Entries ({entryHits.length})</TabsTrigger>
          <TabsTrigger value="docs">In Documents ({docHits.length})</TabsTrigger>
        </TabsList>

        <TabsContent value="entries">
          {hasNoKbs ? (
            <EmptyState
              title="Create your first knowledge base"
              description="Specdex needs at least one KB before search can return results."
              action={<Link to="/onboarding" className="underline">Run onboarding</Link>}
            />
          ) : entryHits.length === 0 ? (
            <EmptyState title="No matches" description="Check spelling, or scan a new document." />
          ) : (
            <div onKeyDown={onKeyOnList} tabIndex={0} className="mt-3 flex flex-col gap-1">
              {entryHits.map((h, i) => (
                <Link
                  key={h.entry_id}
                  to={`/kbs/${h.kb_id}#entry-${h.entry_id}`}
                  className={cn(
                    "rounded-md border border-border bg-card p-3 hover:bg-accent",
                    i === active && "ring-2 ring-ring",
                  )}
                >
                  <div className="flex items-center gap-2">
                    <KbBadge name={h.kb_name} color={kbColor[h.kb_id] ?? "amber"} />
                    <span className="font-medium">{h.primary_value}</span>
                  </div>
                </Link>
              ))}
            </div>
          )}
        </TabsContent>

        <TabsContent value="docs">
          {docHits.length === 0 ? (
            <EmptyState title="No matches" description="Try a different query or ingest more PDFs." />
          ) : (
            <div onKeyDown={onKeyOnList} tabIndex={0} className="mt-3 flex flex-col gap-2">
              {docHits.map((h, i) => (
                <Link
                  key={h.source_doc_id}
                  to={`/documents/${h.source_doc_id}`}
                  className={cn(
                    "block rounded-md border border-border bg-card p-3 hover:bg-accent",
                    i === active && "ring-2 ring-ring",
                  )}
                >
                  <div className="font-medium">{h.filename}</div>
                  <div
                    className="mt-1 text-sm text-muted-foreground"
                    dangerouslySetInnerHTML={{ __html: sanitizeSnippet(h.snippet_html) }}
                  />
                </Link>
              ))}
            </div>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}
