import type { JSX } from "react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { KbScope } from "./types";

interface Props {
  kbs: { id: string; name: string; highlight_color: string }[];
  value: KbScope;
  onChange: (s: KbScope) => void;
}

export function ScopeDropdown({ kbs, value, onChange }: Props): JSX.Element {
  const v = value.kind === "all" ? "__all__" : value.kb_id!;
  return (
    <Select
      value={v}
      onValueChange={(next) =>
        onChange(next === "__all__" ? { kind: "all" } : { kind: "only", kb_id: next })
      }
    >
      <SelectTrigger className="w-[220px]">
        <SelectValue placeholder="Scope" />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value="__all__">All KBs</SelectItem>
        {kbs.map((kb) => (
          <SelectItem key={kb.id} value={kb.id}>
            {kb.name}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
