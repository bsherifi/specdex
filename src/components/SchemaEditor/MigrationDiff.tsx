import { useState, type JSX } from "react";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import type { SchemaDiff } from "@/lib/schema-diff";

interface Props {
  open: boolean;
  kbName: string;
  entryCount: number;
  diff: SchemaDiff;
  onConfirm: () => void;
  onCancel: () => void;
}

export function MigrationDiff({ open, kbName, entryCount, diff, onConfirm, onCancel }: Props): JSX.Element {
  const dataLossy =
    diff.type_changed.length > 0 || diff.removed.length > 0 || diff.primary_changed !== null;
  const [acknowledged, setAcknowledged] = useState(false);

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onCancel()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Apply schema changes to &quot;{kbName}&quot; ({entryCount} entries)?</DialogTitle>
        </DialogHeader>
        <div className="space-y-2 text-sm">
          {diff.renamed.map(([oldName, def]) => (
            <div key={oldName}>
              <b>Rename</b> <code>{oldName}</code> → <code>{def.name}</code> — data preserved.
            </div>
          ))}
          {diff.added.map((f) => (
            <div key={f.name}>
              <b>Add</b> <code>{f.name}</code> ({f.type.kind}) — defaults to empty on existing entries.
            </div>
          ))}
          {diff.removed.map((f) => (
            <div key={f.name} className="text-amber-600">
              <b>Remove</b> <code>{f.name}</code> — values archived to <code>_archived.{f.name}</code>.
            </div>
          ))}
          {diff.type_changed.map(([oldF, newF]) => (
            <div key={oldF.name} className="text-amber-600">
              <b>Type change</b> <code>{oldF.name}</code> ({oldF.type.kind} → {newF.type.kind}) —
              values that can&apos;t convert become empty.
            </div>
          ))}
          {diff.options_changed.map(([oldF]) => (
            <div key={oldF.name}>
              <b>Select options changed</b> <code>{oldF.name}</code> — values not in new list become empty.
            </div>
          ))}
          {diff.primary_changed && (
            <div className="text-amber-600">
              <b>Primary field changed</b>: <code>{diff.primary_changed[0]}</code> →{" "}
              <code>{diff.primary_changed[1]}</code>. Re-scan of all source documents required.
            </div>
          )}
        </div>

        {dataLossy && (
          <label className="mt-3 inline-flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={acknowledged}
              onChange={(e) => setAcknowledged(e.target.checked)}
            />
            I understand some data may be lost or moved to <code>_archived</code>.
          </label>
        )}

        <p className="mt-3 text-xs text-muted-foreground">
          These changes are reversible only via backup restore.
        </p>

        <DialogFooter>
          <Button variant="outline" onClick={onCancel}>Cancel</Button>
          <Button onClick={onConfirm} disabled={dataLossy && !acknowledged}>
            Apply
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
