import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { Skeleton } from "@/components/ui/skeleton"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip"
import { toast } from "@/hooks/use-toast"
import {
  Palette,
  Type,
  Layout,
  BellRing,
  Sparkles,
  Info,
  CheckCircle2,
  AlertTriangle,
  Flame,
  ArrowRight,
} from "lucide-react"

export function ComponentShowcase() {
  const [inputValue, setInputValue] = useState("")
  const [selectValue, setSelectValue] = useState("whisper-base")
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [dialogOpen, setDialogOpen] = useState(false)

  const handleSimulateAction = () => {
    setIsSubmitting(true)
    setTimeout(() => {
      setIsSubmitting(false)
      toast({
        title: "Action Executed",
        description: "Button loading state cleared successfully.",
        variant: "success",
      })
    }, 1200)
  }

  return (
    <div className="space-y-8 max-w-5xl">
      {/* Hero header */}
      <div className="border-b border-border pb-6">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              <span className="flex h-6 w-6 items-center justify-center rounded-md bg-accent-subtle text-accent border border-accent/20">
                <Sparkles className="h-3.5 w-3.5" />
              </span>
              <h2 className="text-xl font-bold tracking-tight text-text-primary">
                Obsidian AI Design System Showcase
              </h2>
            </div>
            <p className="mt-1 text-sm text-text-secondary">
              Component validation suite demonstrating tokens, interaction states, typography, and accessibility primitives.
            </p>
          </div>
          <Badge variant="violet" className="font-mono text-xs">
            Phase 1 Foundation Verified
          </Badge>
        </div>
      </div>

      {/* Surface and Color Palette */}
      <section className="space-y-3">
        <div className="flex items-center gap-2">
          <Palette className="h-4 w-4 text-accent" />
          <h3 className="text-sm font-semibold uppercase tracking-wider text-text-muted">
            1. Obsidian Semantic Palette & Surface Hierarchy
          </h3>
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 gap-3">
          <div className="rounded-lg border border-border bg-background p-3 flex flex-col justify-between h-24">
            <span className="text-xs font-mono text-text-muted">Canvas</span>
            <span className="text-xs font-semibold text-text-primary">Background</span>
          </div>
          <div className="rounded-lg border border-border bg-surface-1 p-3 flex flex-col justify-between h-24 shadow-xs">
            <span className="text-xs font-mono text-text-muted">Layer 1</span>
            <span className="text-xs font-semibold text-text-primary">Surface-1</span>
          </div>
          <div className="rounded-lg border border-border bg-surface-2 p-3 flex flex-col justify-between h-24 shadow-xs">
            <span className="text-xs font-mono text-text-muted">Layer 2</span>
            <span className="text-xs font-semibold text-text-primary">Surface-2</span>
          </div>
          <div className="rounded-lg border border-border bg-surface-3 p-3 flex flex-col justify-between h-24 shadow-xs">
            <span className="text-xs font-mono text-text-muted">Layer 3</span>
            <span className="text-xs font-semibold text-text-primary">Surface-3</span>
          </div>
          <div className="rounded-lg border border-accent/30 bg-accent-subtle p-3 flex flex-col justify-between h-24">
            <span className="text-xs font-mono text-accent">Restrained</span>
            <span className="text-xs font-semibold text-accent">Accent Violet</span>
          </div>
          <div className="rounded-lg border border-border bg-surface-1 p-3 flex flex-col justify-between h-24">
            <span className="text-xs font-mono text-text-muted">Divider</span>
            <span className="text-xs font-semibold text-text-secondary">Border 1px</span>
          </div>
        </div>
      </section>

      {/* Typography scale */}
      <section className="space-y-3">
        <div className="flex items-center gap-2">
          <Type className="h-4 w-4 text-accent" />
          <h3 className="text-sm font-semibold uppercase tracking-wider text-text-muted">
            2. Typography Scale
          </h3>
        </div>
        <div className="rounded-lg border border-border bg-surface-1 p-5 space-y-4">
          <div className="flex items-baseline justify-between border-b border-border/50 pb-2">
            <span className="text-2xl font-bold tracking-tight text-text-primary">
              Display Title: Voice Intelligence Platform
            </span>
            <span className="text-xs font-mono text-text-muted">2xl / Bold</span>
          </div>
          <div className="flex items-baseline justify-between border-b border-border/50 pb-2">
            <span className="text-lg font-semibold text-text-primary">
              Heading 1: Audio Transcript Segments & Insights
            </span>
            <span className="text-xs font-mono text-text-muted">lg / Semibold</span>
          </div>
          <div className="flex items-baseline justify-between border-b border-border/50 pb-2">
            <span className="text-sm font-medium text-text-primary">
              Heading 2 / Label: Active Model Runtime Configuration
            </span>
            <span className="text-xs font-mono text-text-muted">sm / Medium</span>
          </div>
          <div className="flex items-baseline justify-between border-b border-border/50 pb-2">
            <span className="text-sm text-text-secondary">
              Body text: VoxMind converts multi-speaker audio recordings into structured knowledge graphs.
            </span>
            <span className="text-xs font-mono text-text-muted">sm / Regular</span>
          </div>
          <div className="flex items-baseline justify-between">
            <span className="text-xs font-mono text-text-muted">
              Code / Timestamp: [00:14:28.400] speaker_01: "Ready for deployment."
            </span>
            <span className="text-xs font-mono text-text-muted">xs / Mono</span>
          </div>
        </div>
      </section>

      {/* Interactive Tabs */}
      <section className="space-y-3">
        <div className="flex items-center gap-2">
          <Layout className="h-4 w-4 text-accent" />
          <h3 className="text-sm font-semibold uppercase tracking-wider text-text-muted">
            3. Interactive Tabs, Buttons & Interaction States
          </h3>
        </div>

        <Tabs defaultValue="buttons" className="w-full">
          <TabsList className="grid w-full grid-cols-3 max-w-md">
            <TabsTrigger value="buttons">Buttons</TabsTrigger>
            <TabsTrigger value="inputs">Form Controls</TabsTrigger>
            <TabsTrigger value="badges">Badges & Feedback</TabsTrigger>
          </TabsList>

          {/* Buttons Content */}
          <TabsContent value="buttons" className="space-y-4 pt-3">
            <div className="rounded-lg border border-border bg-surface-1 p-5 space-y-5">
              <div>
                <h4 className="text-xs font-semibold text-text-muted uppercase tracking-wider mb-3">
                  Variants
                </h4>
                <div className="flex flex-wrap gap-2.5">
                  <Button variant="default">Primary Violet</Button>
                  <Button variant="secondary">Secondary Surface</Button>
                  <Button variant="outline">Outline</Button>
                  <Button variant="ghost">Ghost</Button>
                  <Button variant="subtle">Subtle Violet</Button>
                  <Button variant="destructive">Destructive</Button>
                </div>
              </div>

              <div>
                <h4 className="text-xs font-semibold text-text-muted uppercase tracking-wider mb-3">
                  Sizes & Icon Pairing
                </h4>
                <div className="flex flex-wrap items-center gap-2.5">
                  <Button size="sm">Small Action</Button>
                  <Button size="md">
                    Medium Default <ArrowRight className="w-4 h-4 ml-1" />
                  </Button>
                  <Button size="lg">Large Hero Action</Button>
                  <TooltipProvider>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Button size="icon" variant="outline" aria-label="Information">
                          <Info className="w-4 h-4" />
                        </Button>
                      </TooltipTrigger>
                      <TooltipContent>
                        <span>Accessible icon button tooltip</span>
                      </TooltipContent>
                    </Tooltip>
                  </TooltipProvider>
                </div>
              </div>

              <div>
                <h4 className="text-xs font-semibold text-text-muted uppercase tracking-wider mb-3">
                  Loading & Disabled States
                </h4>
                <div className="flex flex-wrap items-center gap-2.5">
                  <Button
                    isLoading={isSubmitting}
                    onClick={handleSimulateAction}
                  >
                    {isSubmitting ? "Processing..." : "Trigger Action State"}
                  </Button>
                  <Button disabled>Disabled Action</Button>
                  <Button variant="outline" disabled>Disabled Outline</Button>
                </div>
              </div>
            </div>
          </TabsContent>

          {/* Form Controls Content */}
          <TabsContent value="inputs" className="space-y-4 pt-3">
            <div className="rounded-lg border border-border bg-surface-1 p-5 space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="text-xs font-medium text-text-secondary mb-1.5 block">
                    Standard Text Input
                  </label>
                  <Input
                    placeholder="e.g. Weekly Strategy Sync..."
                    value={inputValue}
                    onChange={(e) => setInputValue(e.target.value)}
                    helperText="Input sanitized and validated client & server-side."
                  />
                </div>

                <div>
                  <label className="text-xs font-medium text-text-secondary mb-1.5 block">
                    Error State
                  </label>
                  <Input
                    defaultValue="invalid-format-input"
                    error
                    helperText="Title must be between 3 and 120 characters."
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="text-xs font-medium text-text-secondary mb-1.5 block">
                    Select Dropdown Primitive
                  </label>
                  <Select value={selectValue} onValueChange={setSelectValue}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select Whisper Model" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="whisper-tiny">faster-whisper: tiny (Fastest)</SelectItem>
                      <SelectItem value="whisper-base">faster-whisper: base (Balanced)</SelectItem>
                      <SelectItem value="whisper-small">faster-whisper: small (Accurate)</SelectItem>
                      <SelectItem value="whisper-medium">faster-whisper: medium (High Precision)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <label className="text-xs font-medium text-text-secondary mb-1.5 block">
                    Disabled Input
                  </label>
                  <Input disabled value="read-only-audio-stream-hash" />
                </div>
              </div>
            </div>
          </TabsContent>

          {/* Badges Content */}
          <TabsContent value="badges" className="space-y-4 pt-3">
            <div className="rounded-lg border border-border bg-surface-1 p-5 space-y-4">
              <div>
                <h4 className="text-xs font-semibold text-text-muted uppercase tracking-wider mb-3">
                  Status & Metadata Badges
                </h4>
                <div className="flex flex-wrap gap-2">
                  <Badge variant="default">Default</Badge>
                  <Badge variant="secondary">Secondary</Badge>
                  <Badge variant="outline">Outline</Badge>
                  <Badge variant="violet">Violet Accent</Badge>
                  <Badge variant="success">Ready / Transcribed</Badge>
                  <Badge variant="warning">Queued / Processing</Badge>
                  <Badge variant="danger">Failed / Retriable</Badge>
                </div>
              </div>

              <div>
                <h4 className="text-xs font-semibold text-text-muted uppercase tracking-wider mb-3">
                  Skeleton Loading Primitives
                </h4>
                <div className="space-y-2 max-w-md">
                  <Skeleton className="h-4 w-3/4" />
                  <Skeleton className="h-4 w-full" />
                  <Skeleton className="h-4 w-1/2" />
                </div>
              </div>
            </div>
          </TabsContent>
        </Tabs>
      </section>

      {/* Overlays: Dialog & Toasts */}
      <section className="space-y-3">
        <div className="flex items-center gap-2">
          <BellRing className="h-4 w-4 text-accent" />
          <h3 className="text-sm font-semibold uppercase tracking-wider text-text-muted">
            4. Modals, Notifications & Overlays
          </h3>
        </div>
        <div className="rounded-lg border border-border bg-surface-1 p-5 flex flex-wrap items-center gap-3">
          {/* Accessible Dialog */}
          <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
            <DialogTrigger asChild>
              <Button variant="secondary">Open Confirmation Dialog</Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Confirm Recording Deletion</DialogTitle>
                <DialogDescription>
                  This action cannot be undone. This will permanently delete the audio recording, generated transcripts, vector embeddings, and associated AI insights.
                </DialogDescription>
              </DialogHeader>
              <div className="p-3 rounded-md bg-surface-2 border border-border text-xs text-text-secondary space-y-1">
                <p className="font-semibold text-text-primary">Target: weekly_sync_2026-10-21.wav</p>
                <p>Storage Path: storage/uploads/usr_01/rec_92a18b.wav</p>
              </div>
              <DialogFooter>
                <Button variant="ghost" onClick={() => setDialogOpen(false)}>
                  Cancel
                </Button>
                <Button
                  variant="destructive"
                  onClick={() => {
                    setDialogOpen(false)
                    toast({
                      title: "Recording Deleted",
                      description: "The audio file and derived data were removed.",
                      variant: "danger",
                    })
                  }}
                >
                  Delete Recording
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>

          {/* Toast Notification Triggers */}
          <Button
            variant="outline"
            size="sm"
            onClick={() =>
              toast({
                title: "Job Queued",
                description: "Transcription task dispatched to Celery worker.",
                variant: "default",
              })
            }
          >
            <Info className="w-3.5 h-3.5 mr-1 text-accent" /> Info Toast
          </Button>

          <Button
            variant="outline"
            size="sm"
            onClick={() =>
              toast({
                title: "Transcription Complete",
                description: "Audio processed in 3.4 seconds with 98.2% confidence.",
                variant: "success",
              })
            }
          >
            <CheckCircle2 className="w-3.5 h-3.5 mr-1 text-success" /> Success Toast
          </Button>

          <Button
            variant="outline"
            size="sm"
            onClick={() =>
              toast({
                title: "Ollama Worker Offline",
                description: "Local model llama3.2 is not responding on :11434.",
                variant: "warning",
              })
            }
          >
            <AlertTriangle className="w-3.5 h-3.5 mr-1 text-warning" /> Warning Toast
          </Button>

          <Button
            variant="outline"
            size="sm"
            onClick={() =>
              toast({
                title: "Authentication Failed",
                description: "Invalid credentials or session expired.",
                variant: "danger",
              })
            }
          >
            <Flame className="w-3.5 h-3.5 mr-1 text-danger" /> Danger Toast
          </Button>
        </div>
      </section>
    </div>
  )
}
