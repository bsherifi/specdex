import { useEffect, useState, type JSX } from "react";
import { useNavigate } from "react-router-dom";
import { open as openFileDialog } from "@tauri-apps/plugin-dialog";
import {
  Database,
  FileText,
  Plus,
  Search as SearchIcon,
  Settings as SettingsIcon,
  Upload,
} from "lucide-react";
import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
} from "@/components/ui/command";
import { kbListSummaries, sourceDocListRecent, unwrap } from "@/lib/tauri";
import { useStore } from "@/lib/store";

interface KbRow {
  id: string;
  name: string;
}
interface DocRow {
  id: string;
  filename: string;
}

export function CommandPalette(): JSX.Element {
  const [open, setOpen] = useState(false);
  const [kbs, setKbs] = useState<KbRow[]>([]);
  const [docs, setDocs] = useState<DocRow[]>([]);
  const navigate = useNavigate();
  const setPending = useStore((s) => s.setPendingIngest);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "k" && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        setOpen((o) => !o);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  // Refresh the jump lists each time the palette opens so they stay current.
  useEffect(() => {
    if (!open) return;
    void kbListSummaries()
      .then((r) => setKbs(unwrap<KbRow[]>(r)))
      .catch(() => setKbs([]));
    void sourceDocListRecent(50)
      .then((r) => setDocs(unwrap<DocRow[]>(r)))
      .catch(() => setDocs([]));
  }, [open]);

  const run = (fn: () => void) => {
    setOpen(false);
    fn();
  };

  const ingestPdf = async () => {
    const picked = await openFileDialog({
      multiple: true,
      filters: [{ name: "PDF documents", extensions: ["pdf"] }],
    });
    if (!picked) return;
    const paths = Array.isArray(picked) ? picked : [picked];
    setPending(
      paths
        .slice(0, 50)
        .map((p) => ({ path: p, filename: p.split(/[/\\]/).pop() ?? p })),
    );
  };

  return (
    <CommandDialog open={open} onOpenChange={setOpen}>
      <CommandInput placeholder="Search routes, knowledge bases, documents…" />
      <CommandList>
        <CommandEmpty>No results found.</CommandEmpty>

        <CommandGroup heading="Go to">
          <CommandItem onSelect={() => run(() => navigate("/"))}>
            <SearchIcon />
            Search
          </CommandItem>
          <CommandItem onSelect={() => run(() => navigate("/documents"))}>
            <FileText />
            Documents
          </CommandItem>
          <CommandItem onSelect={() => run(() => navigate("/kbs"))}>
            <Database />
            Knowledge bases
          </CommandItem>
          <CommandItem onSelect={() => run(() => navigate("/settings"))}>
            <SettingsIcon />
            Settings
          </CommandItem>
        </CommandGroup>

        <CommandGroup heading="Actions">
          <CommandItem
            onSelect={() => run(() => navigate("/kbs", { state: { create: true } }))}
          >
            <Plus />
            New knowledge base
          </CommandItem>
          <CommandItem onSelect={() => run(() => void ingestPdf())}>
            <Upload />
            Ingest PDF…
          </CommandItem>
        </CommandGroup>

        {kbs.length > 0 && (
          <>
            <CommandSeparator />
            <CommandGroup heading="Knowledge bases">
              {kbs.map((kb) => (
                <CommandItem
                  key={kb.id}
                  value={`kb ${kb.name} ${kb.id}`}
                  onSelect={() => run(() => navigate(`/kbs/${kb.id}`))}
                >
                  <Database />
                  {kb.name}
                </CommandItem>
              ))}
            </CommandGroup>
          </>
        )}

        {docs.length > 0 && (
          <>
            <CommandSeparator />
            <CommandGroup heading="Documents">
              {docs.map((d) => (
                <CommandItem
                  key={d.id}
                  value={`doc ${d.filename} ${d.id}`}
                  onSelect={() => run(() => navigate(`/documents/${d.id}`))}
                >
                  <FileText />
                  {d.filename}
                </CommandItem>
              ))}
            </CommandGroup>
          </>
        )}
      </CommandList>
    </CommandDialog>
  );
}
