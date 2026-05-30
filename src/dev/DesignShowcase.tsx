import type { JSX } from "react";
import { useState } from "react";
import { Loader2, Settings2 } from "lucide-react";
import { toast } from "sonner";
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
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Separator } from "@/components/ui/separator";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  HoverCard,
  HoverCardContent,
  HoverCardTrigger,
} from "@/components/ui/hover-card";
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb";
import { KbBadge, EmptyState, ConfirmModal } from "@/components/shared";
import { KB_COLOR_NAMES } from "@/lib/theme";

export function DesignShowcase(): JSX.Element {
  const [confirmOpen, setConfirmOpen] = useState(false);

  return (
    <TooltipProvider>
      <div className="min-h-screen bg-background text-foreground">
        <header className="border-b border-border px-6 py-4">
          <h1 className="text-2xl font-semibold">Specdex Design System</h1>
          <p className="text-sm text-muted-foreground">
            Phase 2 showcase — every primitive in both light and dark mode.
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
            <div className="flex flex-wrap items-center gap-2">
              <Button>Default</Button>
              <Button variant="secondary">Secondary</Button>
              <Button variant="outline">Outline</Button>
              <Button variant="ghost">Ghost</Button>
              <Button variant="destructive">Destructive</Button>
              <Button variant="link">Link</Button>
              <Button disabled>Disabled</Button>
              <Button size="icon" variant="outline" aria-label="Settings">
                <Settings2 />
              </Button>
            </div>
          </section>

          <section>
            <h2 className="mb-3 text-lg font-semibold">Badges</h2>
            <div className="flex flex-wrap gap-2">
              <Badge>Default</Badge>
              <Badge variant="secondary">Secondary</Badge>
              <Badge variant="outline">Outline</Badge>
              <Badge variant="destructive">Failed</Badge>
              <Badge variant="secondary">
                <Loader2 className="animate-spin" />
                Processing
              </Badge>
            </div>
          </section>

          <section>
            <h2 className="mb-3 text-lg font-semibold">Card</h2>
            <Card className="max-w-sm">
              <CardHeader>
                <CardTitle>Boeing Specs</CardTitle>
                <CardDescription>142 entries · amber highlights</CardDescription>
              </CardHeader>
              <CardContent className="text-sm text-muted-foreground">
                Cards use <code>rounded-xl</code>, a hairline border, and
                <code> shadow-sm</code> — depth from tone, not heavy shadows.
              </CardContent>
            </Card>
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
            <h2 className="mb-3 text-lg font-semibold">
              Overlays — dialog · dropdown · tooltip · hover card
            </h2>
            <div className="flex flex-wrap items-center gap-2">
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

              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="outline">Actions</Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="start">
                  <DropdownMenuLabel>Document</DropdownMenuLabel>
                  <DropdownMenuItem>Open</DropdownMenuItem>
                  <DropdownMenuItem>Re-ingest</DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem variant="destructive">Delete</DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>

              <Tooltip>
                <TooltipTrigger asChild>
                  <Button variant="ghost" size="icon" aria-label="Help">
                    <Settings2 />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>Collapsed-sidebar tooltip</TooltipContent>
              </Tooltip>

              <HoverCard>
                <HoverCardTrigger asChild>
                  <Button variant="link">Hover for entry</Button>
                </HoverCardTrigger>
                <HoverCardContent>
                  <p className="text-sm font-medium">BAC3082</p>
                  <p className="text-sm text-muted-foreground">
                    Surface preparation for anodize.
                  </p>
                </HoverCardContent>
              </HoverCard>
            </div>
          </section>

          <section>
            <h2 className="mb-3 text-lg font-semibold">Breadcrumb &amp; separator</h2>
            <Breadcrumb>
              <BreadcrumbList>
                <BreadcrumbItem>
                  <BreadcrumbLink href="#">Knowledge Bases</BreadcrumbLink>
                </BreadcrumbItem>
                <BreadcrumbSeparator />
                <BreadcrumbItem>
                  <BreadcrumbPage>Boeing Specs</BreadcrumbPage>
                </BreadcrumbItem>
              </BreadcrumbList>
            </Breadcrumb>
            <Separator className="my-4" />
            <div className="flex h-5 items-center gap-3 text-sm text-muted-foreground">
              <span>Solo</span>
              <Separator orientation="vertical" />
              <span>v0.1.0</span>
            </div>
          </section>

          <section>
            <h2 className="mb-3 text-lg font-semibold">Skeletons</h2>
            <div className="max-w-sm space-y-2">
              <Skeleton className="h-4 w-2/3" />
              <Skeleton className="h-4 w-full" />
              <Skeleton className="h-4 w-1/2" />
            </div>
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
            <h2 className="mb-3 text-lg font-semibold">Toasts (sonner)</h2>
            <div className="flex flex-wrap gap-2">
              <Button onClick={() => toast.success("Saved", { description: "Entry created." })}>
                Success
              </Button>
              <Button
                variant="outline"
                onClick={() => toast.info("Ingest started", { description: "3 file(s) queued." })}
              >
                Info
              </Button>
              <Button
                variant="outline"
                onClick={() => toast.warning("Possible duplicate")}
              >
                Warning
              </Button>
              <Button
                variant="destructive"
                onClick={() => toast.error("Delete failed", { description: "Disk is read-only." })}
              >
                Error
              </Button>
            </div>
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
    </TooltipProvider>
  );
}
