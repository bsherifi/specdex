import { useEffect, useState } from "react";
import type { JSX, ReactNode } from "react";
import { FolderOpen, RefreshCcw, Save, Upload } from "lucide-react";
import { Link } from "react-router-dom";
import { save, open } from "@tauri-apps/plugin-dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "sonner";
import {
  backupExport,
  backupRestore,
  getAppSettings,
  identityGet,
  identitySet,
  revealInFileManager,
  unwrap,
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
      toast.error("Display name cannot be empty");
      return;
    }
    try {
      unwrap(await identitySet(v));
      setIdentityName(v);
      toast.success("Identity updated");
    } catch (e) {
      toast.error("Identity update failed", { description: String(e) });
    }
  };

  const onExport = async () => {
    const path = await save({
      filters: [{ name: "Specdex backup", extensions: ["zip"] }],
      defaultPath: `specdex-backup-${new Date().toISOString().slice(0, 10)}.zip`,
    });
    if (!path) return;
    try {
      unwrap(await backupExport(path));
      toast.success("Backup written", { description: path });
    } catch (e) {
      toast.error("Backup failed", { description: String(e) });
    }
  };

  const onRestore = async () => {
    const path = await open({
      filters: [{ name: "Specdex backup", extensions: ["zip"] }],
    });
    if (!path || Array.isArray(path)) return;
    if (!window.confirm("Restoring will replace ALL current KBs and source documents. Continue?")) {
      return;
    }
    try {
      unwrap(await backupRestore(path));
      toast.success("Restore complete");
      void reload();
    } catch (e) {
      toast.error("Restore failed", { description: String(e) });
    }
  };

  const openDataDir = async () => {
    if (!settings) return;
    try {
      unwrap(await revealInFileManager(settings.data_dir));
    } catch (e) {
      toast.error("Couldn't open folder", { description: String(e) });
    }
  };

  if (!settings)
    return (
      <div className="mx-auto w-full max-w-2xl space-y-4">
        <Skeleton className="h-8 w-32" />
        {Array.from({ length: 4 }).map((_, i) => (
          <Skeleton key={i} className="h-28 w-full rounded-xl" />
        ))}
      </div>
    );

  return (
    <div className="mx-auto w-full max-w-2xl space-y-4">
      <header>
        <h1 className="text-2xl font-semibold tracking-tight">Settings</h1>
      </header>

      <Section title="Application data">
        <div className="rounded-md border border-border/60 bg-muted/50 px-3 py-2 font-mono text-xs">
          {settings.data_dir}
        </div>
        <Button variant="outline" size="sm" onClick={() => void openDataDir()}>
          <FolderOpen /> Open in file manager
        </Button>
        <p className="text-xs text-muted-foreground">
          Changing the data directory is not supported in v1.
        </p>
      </Section>

      <Section title="Identity">
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
      </Section>

      <Section title="OCR language data">
        <p>Bundled: <code>eng</code>, <code>osd</code>.</p>
        <p className="text-xs text-muted-foreground">
          Additional language packs are a v1.1 download.
        </p>
      </Section>

      <Section title="Backup & restore">
        <div className="flex flex-wrap items-center gap-2">
          <Button variant="outline" onClick={() => void onExport()}>
            <Save /> Export full backup ZIP
          </Button>
          <Button variant="outline" onClick={() => void onRestore()}>
            <Upload /> Restore from backup ZIP
          </Button>
        </div>
        <p className="text-xs text-muted-foreground">
          Restoring replaces all data with the contents of the backup ZIP.
        </p>
      </Section>

      <Section title="Diagnostics">
        <div className="space-y-1 text-sm">
          <div>Tantivy: {settings.tantivy_version}</div>
          <div>PDFium: {settings.pdfium_version}</div>
          <div>ocrs: {settings.ocrs_version}</div>
          <div className="pt-1 font-mono text-xs">{settings.log_dir}</div>
        </div>
        <Button variant="outline" size="sm" onClick={() => void revealInFileManager(settings.log_dir)}>
          <FolderOpen /> Open log folder
        </Button>
        <div className="rounded-md border border-emerald-500/40 bg-emerald-500/10 px-3 py-2 text-xs text-emerald-700 dark:text-emerald-400">
          Specdex makes no outbound network requests.
        </div>
      </Section>

      <Section title="Onboarding">
        <Link
          to="/onboarding"
          className="inline-flex items-center gap-2 text-sm text-primary underline-offset-4 hover:underline"
        >
          <RefreshCcw className="size-4" /> Replay onboarding wizard
        </Link>
      </Section>

      <Section title="About">
        <div className="space-y-1 text-sm">
          <div>Specdex</div>
          <div>
            License: MIT ·{" "}
            <a className="underline-offset-4 hover:underline" href="https://github.com/bsherifi/specdex">
              github.com/bsherifi/specdex
            </a>
          </div>
          <div className="text-xs text-muted-foreground">
            Third-party licenses bundled at <code>THIRD-PARTY-LICENSES.txt</code> (added in plan 41).
          </div>
        </div>
      </Section>
    </div>
  );
}

function Section({
  title,
  children,
}: {
  title: string;
  children: ReactNode;
}): JSX.Element {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
          {title}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">{children}</CardContent>
    </Card>
  );
}
