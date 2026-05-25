import { useEffect, useState } from "react";
import type { JSX } from "react";
import { FolderOpen, Save, Upload } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useToast } from "@/components/shared";
import {
  getAppSettings,
  identityGet,
  identitySet,
  revealInFileManager,
} from "@/lib/tauri";

interface AppSettings {
  data_dir: string;
  log_dir: string;
  pdfium_version: string;
  ocrs_version: string;
  tantivy_version: string;
}

export default function Settings(): JSX.Element {
  const [settings, setSettings] = useState<AppSettings | null>(null);
  const [identityName, setIdentityName] = useState("");
  const [draft, setDraft] = useState("");
  const { push } = useToast();

  const reload = async () => {
    const s = (await getAppSettings()) as unknown as AppSettings;
    setSettings(s);
    const id = (await identityGet()) as null | { display_name: string };
    if (id) {
      setIdentityName(id.display_name);
      setDraft(id.display_name);
    }
  };

  useEffect(() => {
    void reload();
  }, []);

  const saveIdentity = async () => {
    const v = draft.trim();
    if (!v) {
      push({ title: "Display name cannot be empty", variant: "error" });
      return;
    }
    await identitySet(v);
    setIdentityName(v);
    push({ title: "Identity updated", variant: "success" });
  };

  if (!settings) return <div>Loading…</div>;

  return (
    <div className="max-w-2xl space-y-8">
      <header>
        <h1 className="text-2xl font-semibold">Settings</h1>
      </header>

      <section className="space-y-2">
        <h2 className="text-sm font-semibold uppercase text-muted-foreground">Application data</h2>
        <div className="rounded-md border border-border p-3">
          <div className="font-mono text-xs">{settings.data_dir}</div>
          <Button
            variant="outline"
            size="sm"
            className="mt-2"
            onClick={() => void revealInFileManager(settings.data_dir)}
          >
            <FolderOpen className="mr-2 h-4 w-4" /> Open in file manager
          </Button>
          <p className="mt-2 text-xs text-muted-foreground">
            Changing the data directory is not supported in v1.
          </p>
        </div>
      </section>

      <section className="space-y-2">
        <h2 className="text-sm font-semibold uppercase text-muted-foreground">Identity</h2>
        <div className="rounded-md border border-border p-3 space-y-2">
          <p className="text-sm text-muted-foreground">
            Current: <span className="font-medium text-foreground">{identityName || "—"}</span>
          </p>
          <div className="flex items-center gap-2">
            <Input value={draft} onChange={(e) => setDraft(e.target.value)} placeholder="Display name" />
            <Button onClick={() => void saveIdentity()}>Save</Button>
          </div>
          <p className="text-xs text-muted-foreground">
            Stamped on every entry as <code>edited_by</code>.
          </p>
        </div>
      </section>

      <section className="space-y-2">
        <h2 className="text-sm font-semibold uppercase text-muted-foreground">OCR language data</h2>
        <div className="rounded-md border border-border p-3 text-sm">
          <p>Bundled: <code>eng</code>, <code>osd</code>.</p>
          <p className="mt-1 text-xs text-muted-foreground">
            Additional language packs are a v1.1 download.
          </p>
        </div>
      </section>

      <section className="space-y-2">
        <h2 className="text-sm font-semibold uppercase text-muted-foreground">Backup &amp; restore</h2>
        <div className="rounded-md border border-border p-3 space-y-2">
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              onClick={() => push({ title: "Backup", description: "Implemented in plan 40", variant: "info" })}
            >
              <Save className="mr-2 h-4 w-4" /> Export full backup ZIP
            </Button>
            <Button
              variant="outline"
              onClick={() => push({ title: "Restore", description: "Implemented in plan 40", variant: "info" })}
            >
              <Upload className="mr-2 h-4 w-4" /> Restore from backup ZIP
            </Button>
          </div>
          <p className="text-xs text-muted-foreground">
            Restoring replaces all data. Disabled until plan 40 ships the backend.
          </p>
        </div>
      </section>

      <section className="space-y-2">
        <h2 className="text-sm font-semibold uppercase text-muted-foreground">Diagnostics</h2>
        <div className="rounded-md border border-border p-3 text-sm space-y-1">
          <div>Tantivy: {settings.tantivy_version}</div>
          <div>PDFium: {settings.pdfium_version}</div>
          <div>ocrs: {settings.ocrs_version}</div>
          <div className="mt-2 font-mono text-xs">{settings.log_dir}</div>
          <Button
            variant="outline"
            size="sm"
            onClick={() => void revealInFileManager(settings.log_dir)}
          >
            <FolderOpen className="mr-2 h-4 w-4" /> Open log folder
          </Button>
          <div className="mt-3 rounded-md border border-emerald-500/40 bg-emerald-500/10 p-2 text-xs">
            Specdex makes no outbound network requests.
          </div>
        </div>
      </section>
    </div>
  );
}
