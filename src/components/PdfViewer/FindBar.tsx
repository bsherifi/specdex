import { useEffect, useRef, type JSX } from "react";
import { ChevronDown, ChevronUp, X } from "lucide-react";
import { Button } from "@/components/ui/button";

interface Props {
  query: string;
  onQuery: (q: string) => void;
  count: number;
  activeIndex: number | null; // 0-based
  onPrev: () => void;
  onNext: () => void;
  onClose: () => void;
}

export function FindBar({
  query,
  onQuery,
  count,
  activeIndex,
  onPrev,
  onNext,
  onClose,
}: Props): JSX.Element {
  const inputRef = useRef<HTMLInputElement>(null);
  useEffect(() => {
    inputRef.current?.focus();
    inputRef.current?.select();
  }, []);

  const status =
    query.trim() === ""
      ? ""
      : count === 0
        ? "No results"
        : `${activeIndex === null ? 1 : activeIndex + 1} / ${count}`;

  return (
    <div className="absolute right-4 top-3 z-30 flex items-center gap-1 rounded-md border border-border bg-popover p-1 shadow-md">
      <input
        ref={inputRef}
        value={query}
        onChange={(e) => onQuery(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter") {
            e.preventDefault();
            if (e.shiftKey) onPrev();
            else onNext();
          } else if (e.key === "Escape") {
            e.preventDefault();
            onClose();
          }
        }}
        placeholder="Find in document…"
        className="h-7 w-56 rounded bg-background px-2 text-sm outline-none"
      />
      <span className="min-w-16 px-1 text-center text-xs text-muted-foreground">{status}</span>
      <Button size="icon-sm" variant="ghost" onClick={onPrev} disabled={count === 0} title="Previous (⇧⏎)">
        <ChevronUp />
      </Button>
      <Button size="icon-sm" variant="ghost" onClick={onNext} disabled={count === 0} title="Next (⏎)">
        <ChevronDown />
      </Button>
      <Button size="icon-sm" variant="ghost" onClick={onClose} title="Close (Esc)">
        <X />
      </Button>
    </div>
  );
}
