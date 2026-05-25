import { useEffect, useState } from "react";
import type { JSX } from "react";
import { FolderOpen, RefreshCcw, Save, Upload } from "lucide-react";
import { Link } from "react-router-dom";
import { save, open } from "@tauri-apps/plugin-dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useToast } from "@/components/shared";
import {
  backupExport,
  backupRestore,
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

// Commands return the tauri-specta `{ status, data | error }` wrapper (see the
// contract note in `@/lib/tauri`); narrow on `status` rather than casting past it.
function unwrap<T>(res: unknown): T {
  const r = res as { status: "ok"; data: T } | { status: "error"; error: unknown };
  if (r.status === "error") throw new Error(JSON.stringify(r.error));
  return r.data;
}

export default function Settings(): JSX.Element {
  const [settings, setSettings] = useState<AppSettings | null>(null);
  const [identityName, setIdentityName] = useState("");
  const [draft, setDraft] = useState("");
  const { push } = useToast();

  const reload = async () => {
    const s = (await getAppSettings()) as unknown as AppSettings;
    setSettings(s);
    const id = unwrap<{ display_name: string } | null>(await identityGet());
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

  const onExport = async () => {
    const path = await save({
      filters: [{ name: "Specdex backup", extensions: ["zip"] }],
      defaultPath: `specdex-backup-${new Date().toISOString().slice(0, 10)}.zip`,
    });
    if (!path) return;
    await backupExport(path);
    push({ title: "Backup written", description: path, variant: "success" });
  };

  const onRestore = async () => {
    const path = await open({
      filters: [{ name: "Specdex backup", extensions: ["zip"] }],
    });
    if (!path || Array.isArray(path)) return;
    if (!window.confirm("Restoring will replace ALL current KBs and source documents. Continue?")) {
      return;
    }
    await backupRestore(path);
    push({ title: "Restore complete", variant: "success" });
    void reload();
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
            <Button variant="outline" onClick={() => void onExport()}>
              <Save className="mr-2 h-4 w-4" /> Export full backup ZIP
            </Button>
            <Button variant="outline" onClick={() => void onRestore()}>
              <Upload className="mr-2 h-4 w-4" /> Restore from backup ZIP
            </Button>
          </div>
          <p className="text-xs text-muted-foreground">
            Restoring replaces all data with the contents of the backup ZIP.
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

      <section className="space-y-2">
        <h2 className="text-sm font-semibold uppercase text-muted-foreground">Onboarding</h2>
        <div className="rounded-md border border-border p-3 text-sm">
          <Link to="/onboarding" className="inline-flex items-center gap-2 text-primary underline">
            <RefreshCcw className="h-4 w-4" /> Replay onboarding wizard
          </Link>
        </div>
      </section>

      <section className="space-y-2">
        <h2 className="text-sm font-semibold uppercase text-muted-foreground">About</h2>
        <div className="rounded-md border border-border p-3 text-sm space-y-1">
          <div>Specdex</div>
          <div>
            License: MIT ·{" "}
            <a className="underline" href="https://github.com/bsherifi/specdex">github.com/bsherifi/specdex</a>
          </div>
          <div className="text-xs text-muted-foreground">
            Third-party licenses bundled at <code>THIRD-PARTY-LICENSES.txt</code> (added in plan 41).
          </div>
        </div>
      </section>
    </div>
  );
}
