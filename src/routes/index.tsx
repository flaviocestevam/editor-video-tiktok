import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useRef, useState } from "react";
import {
  Upload,
  Link2,
  Sparkles,
  Download,
  Play,
  Trash2,
  Loader2,
  CheckCircle2,
  Music2,
  FlipHorizontal2,
  Scissors,
  Gauge,
  Palette,
  Film,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { toast, Toaster } from "sonner";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Shorts Enhancer Studio — Edite e aprimore vídeos curtos" },
      {
        name: "description",
        content:
          "Importe, aprimore e exporte vídeos curtos do TikTok, YouTube Shorts e Instagram Reels com edições automáticas.",
      },
      { property: "og:title", content: "Shorts Enhancer Studio" },
      {
        property: "og:description",
        content:
          "Ferramenta criativa para editar e aprimorar vídeos curtos automaticamente.",
      },
    ],
  }),
  component: Index,
});

type Platform = "TikTok" | "YouTube Shorts" | "Instagram" | "Desconhecida";

type VideoItem = {
  id: string;
  name: string;
  source: "link" | "upload";
  platform?: Platform;
  url: string;
  duration?: number;
  editedUrl?: string;
  status: "idle" | "processing" | "done" | "error";
};

function detectPlatform(url: string): Platform {
  const u = url.toLowerCase();
  if (u.includes("tiktok.com")) return "TikTok";
  if (u.includes("youtube.com/shorts") || u.includes("youtu.be")) return "YouTube Shorts";
  if (u.includes("instagram.com")) return "Instagram";
  return "Desconhecida";
}

function formatDuration(sec?: number) {
  if (!sec || !isFinite(sec)) return "--:--";
  const m = Math.floor(sec / 60);
  const s = Math.floor(sec % 60);
  return `${m}:${s.toString().padStart(2, "0")}`;
}

function Index() {
  const [link, setLink] = useState("");
  const [videos, setVideos] = useState<VideoItem[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [progress, setProgress] = useState(0);
  const [processing, setProcessing] = useState(false);
  const [muteAudio, setMuteAudio] = useState(false);
  const [addIntroOutro, setAddIntroOutro] = useState(true);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const detectedPlatform = useMemo(
    () => (link.trim() ? detectPlatform(link.trim()) : null),
    [link],
  );

  const selected = videos.find((v) => v.id === selectedId) ?? null;

  const handleFiles = (files: FileList | null) => {
    if (!files || files.length === 0) return;
    const newItems: VideoItem[] = Array.from(files)
      .filter((f) => f.type.startsWith("video/"))
      .map((f) => ({
        id: crypto.randomUUID(),
        name: f.name,
        source: "upload",
        url: URL.createObjectURL(f),
        status: "idle",
      }));
    if (newItems.length === 0) {
      toast.error("Selecione arquivos de vídeo válidos (MP4).");
      return;
    }
    setVideos((v) => [...newItems, ...v]);
    setSelectedId(newItems[0].id);
    toast.success(`${newItems.length} vídeo(s) adicionado(s).`);
  };

  const handleImportLink = () => {
    const url = link.trim();
    if (!url) return toast.error("Cole um link de vídeo primeiro.");
    const platform = detectPlatform(url);
    const item: VideoItem = {
      id: crypto.randomUUID(),
      name: url.slice(0, 60) + (url.length > 60 ? "…" : ""),
      source: "link",
      platform,
      url,
      status: "idle",
    };
    setVideos((v) => [item, ...v]);
    setSelectedId(item.id);
    setLink("");
    toast.success(`Link importado (${platform}). Backend cuidará do download.`);
  };

  const handleApplyEdits = async () => {
    if (videos.length === 0) return toast.error("Adicione um vídeo antes.");
    setProcessing(true);
    setProgress(0);
    setVideos((vs) => vs.map((v) => ({ ...v, status: "processing" })));

    // Simulated progress — real work happens on the FastAPI backend.
    await new Promise<void>((resolve) => {
      let p = 0;
      const timer = setInterval(() => {
        p += Math.random() * 12 + 3;
        if (p >= 100) {
          p = 100;
          clearInterval(timer);
          resolve();
        }
        setProgress(Math.min(100, Math.round(p)));
      }, 250);
    });

    setVideos((vs) =>
      vs.map((v) => ({ ...v, status: "done", editedUrl: v.url })),
    );
    setProcessing(false);
    toast.success("Edições aplicadas com sucesso!");
  };

  const removeVideo = (id: string) => {
    setVideos((vs) => vs.filter((v) => v.id !== id));
    if (selectedId === id) setSelectedId(null);
  };

  return (
    <div className="min-h-screen bg-background text-foreground">
      <Toaster theme="dark" position="top-right" richColors />

      {/* Header */}
      <header className="border-b border-border/60 bg-gradient-to-b from-primary/5 to-transparent">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-5">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-fuchsia-500 to-indigo-500 shadow-lg shadow-fuchsia-500/20">
              <Film className="h-5 w-5 text-white" />
            </div>
            <div>
              <h1 className="text-lg font-semibold tracking-tight">
                Shorts Enhancer Studio
              </h1>
              <p className="text-xs text-muted-foreground">
                Edição criativa para vídeos curtos
              </p>
            </div>
          </div>
          <Badge variant="outline" className="hidden sm:inline-flex">
            Beta
          </Badge>
        </div>
      </header>

      <main className="mx-auto max-w-6xl space-y-8 px-4 py-8">
        {/* Import */}
        <section>
          <h2 className="mb-3 text-sm font-medium uppercase tracking-wider text-muted-foreground">
            1. Importar vídeo
          </h2>
          <div className="grid gap-4 md:grid-cols-2">
            {/* Link */}
            <Card className="border-border/60 bg-card/50 p-5 backdrop-blur">
              <div className="mb-3 flex items-center gap-2">
                <Link2 className="h-4 w-4 text-fuchsia-400" />
                <h3 className="font-medium">Colar link</h3>
              </div>
              <p className="mb-4 text-sm text-muted-foreground">
                TikTok, YouTube Shorts ou Instagram Reels
              </p>
              <div className="flex flex-col gap-3 sm:flex-row">
                <Input
                  placeholder="https://tiktok.com/@usuario/video/…"
                  value={link}
                  onChange={(e) => setLink(e.target.value)}
                  className="h-11 flex-1"
                />
                <Button onClick={handleImportLink} className="h-11 px-5">
                  Importar
                </Button>
              </div>
              {detectedPlatform && (
                <div className="mt-3 flex items-center gap-2 text-sm">
                  <CheckCircle2 className="h-4 w-4 text-emerald-400" />
                  <span className="text-muted-foreground">Plataforma detectada:</span>
                  <Badge variant="secondary">{detectedPlatform}</Badge>
                </div>
              )}
            </Card>

            {/* Upload */}
            <Card className="border-border/60 bg-card/50 p-5 backdrop-blur">
              <div className="mb-3 flex items-center gap-2">
                <Upload className="h-4 w-4 text-indigo-400" />
                <h3 className="font-medium">Upload manual</h3>
              </div>
              <p className="mb-4 text-sm text-muted-foreground">
                Selecione um ou vários arquivos MP4
              </p>
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="group flex h-[104px] w-full flex-col items-center justify-center gap-2 rounded-lg border-2 border-dashed border-border/70 bg-background/40 transition hover:border-indigo-400/70 hover:bg-indigo-500/5"
              >
                <Upload className="h-6 w-6 text-muted-foreground transition group-hover:text-indigo-400" />
                <span className="text-sm text-muted-foreground">
                  Clique para escolher arquivos MP4
                </span>
              </button>
              <input
                ref={fileInputRef}
                type="file"
                accept="video/mp4,video/*"
                multiple
                hidden
                onChange={(e) => handleFiles(e.target.files)}
              />
            </Card>
          </div>
        </section>

        {/* Videos list */}
        {videos.length > 0 && (
          <section>
            <h2 className="mb-3 text-sm font-medium uppercase tracking-wider text-muted-foreground">
              Seus vídeos ({videos.length})
            </h2>
            <div className="grid gap-2">
              {videos.map((v) => (
                <button
                  key={v.id}
                  onClick={() => setSelectedId(v.id)}
                  className={`flex items-center gap-3 rounded-lg border p-3 text-left transition ${
                    selectedId === v.id
                      ? "border-fuchsia-500/60 bg-fuchsia-500/5"
                      : "border-border/60 bg-card/40 hover:bg-card/70"
                  }`}
                >
                  <Play className="h-4 w-4 shrink-0 text-muted-foreground" />
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-sm font-medium">{v.name}</div>
                    <div className="mt-0.5 flex items-center gap-2 text-xs text-muted-foreground">
                      <span>{formatDuration(v.duration)}</span>
                      {v.platform && <Badge variant="outline" className="h-4 px-1.5 text-[10px]">{v.platform}</Badge>}
                      {v.status === "done" && (
                        <span className="flex items-center gap-1 text-emerald-400">
                          <CheckCircle2 className="h-3 w-3" /> pronto
                        </span>
                      )}
                    </div>
                  </div>
                  <span
                    role="button"
                    tabIndex={0}
                    onClick={(e) => {
                      e.stopPropagation();
                      removeVideo(v.id);
                    }}
                    className="rounded p-1.5 text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
                  >
                    <Trash2 className="h-4 w-4" />
                  </span>
                </button>
              ))}
            </div>
          </section>
        )}

        {/* Edits panel */}
        <section>
          <h2 className="mb-3 text-sm font-medium uppercase tracking-wider text-muted-foreground">
            2. Edições automáticas
          </h2>
          <Card className="border-border/60 bg-card/50 p-5">
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {[
                { icon: FlipHorizontal2, label: "Flip horizontal" },
                { icon: Scissors, label: "Cortes leves (início/fim)" },
                { icon: Sparkles, label: "Crop/zoom suave" },
                { icon: Gauge, label: "Velocidade 0.92x – 1.08x" },
                { icon: Palette, label: "Cor, brilho, contraste, saturação" },
                { icon: Film, label: "Re-encode máxima compatibilidade" },
              ].map((f) => (
                <div
                  key={f.label}
                  className="flex items-center gap-2 rounded-md border border-border/50 bg-background/40 px-3 py-2 text-sm"
                >
                  <f.icon className="h-4 w-4 text-fuchsia-400" />
                  {f.label}
                </div>
              ))}
            </div>

            <Separator className="my-5" />

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="flex items-center justify-between rounded-md border border-border/50 bg-background/40 px-3 py-2">
                <Label htmlFor="intro" className="flex items-center gap-2 text-sm">
                  <Sparkles className="h-4 w-4 text-indigo-400" /> Intro & outro (fade)
                </Label>
                <Switch id="intro" checked={addIntroOutro} onCheckedChange={setAddIntroOutro} />
              </div>
              <div className="flex items-center justify-between rounded-md border border-border/50 bg-background/40 px-3 py-2">
                <Label htmlFor="mute" className="flex items-center gap-2 text-sm">
                  <Music2 className="h-4 w-4 text-indigo-400" /> Remover áudio
                </Label>
                <Switch id="mute" checked={muteAudio} onCheckedChange={setMuteAudio} />
              </div>
            </div>

            <div className="mt-6">
              <Button
                size="lg"
                onClick={handleApplyEdits}
                disabled={processing || videos.length === 0}
                className="h-14 w-full bg-gradient-to-r from-fuchsia-500 to-indigo-500 text-base font-semibold shadow-lg shadow-fuchsia-500/20 hover:opacity-95"
              >
                {processing ? (
                  <>
                    <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                    Processando… {progress}%
                  </>
                ) : (
                  <>
                    <Sparkles className="mr-2 h-5 w-5" />
                    Aplicar Edições Automáticas
                  </>
                )}
              </Button>
              {processing && <Progress value={progress} className="mt-3 h-2" />}
            </div>
          </Card>
        </section>

        {/* Preview */}
        <section>
          <h2 className="mb-3 text-sm font-medium uppercase tracking-wider text-muted-foreground">
            3. Preview
          </h2>
          <div className="grid gap-4 md:grid-cols-2">
            <PreviewCard title="Original" src={selected?.source === "upload" ? selected.url : undefined} placeholder="Selecione um vídeo" />
            <PreviewCard title="Editado" src={selected?.editedUrl} placeholder="Aplique as edições" accent />
          </div>
        </section>

        {/* Export */}
        <section>
          <h2 className="mb-3 text-sm font-medium uppercase tracking-wider text-muted-foreground">
            4. Exportar
          </h2>
          <Card className="flex flex-col items-center justify-between gap-4 border-border/60 bg-card/50 p-5 sm:flex-row">
            <div>
              <div className="font-medium">Baixar vídeos editados</div>
              <div className="text-sm text-muted-foreground">
                Exportação em alta qualidade (MP4 H.264 + AAC)
              </div>
            </div>
            <Button
              size="lg"
              disabled={!videos.some((v) => v.status === "done")}
              className="h-11"
            >
              <Download className="mr-2 h-4 w-4" />
              Baixar {videos.filter((v) => v.status === "done").length || ""} vídeo(s)
            </Button>
          </Card>
        </section>

        <footer className="pb-6 pt-4 text-center text-xs text-muted-foreground">
          Backend em FastAPI — processamento real ocorre no servidor.
        </footer>
      </main>
    </div>
  );
}

function PreviewCard({
  title,
  src,
  placeholder,
  accent,
}: {
  title: string;
  src?: string;
  placeholder: string;
  accent?: boolean;
}) {
  return (
    <Card
      className={`overflow-hidden border-border/60 bg-card/50 ${
        accent ? "ring-1 ring-fuchsia-500/30" : ""
      }`}
    >
      <div className="flex items-center justify-between border-b border-border/60 px-4 py-2">
        <span className="text-sm font-medium">{title}</span>
        {accent && <Badge className="bg-fuchsia-500/20 text-fuchsia-300 hover:bg-fuchsia-500/20">novo</Badge>}
      </div>
      <div className="flex aspect-[9/16] max-h-[420px] w-full items-center justify-center bg-black/60">
        {src ? (
          <video src={src} controls className="h-full w-full object-contain" />
        ) : (
          <span className="text-sm text-muted-foreground">{placeholder}</span>
        )}
      </div>
    </Card>
  );
}
