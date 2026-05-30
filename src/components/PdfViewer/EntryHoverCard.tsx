import { useEffect, useState, type JSX, type ReactNode } from "react";
import { ArrowRight } from "lucide-react";
import { HoverCard, HoverCardContent, HoverCardTrigger } from "@/components/ui/hover-card";
import { Button } from "@/components/ui/button";
import { entryGet, kbGet, unwrap } from "@/lib/tauri";
import { normalizeSchema, type WireSchema } from "@/lib/schema-diff";

interface CardData {
  kbName: string;
  primaryValue: string;
  fields: { label: string; value: string }[];
  aliases: string[];
  notes: string | null;
}

// Hover previews are read-only and infrequent; cache per entry so re-hovering a
// code doesn't refetch. (Cleared on reload — fine for a preview.)
const cache = new Map<string, Promise<CardData>>();

function load(entryId: string, kbId: string): Promise<CardData> {
  let p = cache.get(entryId);
  if (!p) {
    p = (async () => {
      const [eRes, kRes] = await Promise.all([entryGet(entryId), kbGet(kbId)]);
      const entry = unwrap<{
        primary_value: string;
        data: Record<string, unknown>;
        aliases: string[];
        notes: string | null;
      }>(eRes);
      const kb = unwrap<{ name: string; schema: WireSchema }>(kRes);
      const schema = normalizeSchema(kb.schema);
      // Show every non-primary field (even empty ones) so the card reflects the
      // KB's full schema; empty values render as a muted dash.
      const fields = schema.fields
        .filter((f) => !f.primary)
        .map((f) => ({ label: f.label, value: String(entry.data[f.name] ?? "").trim() }));
      return {
        kbName: kb.name,
        primaryValue: entry.primary_value,
        fields,
        aliases: entry.aliases,
        notes: entry.notes,
      };
    })();
    cache.set(entryId, p);
  }
  return p;
}

interface Props {
  entryId: string;
  kbId: string;
  hex: string;
  onOpenEntry: (entryId: string, kbId: string) => void;
  children: ReactNode;
}

export function EntryHoverCard({ entryId, kbId, hex, onOpenEntry, children }: Props): JSX.Element {
  const [data, setData] = useState<CardData | null>(null);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (!open || data) return;
    let cancelled = false;
    void load(entryId, kbId).then((d) => {
      if (!cancelled) setData(d);
    });
    return () => {
      cancelled = true;
    };
  }, [open, data, entryId, kbId]);

  return (
    <HoverCard openDelay={120} closeDelay={80} onOpenChange={setOpen}>
      <HoverCardTrigger asChild>{children}</HoverCardTrigger>
      <HoverCardContent side="top" align="start" className="w-72">
        {!data ? (
          <div className="text-sm text-muted-foreground">Loading…</div>
        ) : (
          <div className="space-y-2.5">
            <div className="flex items-center gap-2">
              <span
                aria-hidden="true"
                className="size-2 shrink-0 rounded-full"
                style={{ backgroundColor: hex }}
              />
              <span className="truncate text-xs font-medium uppercase tracking-wide text-muted-foreground">
                {data.kbName}
              </span>
            </div>
            <div className="text-sm font-semibold leading-tight">{data.primaryValue}</div>
            {data.fields.length > 0 && (
              <dl className="space-y-1">
                {data.fields.map((f) => (
                  <div key={f.label} className="grid grid-cols-[5rem_1fr] gap-2 text-xs">
                    <dt className="truncate text-muted-foreground">{f.label}</dt>
                    <dd className={f.value ? "truncate" : "truncate text-muted-foreground/50"}>
                      {f.value || "—"}
                    </dd>
                  </div>
                ))}
              </dl>
            )}
            {data.aliases.length > 0 && (
              <div className="flex flex-wrap gap-1">
                {data.aliases.map((a) => (
                  <span key={a} className="rounded bg-muted px-1.5 py-0.5 text-[11px] leading-tight">
                    {a}
                  </span>
                ))}
              </div>
            )}
            {data.notes && (
              <p className="line-clamp-3 border-t border-border/50 pt-2 text-xs text-muted-foreground">
                {data.notes}
              </p>
            )}
            <Button
              size="sm"
              variant="secondary"
              className="w-full"
              onClick={() => onOpenEntry(entryId, kbId)}
            >
              Open in {data.kbName}
              <ArrowRight />
            </Button>
          </div>
        )}
      </HoverCardContent>
    </HoverCard>
  );
}
