import { useState, type JSX } from "react";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { KbColorPicker } from "./KbColorPicker";
import { KB_COLOR_HEX, defaultKbColor, type KbColorName } from "@/lib/theme";
import { kbCreate } from "@/lib/tauri";
import { useToast } from "@/components/shared";

interface Props {
  open: boolean;
  existingCount: number;
  onClose: () => void;
  onCreated: () => void;
}

const STARTER_SCHEMA = [
  {
    name: "code",
    label: "Code",
    type: { kind: "text" },
    required: true,
    searchable: true,
    primary: true,
  },
  {
    name: "definition",
    label: "Definition",
    type: { kind: "text_multiline" },
    required: false,
    searchable: true,
    primary: false,
  },
];

export function KbCreateDialog({ open, existingCount, onClose, onCreated }: Props): JSX.Element {
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [color, setColor] = useState<KbColorName>(defaultKbColor(existingCount));
  const { push } = useToast();

  const submit = async () => {
    try {
      await kbCreate({
        name,
        description: description || undefined,
        schema: { fields: STARTER_SCHEMA },
        highlight_color: KB_COLOR_HEX[color],
      });
      push({ title: "KB created", variant: "success" });
      setName("");
      setDescription("");
      onCreated();
      onClose();
    } catch (e) {
      push({ title: "Couldn't create KB", description: String(e), variant: "error" });
    }
  };

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>New knowledge base</DialogTitle>
        </DialogHeader>
        <div className="flex flex-col gap-3">
          <Input placeholder="Name (e.g. Boeing Specs)" value={name} onChange={(e) => setName(e.target.value)} />
          <Textarea placeholder="Description (optional)" value={description} onChange={(e) => setDescription(e.target.value)} />
          <div>
            <div className="mb-2 text-sm font-medium">Highlight color</div>
            <KbColorPicker value={color} onChange={setColor} />
          </div>
          <p className="text-xs text-muted-foreground">
            Starter schema: <code>code</code> (primary) + <code>definition</code>. Use Schema editor to customize.
          </p>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button onClick={() => void submit()} disabled={!name.trim()}>Create</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
