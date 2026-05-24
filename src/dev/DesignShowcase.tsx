import type { JSX } from "react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { KbBadge, EmptyState, ToastHost, useToast, ConfirmModal } from "@/components/shared";
import { KB_COLOR_NAMES } from "@/lib/theme";

function ToastTrigger(): JSX.Element {
  const { push } = useToast();
  return (
    <Button
      onClick={() =>
        push({ title: "Toast fired", description: "This auto-dismisses.", variant: "success" })
      }
    >
      Fire toast
    </Button>
  );
}

export function DesignShowcase(): JSX.Element {
  const [confirmOpen, setConfirmOpen] = useState(false);

  return (
    <ToastHost>
      <div className="min-h-screen bg-background text-foreground">
        <header className="border-b border-border px-6 py-4">
          <h1 className="text-2xl font-semibold">Specdex Design System</h1>
          <p className="text-sm text-muted-foreground">
            Plan 03 showcase — every primitive in both light and dark mode.
          </p>
        </header>

        <main className="space-y-10 p-6">
          <section>
            <h2 className="mb-3 text-lg font-semibold">KB Highlight Palette</h2>
            <div className="flex flex-wrap gap-2">
              {KB_COLOR_NAMES.map((c) => (
                <KbBadge key={c} name={c} color={c} />
              ))}
            </div>
          </section>

          <section>
            <h2 className="mb-3 text-lg font-semibold">Buttons</h2>
            <div className="flex flex-wrap gap-2">
              <Button>Default</Button>
              <Button variant="secondary">Secondary</Button>
              <Button variant="outline">Outline</Button>
              <Button variant="ghost">Ghost</Button>
              <Button variant="destructive">Destructive</Button>
              <Button disabled>Disabled</Button>
            </div>
          </section>

          <section>
            <h2 className="mb-3 text-lg font-semibold">Form inputs</h2>
            <div className="grid max-w-md gap-3">
              <Input placeholder="Code (e.g. BAC3082)" />
              <Textarea placeholder="Definition" />
              <Select>
                <SelectTrigger>
                  <SelectValue placeholder="Category" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="material">Material</SelectItem>
                  <SelectItem value="process">Process</SelectItem>
                  <SelectItem value="finish">Finish</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </section>

          <section>
            <h2 className="mb-3 text-lg font-semibold">Tabs</h2>
            <Tabs defaultValue="entries" className="max-w-lg">
              <TabsList>
                <TabsTrigger value="entries">Entries</TabsTrigger>
                <TabsTrigger value="docs">In Documents</TabsTrigger>
              </TabsList>
              <TabsContent value="entries" className="text-sm text-muted-foreground">
                Search results across all KBs.
              </TabsContent>
              <TabsContent value="docs" className="text-sm text-muted-foreground">
                Search results across ingested source documents.
              </TabsContent>
            </Tabs>
          </section>

          <section>
            <h2 className="mb-3 text-lg font-semibold">Table</h2>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Code</TableHead>
                  <TableHead>Definition</TableHead>
                  <TableHead>Category</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                <TableRow>
                  <TableCell>BAC3082</TableCell>
                  <TableCell>Surface preparation for anodize.</TableCell>
                  <TableCell>process</TableCell>
                </TableRow>
                <TableRow>
                  <TableCell>AMS-C-5541</TableCell>
                  <TableCell>Chemical conversion coating, aluminum.</TableCell>
                  <TableCell>finish</TableCell>
                </TableRow>
              </TableBody>
            </Table>
          </section>

          <section>
            <h2 className="mb-3 text-lg font-semibold">Dialog</h2>
            <Dialog>
              <DialogTrigger asChild>
                <Button variant="outline">Open dialog</Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Hello from a dialog</DialogTitle>
                </DialogHeader>
                <p className="text-sm text-muted-foreground">
                  Used for entry editor, schema migration confirm, etc.
                </p>
              </DialogContent>
            </Dialog>
          </section>

          <section>
            <h2 className="mb-3 text-lg font-semibold">Confirm modal</h2>
            <Button variant="destructive" onClick={() => setConfirmOpen(true)}>
              Delete (asks for confirm)
            </Button>
            <ConfirmModal
              open={confirmOpen}
              title="Delete entry?"
              description="This cannot be undone."
              confirmLabel="Delete"
              destructive
              onConfirm={() => setConfirmOpen(false)}
              onCancel={() => setConfirmOpen(false)}
            />
          </section>

          <section>
            <h2 className="mb-3 text-lg font-semibold">Toast</h2>
            <ToastTrigger />
          </section>

          <section>
            <h2 className="mb-3 text-lg font-semibold">Empty state</h2>
            <EmptyState
              title="No knowledge bases yet"
              description="Create your first KB to start ingesting documents."
              action={<Button>Create KB</Button>}
            />
          </section>
        </main>
      </div>
    </ToastHost>
  );
}
