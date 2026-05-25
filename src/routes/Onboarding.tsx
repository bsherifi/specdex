import type { JSX } from "react";
import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/components/shared";
import { KbColorPicker } from "@/components/KbColorPicker";
import { TEMPLATES, EMPTY_TEMPLATE, type KbTemplate } from "@/dev/templates";
import { identitySet, kbCreate, unwrap } from "@/lib/tauri";
import { schemaToWire } from "@/lib/schema-diff";
import { KB_COLOR_HEX, type KbColorName } from "@/lib/theme";

type Step = 0 | 1 | 2 | 3;

export default function Onboarding(): JSX.Element {
  const [step, setStep] = useState<Step>(0);
  const [name, setName] = useState("");
  const [chosenTpl, setChosenTpl] = useState<KbTemplate>(TEMPLATES[0]!);
  const [kbName, setKbName] = useState(chosenTpl.name);
  const [kbDesc, setKbDesc] = useState(chosenTpl.description);
  const [color, setColor] = useState<KbColorName>("amber");
  const { push } = useToast();
  const navigate = useNavigate();

  const pickTemplate = (t: KbTemplate) => {
    setChosenTpl(t);
    setKbName(t.name);
    setKbDesc(t.description);
  };

  const finish = async () => {
    try {
      unwrap(await identitySet(name.trim()));
      unwrap(await kbCreate({
        name: kbName,
        description: kbDesc || null,
        schema: schemaToWire(chosenTpl.schema),
        highlight_color: KB_COLOR_HEX[color],
      }));
      setStep(3);
    } catch (e) {
      push({ title: "Onboarding failed", description: String(e), variant: "error" });
    }
  };

  return (
    <div className="mx-auto grid min-h-screen max-w-xl place-items-center p-6">
      <div className="w-full space-y-6 rounded-lg border border-border bg-card p-6 shadow">
        <div className="flex items-center gap-1 text-xs text-muted-foreground">
          Step {step + 1} of 4
        </div>

        {step === 0 && (
          <>
            <h1 className="text-2xl font-semibold">Welcome to Specdex</h1>
            <p className="text-muted-foreground">
              Specdex runs entirely on your machine. No cloud, no telemetry, no AI.
              Curate a knowledge base of codes and Specdex highlights them inline
              when you drop new documents.
            </p>
            <Button onClick={() => setStep(1)}>Next</Button>
          </>
        )}

        {step === 1 && (
          <>
            <h2 className="text-lg font-semibold">What should we show as your name on entries you create?</h2>
            <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Sara Chen" autoFocus />
            <p className="text-xs text-muted-foreground">
              No password, no email — just attribution stamped on entries you edit.
            </p>
            <div className="flex justify-between">
              <Button variant="outline" onClick={() => setStep(0)}>Back</Button>
              <Button onClick={() => setStep(2)} disabled={!name.trim()}>Next</Button>
            </div>
          </>
        )}

        {step === 2 && (
          <>
            <h2 className="text-lg font-semibold">Create your first knowledge base</h2>
            <div className="space-y-3">
              <div>
                <label className="text-sm font-medium">Template</label>
                <div className="mt-1 grid grid-cols-2 gap-2">
                  {[...TEMPLATES, EMPTY_TEMPLATE].map((t) => (
                    <button
                      key={t.id}
                      onClick={() => pickTemplate(t)}
                      className={`rounded-md border p-2 text-left text-sm ${
                        chosenTpl.id === t.id ? "border-primary" : "border-border"
                      }`}
                    >
                      <div className="font-medium">{t.name}</div>
                      <div className="text-xs text-muted-foreground">{t.description}</div>
                    </button>
                  ))}
                </div>
              </div>
              <Input value={kbName} onChange={(e) => setKbName(e.target.value)} placeholder="KB name" />
              <Textarea value={kbDesc} onChange={(e) => setKbDesc(e.target.value)} placeholder="Description" />
              <div>
                <div className="mb-2 text-sm">Highlight color</div>
                <KbColorPicker value={color} onChange={setColor} />
              </div>
            </div>
            <div className="flex justify-between">
              <Button variant="outline" onClick={() => setStep(1)}>Back</Button>
              <Button onClick={() => void finish()} disabled={!kbName.trim()}>Create</Button>
            </div>
          </>
        )}

        {step === 3 && (
          <>
            <h2 className="text-lg font-semibold">You&apos;re ready</h2>
            <p className="text-muted-foreground">
              Drag PDFs onto the app to start scanning. New codes auto-highlight as you add
              entries.
            </p>
            <Button onClick={() => navigate("/")}>Open Specdex</Button>
          </>
        )}
      </div>
    </div>
  );
}
