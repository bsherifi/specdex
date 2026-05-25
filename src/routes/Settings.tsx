import { useEffect, useState } from "react";
import type { JSX } from "react";
import { FolderOpen } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/shared";
import {
  getAppSettings,
  identityGet,
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
  const { push: _push } = useToast();

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

  if (!settings) return <div>Loading…</div>;

  // identityName / draft become useful in Task 2; suppress unused warnings for now.
  void identityName;
  void draft;
  void _push;

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
    </div>
  );
}
