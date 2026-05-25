import type { JSX } from "react";
import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useToast } from "@/components/shared";
import { TEMPLATES, type KbTemplate } from "@/dev/templates";
import type { KbColorName } from "@/lib/theme";

type Step = 0 | 1 | 2 | 3;

export default function Onboarding(): JSX.Element {
  const [step, setStep] = useState<Step>(0);
  const [name, setName] = useState("");
  const [chosenTpl, setChosenTpl] = useState<KbTemplate>(TEMPLATES[0]!);
  const [kbName, setKbName] = useState(chosenTpl.name);
  const [kbDesc, setKbDesc] = useState(chosenTpl.description);
  const [color, setColor] = useState<KbColorName>("amber");
  const { push: _push } = useToast();
  const navigate = useNavigate();

  // The fields above become useful in Tasks 4–6; suppress unused-warning until then.
  void chosenTpl;
  void setChosenTpl;
  void kbName;
  void setKbName;
  void kbDesc;
  void setKbDesc;
  void color;
  void setColor;
  void _push;
  void navigate;

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
      </div>
    </div>
  );
}
