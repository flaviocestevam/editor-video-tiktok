import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState } from "react";
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
    ],
  }),
  component: Index,
});

const API_URL = (import.meta.env.VITE_API_URL as string | undefined)?.replace(/\/$/, "") ?? "";

type Platform = "TikTok" | "YouTube Shorts" | "Instagram" | "Desconhecida";

type VideoItem = {
  id: string;
  name: string;
  source: "link" | "upload";
  platform?: Platform;
  originalUrl: string; // preview do original (blob p/ upload; url do link)
  editedUrl?: string; // url do vídeo processado (backend)
  downloadUrl?: string; // url para download
  status: "idle" | "processing" | "done" | "error";
  errorMessage?: string;
};

type HistoryItem = {
  id: string;
  name: string;
  platform?: Platform;
  source: "link" | "upload";
  editedUrl?: string;
  downloadUrl?: string;
  thumbnailUrl?: string;
  processedAt: number;
};

const HISTORY_KEY = "shorts-enhancer:history";

function stripHash(url: string): string {
  return url.split("#")[0];
}

function detectPlatform(url: string): Platform {
  const u = url.toLowerCase();
  if (u.includes("tiktok.com")) return "TikTok";
  if (u.includes("youtube.com/shorts") || u.includes("youtu.be") || u.includes("youtube.com"))
    return "YouTube Shorts";
  if (u.includes("instagram.com")) return "Instagram";
  return "Desconhecida";
}

function absoluteUrl(pathOrUrl: string): string {
  if (!pathOrUrl) return pathOrUrl;
  const cleanUrl = stripHash(pathOrUrl);
  if (/^https?:\/\//i.test(cleanUrl)) return cleanUrl;
  return `${API_URL}${cleanUrl.startsWith("/") ? "" : "/"}${cleanUrl}`;
}

function thumbnailTimes(video: HTMLVideoElement): number[] {
  const duration = Number.isFinite(video.duration) && video.duration > 0 ? video.duration : 6;
  return [0.42, 0.58, 0.28, 0.72, 0.86].map((ratio) =>
    Math.min(Math.max(duration * ratio, 0.75), Math.max(duration - 0.35, 0.75)),
  );
}

function captureFrame(video: HTMLVideoElement): string | null | undefined {
  if (!video.videoWidth || !video.videoHeight) return null;
  const canvas = document.createElement("canvas");
  const maxWidth = 360;
  const scale = Math.min(1, maxWidth / video.videoWidth);
  canvas.width = Math.max(1, Math.round(video.videoWidth * scale));
  canvas.height = Math.max(1, Math.round(video.videoHeight * scale));
  const ctx = canvas.getContext("2d", { willReadFrequently: true });
  if (!ctx) return null;

  try {
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
    const pixels = ctx.getImageData(0, 0, canvas.width, canvas.height).data;
    let brightness = 0;
    let samples = 0;
    const step = Math.max(4, Math.floor(pixels.length / 900));
    for (let i = 0; i < pixels.length; i += step * 4) {
      brightness += pixels[i] * 0.2126 + pixels[i + 1] * 0.7152 + pixels[i + 2] * 0.0722;
      samples += 1;
    }
    const averageBrightness = samples ? brightness / samples : 0;
    if (averageBrightness < 18) return null;
    return canvas.toDataURL("image/jpeg", 0.78);
  } catch {
    return undefined;
  }
}

function normalizeHistoryItem(item: HistoryItem): HistoryItem {
  return {
    ...item,
    editedUrl: item.editedUrl ? absoluteUrl(item.editedUrl) : undefined,
    downloadUrl: item.downloadUrl ? absoluteUrl(item.downloadUrl) : undefined,
    thumbnailUrl: item.thumbnailUrl,
  };
}

type ApiPayload = Record<string, unknown>;

function stringField(data: ApiPayload, key: string): string | undefined {
  return typeof data[key] === "string" ? data[key] : undefined;
}

function extractProcessedUrl(data: unknown): { editedUrl?: string; downloadUrl?: string } {
  if (!data || typeof data !== "object") return {};
  const payload = data as ApiPayload;
  const filename =
    stringField(payload, "processed_filename") ||
    stringField(payload, "output_filename") ||
    stringField(payload, "result_filename") ||
    stringField(payload, "filename");
  let edited: string | undefined =
    stringField(payload, "processed_url") ||
    stringField(payload, "output_url") ||
    stringField(payload, "video_url") ||
    stringField(payload, "url") ||
    stringField(payload, "edited_url") ||
    stringField(payload, "result_url");
  if (!edited && filename) edited = `/api/video/result/${filename}`;
  const download =
    stringField(payload, "download_url") || stringField(payload, "file_url") || edited;
  return {
    editedUrl: edited ? absoluteUrl(edited) : undefined,
    downloadUrl: download ? absoluteUrl(download) : undefined,
  };
}

async function parseError(res: Response): Promise<string> {
  const text = await res.text().catch(() => "");
  try {
    const j = JSON.parse(text);
    if (typeof j?.detail === "string") return j.detail;
    if (Array.isArray(j?.detail))
      return j.detail
        .map((detail: unknown) =>
          detail && typeof detail === "object" && "msg" in detail
            ? String((detail as { msg: unknown }).msg)
            : String(detail),
        )
        .join("; ");
    if (typeof j?.message === "string") return j.message;
    if (typeof j?.error === "string") return j.error;
  } catch {
    /* ignore */
  }
  return text || `HTTP ${res.status} ${res.statusText}`;
}

async function fetchWithTimeout(
  url: string,
  init: RequestInit = {},
  timeoutMs = 120_000,
): Promise<Response> {
  if (!API_URL) {
    throw new Error(
      "VITE_API_URL não está configurada. Defina no .env: VITE_API_URL=https://editor-video-tiktok-backend-production.up.railway.app",
    );
  }
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, { ...init, signal: controller.signal });
  } catch (err: unknown) {
    if (err instanceof Error && err.name === "AbortError") {
      throw new Error(
        `Tempo esgotado após ${Math.round(timeoutMs / 1000)}s. O servidor demorou demais para responder.`,
      );
    }
    if (err instanceof TypeError && /fetch/i.test(err.message)) {
      throw new Error(
        `Falha de rede ao acessar ${url}. Verifique sua conexão, se o backend está online e se o CORS está liberado.`,
      );
    }
    throw err;
  } finally {
    clearTimeout(timer);
  }
}

type EditOptions = {
  remove_audio: boolean;
  flip_horizontal: boolean;
  random_trim: boolean;
  crop_zoom: boolean;
  speed_change: boolean;
  color_adjust: boolean;
  fade: boolean;
};

const DEFAULT_EDITS: EditOptions = {
  remove_audio: false,
  flip_horizontal: true,
  random_trim: true,
  crop_zoom: true,
  speed_change: true,
  color_adjust: true,
  fade: true,
};

async function callProcess(fileId: string, opts: EditOptions): Promise<unknown> {
  const body = new URLSearchParams();
  body.set("file_id", fileId);
  (Object.keys(opts) as (keyof EditOptions)[]).forEach((k) => body.set(k, String(opts[k])));
  const res = await fetchWithTimeout(
    `${API_URL}/api/video/process`,
    {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded", Accept: "application/json" },
      body: body.toString(),
    },
    180_000,
  );
  if (!res.ok) throw new Error(await parseError(res));
  return res.json().catch(() => ({}));
}

function Index() {
  const [link, setLink] = useState("");
  const [videos, setVideos] = useState<VideoItem[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [edits, setEdits] = useState<EditOptions>(DEFAULT_EDITS);
  const setEdit = (k: keyof EditOptions, v: boolean) => setEdits((e) => ({ ...e, [k]: v }));
  const fileInputRef = useRef<HTMLInputElement>(null);

  const detectedPlatform = useMemo(
    () => (link.trim() ? detectPlatform(link.trim()) : null),
    [link],
  );

  const selected = videos.find((v) => v.id === selectedId) ?? null;
  const anyProcessing = videos.some((v) => v.status === "processing");

  const fileMap = useRef<Map<string, File>>(new Map());

  const [progress, setProgress] = useState(0);
  const [stageIdx, setStageIdx] = useState(0);
  const stages = [
    "Enviando vídeo ao servidor…",
    "Baixando vídeo…",
    "Analisando faixas de áudio e vídeo…",
    "Aplicando edições automáticas…",
    "Ajustando cor, brilho e contraste…",
    "Re-codificando vídeo (H.264 + AAC)…",
    "Quase pronto…",
  ];

  useEffect(() => {
    if (!anyProcessing) {
      if (progress > 0) setProgress(100);
      const t = setTimeout(() => {
        setProgress(0);
        setStageIdx(0);
      }, 800);
      return () => clearTimeout(t);
    }
    setProgress((p) => (p < 5 ? 5 : p));
    const id = setInterval(() => {
      setProgress((p) => {
        if (p >= 92) return p;
        // slow down as it gets higher
        const step = p < 40 ? 4 : p < 70 ? 2 : 1;
        return Math.min(92, p + step);
      });
      setStageIdx((s) => (s + 1) % stages.length);
    }, 1400);
    return () => clearInterval(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [anyProcessing]);

  const [history, setHistory] = useState<HistoryItem[]>([]);
  useEffect(() => {
    try {
      const raw = localStorage.getItem(HISTORY_KEY);
      if (raw) {
        const normalized = (JSON.parse(raw) as HistoryItem[]).map(normalizeHistoryItem);
        setHistory(normalized);
        persistHistory(normalized);
      }
    } catch {
      /* ignore */
    }
  }, []);
  const persistHistory = (h: HistoryItem[]) => {
    try {
      localStorage.setItem(HISTORY_KEY, JSON.stringify(h));
    } catch {
      /* ignore */
    }
  };
  const saveHistory = (h: HistoryItem[]) => {
    setHistory(h);
    persistHistory(h);
  };
  const addToHistory = (item: VideoItem) => {
    const entry: HistoryItem = {
      id: item.id,
      name: item.name,
      platform: item.platform,
      source: item.source,
      editedUrl: item.editedUrl,
      downloadUrl: item.downloadUrl,
      processedAt: Date.now(),
    };
    setHistory((prev) => {
      const next = [entry, ...prev.filter((h) => h.id !== item.id)].slice(0, 50);
      persistHistory(next);
      return next;
    });
  };

  const removeFromHistory = (id: string) => saveHistory(history.filter((h) => h.id !== id));
  const clearHistory = () => saveHistory([]);
  const updateHistoryThumbnail = (id: string, thumbnailUrl: string) => {
    setHistory((prev) => {
      const next = prev.map((h) => (h.id === id ? { ...h, thumbnailUrl } : h));
      persistHistory(next);
      return next;
    });
  };

  const updateVideo = (id: string, patch: Partial<VideoItem>) =>
    setVideos((vs) => vs.map((v) => (v.id === id ? { ...v, ...patch } : v)));

  const processUpload = async (item: VideoItem, file: File) => {
    updateVideo(item.id, { status: "processing", errorMessage: undefined });
    try {
      // Step 1: upload file → file_id
      const form = new FormData();
      form.append("file", file);
      const upRes = await fetchWithTimeout(
        `${API_URL}/api/video/upload`,
        { method: "POST", body: form, headers: { Accept: "application/json" } },
        180_000,
      );
      if (!upRes.ok) throw new Error(await parseError(upRes));
      const upData = await upRes.json().catch(() => ({}));
      const fileId = upData.file_id || upData.id;
      if (!fileId) throw new Error("Upload sem file_id na resposta");

      // Step 2: process
      const data = await callProcess(fileId, edits);
      const { editedUrl, downloadUrl } = extractProcessedUrl(data);
      if (!editedUrl) throw new Error("Backend não retornou URL do vídeo processado");
      const done = { ...item, status: "done" as const, editedUrl, downloadUrl };
      updateVideo(item.id, { status: "done", editedUrl, downloadUrl });
      addToHistory(done);
      toast.success(`"${item.name}" processado com sucesso!`);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Falha";
      updateVideo(item.id, { status: "error", errorMessage: msg });
      toast.error(`Erro ao processar: ${msg}`);
    }
  };

  const processLink = async (item: VideoItem) => {
    updateVideo(item.id, { status: "processing", errorMessage: undefined });
    try {
      // Step 1: download by link → file_id
      const body = new URLSearchParams();
      body.set("url", item.originalUrl);
      const dlRes = await fetchWithTimeout(
        `${API_URL}/api/video/download`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/x-www-form-urlencoded",
            Accept: "application/json",
          },
          body: body.toString(),
        },
        180_000,
      );
      if (!dlRes.ok) throw new Error(await parseError(dlRes));
      const dlData = await dlRes.json().catch(() => ({}));
      const fileId = dlData.file_id || dlData.id;
      if (!fileId) throw new Error("Download sem file_id na resposta");

      // Step 2: process
      const data = await callProcess(fileId, edits);
      const { editedUrl, downloadUrl } = extractProcessedUrl(data);
      if (!editedUrl) throw new Error("Backend não retornou URL do vídeo processado");
      const done = { ...item, status: "done" as const, editedUrl, downloadUrl };
      updateVideo(item.id, { status: "done", editedUrl, downloadUrl });
      addToHistory(done);
      toast.success(`Vídeo processado com sucesso!`);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Falha";
      updateVideo(item.id, { status: "error", errorMessage: msg });
      toast.error(`Erro ao processar: ${msg}`);
    }
  };

  const handleFiles = (files: FileList | null) => {
    if (!files || files.length === 0) return;
    const list = Array.from(files).filter((f) => f.type.startsWith("video/"));
    if (list.length === 0) {
      toast.error("Selecione arquivos de vídeo válidos (MP4).");
      return;
    }
    const created: VideoItem[] = list.map((f) => ({
      id: crypto.randomUUID(),
      name: f.name,
      source: "upload",
      originalUrl: URL.createObjectURL(f),
      status: "idle",
    }));
    created.forEach((item, idx) => fileMap.current.set(item.id, list[idx]));
    setVideos((v) => [...created, ...v]);
    setSelectedId(created[0].id);
    toast.success(`${created.length} vídeo(s) adicionado(s). Clique em "Iniciar" para processar.`);
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
      originalUrl: url,
      status: "idle",
    };
    setVideos((v) => [item, ...v]);
    setSelectedId(item.id);
    setLink("");
    toast.success(`Link adicionado (${platform}). Clique em "Iniciar" para processar.`);
  };

  const startVideo = (item: VideoItem) => {
    if (item.source === "upload") {
      const file = fileMap.current.get(item.id);
      if (!file) return toast.error("Arquivo indisponível, reenvie.");
      processUpload(item, file);
    } else {
      processLink(item);
    }
  };

  const startAll = () => {
    const pending = videos.filter((v) => v.status === "idle" || v.status === "error");
    if (pending.length === 0) return toast.info("Nada para processar.");
    toast.info(`Iniciando ${pending.length} vídeo(s)…`);
    pending.forEach(startVideo);
  };

  const removeVideo = (id: string) => {
    setVideos((vs) => vs.filter((v) => v.id !== id));
    if (selectedId === id) setSelectedId(null);
  };

  const downloadCount = videos.filter((v) => v.status === "done" && v.downloadUrl).length;

  const handleDownloadAll = () => {
    videos
      .filter((v) => v.status === "done" && v.downloadUrl)
      .forEach((v) => {
        const a = document.createElement("a");
        a.href = v.downloadUrl!;
        a.download = v.name || "video.mp4";
        a.target = "_blank";
        a.rel = "noopener";
        document.body.appendChild(a);
        a.click();
        a.remove();
      });
  };

  return (
    <div className="min-h-screen bg-background text-foreground">
      <Toaster theme="dark" position="top-right" richColors />

      <header className="border-b border-border/60 bg-gradient-to-b from-primary/5 to-transparent">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-5">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-fuchsia-500 to-indigo-500 shadow-lg shadow-fuchsia-500/20">
              <Film className="h-5 w-5 text-white" />
            </div>
            <div>
              <h1 className="text-lg font-semibold tracking-tight">Editor Vídeos TikTok</h1>
              <p className="text-xs text-muted-foreground">Edição criativa para vídeos curtos</p>
            </div>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-6xl space-y-8 px-4 py-8">
        {/* Import */}
        <section>
          <h2 className="mb-3 text-sm font-medium uppercase tracking-wider text-muted-foreground">
            1. Importar vídeo
          </h2>
          <div className="grid gap-4 md:grid-cols-2">
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
                  onKeyDown={(e) => {
                    if (e.key === "Enter") handleImportLink();
                  }}
                />
                <Button onClick={handleImportLink} className="h-11 px-5">
                  Adicionar
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
                disabled={anyProcessing}
                className="group flex h-[104px] w-full flex-col items-center justify-center gap-2 rounded-lg border-2 border-dashed border-border/70 bg-background/40 transition hover:border-indigo-400/70 hover:bg-indigo-500/5 disabled:opacity-60"
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
                onChange={(e) => {
                  handleFiles(e.target.files);
                  e.target.value = "";
                }}
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
                      {v.platform && (
                        <Badge variant="outline" className="h-4 px-1.5 text-[10px]">
                          {v.platform}
                        </Badge>
                      )}
                      {v.status === "processing" && (
                        <span className="flex items-center gap-1 text-indigo-300">
                          <Loader2 className="h-3 w-3 animate-spin" /> processando…
                        </span>
                      )}
                      {v.status === "done" && (
                        <span className="flex items-center gap-1 text-emerald-400">
                          <CheckCircle2 className="h-3 w-3" /> pronto
                        </span>
                      )}
                      {v.status === "idle" && (
                        <span className="text-muted-foreground">aguardando início</span>
                      )}
                      {v.status === "error" && (
                        <span className="text-destructive">erro: {v.errorMessage}</span>
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

        {/* Edits panel (options for the next request) */}
        <section>
          <h2 className="mb-3 text-sm font-medium uppercase tracking-wider text-muted-foreground">
            2. Edições automáticas aplicadas
          </h2>
          <Card className="border-border/60 bg-card/50 p-5">
            <p className="mb-3 text-xs text-muted-foreground">
              Ative/desative cada edição. Todas ativas por padrão para máxima diferença em relação
              ao original.
            </p>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {([
                { key: "flip_horizontal", icon: FlipHorizontal2, label: "Flip horizontal", hint: "Espelha o vídeo" },
                { key: "random_trim", icon: Scissors, label: "Cortes início/fim", hint: "Remove segundos das pontas" },
                { key: "crop_zoom", icon: Sparkles, label: "Crop / zoom suave", hint: "Reenquadra ~5-10%" },
                { key: "speed_change", icon: Gauge, label: "Velocidade 0.92x–1.08x", hint: "Altera ritmo do vídeo" },
                { key: "color_adjust", icon: Palette, label: "Cor, brilho, contraste", hint: "Ajustes de saturação" },
                { key: "fade", icon: Film, label: "Fade intro/outro", hint: "Fade in/out nas bordas" },
                { key: "remove_audio", icon: Music2, label: "Remover áudio", hint: "Silencia trilha original" },
              ] as { key: keyof EditOptions; icon: typeof Sparkles; label: string; hint: string }[]).map((f) => (
                <div
                  key={f.key}
                  className={`flex items-center justify-between gap-2 rounded-md border px-3 py-2 text-sm transition-colors ${
                    edits[f.key]
                      ? "border-fuchsia-500/40 bg-fuchsia-500/5"
                      : "border-border/50 bg-background/40 opacity-70"
                  }`}
                >
                  <Label htmlFor={`edit-${f.key}`} className="flex flex-1 items-center gap-2 cursor-pointer">
                    <f.icon className={`h-4 w-4 ${edits[f.key] ? "text-fuchsia-400" : "text-muted-foreground"}`} />
                    <span className="flex flex-col">
                      <span className="leading-tight">{f.label}</span>
                      <span className="text-[10px] text-muted-foreground">{f.hint}</span>
                    </span>
                  </Label>
                  <Switch
                    id={`edit-${f.key}`}
                    checked={edits[f.key]}
                    onCheckedChange={(v) => setEdit(f.key, v)}
                  />
                </div>
              ))}
            </div>
            <div className="mt-4 flex items-center justify-between text-xs text-muted-foreground">
              <span>
                {Object.values(edits).filter(Boolean).length} de 7 edições ativas
              </span>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setEdits(DEFAULT_EDITS)}
                  className="text-fuchsia-400 hover:underline"
                >
                  Padrão
                </button>
                <button
                  type="button"
                  onClick={() =>
                    setEdits({
                      remove_audio: false,
                      flip_horizontal: true,
                      random_trim: true,
                      crop_zoom: true,
                      speed_change: true,
                      color_adjust: true,
                      fade: true,
                    })
                  }
                  className="text-indigo-400 hover:underline"
                >
                  Ativar todas
                </button>
              </div>
            </div>


            {videos.length > 0 && (
              <div className="mt-6">
                <Button
                  onClick={startAll}
                  disabled={
                    anyProcessing ||
                    !videos.some((v) => v.status === "idle" || v.status === "error")
                  }
                  className="h-14 w-full bg-gradient-to-r from-fuchsia-500 to-indigo-500 text-base font-semibold shadow-lg shadow-fuchsia-500/20 hover:from-fuchsia-500/90 hover:to-indigo-500/90"
                >
                  {anyProcessing ? (
                    <>
                      <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                      Processando…
                    </>
                  ) : (
                    <>
                      <Play className="mr-2 h-5 w-5 fill-current" />▶ Iniciar Edições Automáticas
                      {videos.filter((v) => v.status === "idle" || v.status === "error").length >
                        1 &&
                        ` (${videos.filter((v) => v.status === "idle" || v.status === "error").length})`}
                    </>
                  )}
                </Button>
                <p className="mt-2 text-center text-xs text-muted-foreground">
                  {anyProcessing
                    ? "Isso pode levar alguns segundos por vídeo. Não feche a página."
                    : "Aplica todas as edições automáticas e prepara o download."}
                </p>
              </div>
            )}

            {(anyProcessing || progress > 0) && (
              <div className="mt-6 rounded-lg border border-fuchsia-500/30 bg-fuchsia-500/5 p-4">
                <div className="mb-2 flex items-center justify-between text-sm">
                  <div className="flex items-center gap-2 font-medium">
                    {anyProcessing ? (
                      <Loader2 className="h-4 w-4 animate-spin text-fuchsia-400" />
                    ) : (
                      <CheckCircle2 className="h-4 w-4 text-emerald-400" />
                    )}
                    <span className="animate-fade-in" key={stageIdx}>
                      {anyProcessing ? stages[stageIdx] : "Concluído!"}
                    </span>
                  </div>
                  <span className="tabular-nums font-semibold text-fuchsia-300">
                    {Math.round(progress)}%
                  </span>
                </div>
                <Progress value={progress} className="h-2.5" />
                <p className="mt-2 text-xs text-muted-foreground">
                  {anyProcessing
                    ? "Não feche a página — o processamento continua no servidor."
                    : "Seu vídeo está pronto para download abaixo."}
                </p>
              </div>
            )}
          </Card>
        </section>

        {/* Preview lado a lado (Original vs Editado) */}
        <section>
          <h2 className="mb-3 text-sm font-medium uppercase tracking-wider text-muted-foreground">
            3. Comparar Original × Editado
          </h2>
          <SideBySideCompare
            originalSrc={selected?.source === "upload" ? selected.originalUrl : undefined}
            editedSrc={selected?.editedUrl}
            editedLoading={selected?.status === "processing"}
            errorMessage={selected?.status === "error" ? selected.errorMessage : undefined}
            isLink={selected?.source === "link"}
          />
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
            <div className="flex gap-2">
              {selected?.downloadUrl && (
                <Button asChild variant="secondary" size="lg" className="h-11">
                  <a
                    href={selected.downloadUrl}
                    download={selected.name}
                    target="_blank"
                    rel="noopener"
                  >
                    <Download className="mr-2 h-4 w-4" />
                    Baixar selecionado
                  </a>
                </Button>
              )}
              <Button
                size="lg"
                disabled={downloadCount === 0}
                onClick={handleDownloadAll}
                className="h-11"
              >
                <Download className="mr-2 h-4 w-4" />
                Baixar {downloadCount || ""} vídeo(s)
              </Button>
            </div>
          </Card>
        </section>

        {/* History */}
        <section>
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-sm font-medium uppercase tracking-wider text-muted-foreground">
              Histórico de vídeos processados {history.length > 0 && `(${history.length})`}
            </h2>
            {history.length > 0 && (
              <Button variant="ghost" size="sm" onClick={clearHistory} className="text-xs">
                <Trash2 className="mr-1 h-3 w-3" /> Limpar histórico
              </Button>
            )}
          </div>
          {history.length === 0 ? (
            <Card className="border-dashed border-border/60 bg-card/30 p-8 text-center text-sm text-muted-foreground">
              Nenhum vídeo processado ainda. O histórico é salvo no seu navegador.
            </Card>
          ) : (
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {history.map((h) => (
                <Card key={h.id} className="overflow-hidden border-border/60 bg-card/50">
                  <div className="relative aspect-[9/16] max-h-56 w-full bg-black/60">
                    <HistoryThumbnail
                      item={h}
                      onThumbnail={(thumbnailUrl) => updateHistoryThumbnail(h.id, thumbnailUrl)}
                    />
                    {h.platform && (
                      <Badge className="absolute left-2 top-2 h-5 bg-black/60 px-2 text-[10px]">
                        {h.platform}
                      </Badge>
                    )}
                  </div>
                  <div className="p-3">
                    <div className="truncate text-sm font-medium" title={h.name}>
                      {h.name}
                    </div>
                    <div className="mt-0.5 text-xs text-muted-foreground">
                      {new Date(h.processedAt).toLocaleString("pt-BR")}
                    </div>
                    <div className="mt-3 flex gap-2">
                      {h.downloadUrl ? (
                        <Button asChild size="sm" className="flex-1">
                          <a href={h.downloadUrl} download={h.name} target="_blank" rel="noopener">
                            <Download className="mr-1.5 h-3.5 w-3.5" /> Baixar
                          </a>
                        </Button>
                      ) : (
                        <Button size="sm" className="flex-1" disabled>
                          Indisponível
                        </Button>
                      )}
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => removeFromHistory(h.id)}
                        className="text-muted-foreground hover:text-destructive"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  </div>
                </Card>
              ))}
            </div>
          )}
        </section>

        <footer className="pb-6 pt-4 text-center text-xs text-muted-foreground">
          Backend: {API_URL || "não configurado"}
        </footer>
      </main>
    </div>
  );
}


function HistoryThumbnail({
  item,
  onThumbnail,
}: {
  item: HistoryItem;
  onThumbnail: (thumbnailUrl: string) => void;
}) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const seekTimesRef = useRef<number[]>([]);
  const seekIndexRef = useRef(0);
  const [objectUrl, setObjectUrl] = useState<string | null>(null);
  const [loadingBlob, setLoadingBlob] = useState(false);
  const [previewFailed, setPreviewFailed] = useState(false);
  const [videoReady, setVideoReady] = useState(false);

  useEffect(() => {
    seekTimesRef.current = [];
    seekIndexRef.current = 0;
    setObjectUrl((current) => {
      if (current) URL.revokeObjectURL(current);
      return null;
    });
    setPreviewFailed(false);
    setVideoReady(false);
  }, [item.id, item.editedUrl, item.thumbnailUrl]);

  useEffect(() => {
    if (!item.editedUrl || item.thumbnailUrl) return;
    let cancelled = false;
    setLoadingBlob(true);
    fetch(item.editedUrl)
      .then((res) => {
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        return res.blob();
      })
      .then((blob) => {
        if (cancelled) return;
        setObjectUrl((current) => {
          if (current) URL.revokeObjectURL(current);
          return URL.createObjectURL(blob);
        });
      })
      .catch(() => {
        if (!cancelled) setPreviewFailed(true);
      })
      .finally(() => {
        if (!cancelled) setLoadingBlob(false);
      });
    return () => {
      cancelled = true;
    };
  }, [item.editedUrl, item.thumbnailUrl]);

  useEffect(() => {
    return () => {
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [objectUrl]);

  if (!item.editedUrl) {
    return (
      <div className="flex h-full items-center justify-center text-xs text-muted-foreground">
        Sem preview
      </div>
    );
  }

  if (item.thumbnailUrl) {
    return (
      <img
        src={item.thumbnailUrl}
        alt={`Miniatura de ${item.name}`}
        className="h-full w-full object-contain"
        loading="lazy"
      />
    );
  }

  const seekNextFrame = (video: HTMLVideoElement) => {
    if (seekTimesRef.current.length === 0) seekTimesRef.current = thumbnailTimes(video);
    const next = seekTimesRef.current[seekIndexRef.current];
    if (next === undefined) {
      setPreviewFailed(true);
      return;
    }
    seekIndexRef.current += 1;
    try {
      video.currentTime = next;
    } catch {
      seekNextFrame(video);
    }
  };

  const handleFrameReady = (video: HTMLVideoElement) => {
    setVideoReady(true);
    const frame = captureFrame(video);
    if (frame) {
      onThumbnail(frame);
      return;
    }
    if (frame === undefined) {
      if (seekTimesRef.current.length === 0) seekTimesRef.current = thumbnailTimes(video);
      if (seekIndexRef.current < Math.min(2, seekTimesRef.current.length)) {
        seekNextFrame(video);
      }
      return;
    }
    seekNextFrame(video);
  };

  const handlePlayablePreview = (video: HTMLVideoElement) => {
    handleFrameReady(video);
    video.muted = true;
    void video.play().catch(() => undefined);
  };

  return (
    <>
      <div
        className={`absolute inset-0 flex flex-col items-center justify-center gap-2 bg-[radial-gradient(circle_at_30%_20%,hsl(var(--primary)/0.45),transparent_34%),linear-gradient(135deg,hsl(var(--card)),hsl(var(--secondary)))] px-4 text-center transition-opacity ${
          videoReady && !previewFailed ? "opacity-0" : "opacity-100"
        }`}
      >
        <div className="flex h-12 w-12 items-center justify-center rounded-full border border-white/15 bg-white/10 shadow-lg">
          <Film className="h-6 w-6 text-fuchsia-200" />
        </div>
        <div className="max-w-[85%] truncate text-xs font-medium text-foreground">{item.name}</div>
        <div className="text-[10px] text-muted-foreground">
          {loadingBlob ? "Carregando prévia…" : previewFailed ? "Vídeo pronto para baixar" : "Preparando miniatura…"}
        </div>
      </div>
      <video
        ref={videoRef}
        src={objectUrl ? `${objectUrl}#t=2` : undefined}
        className={`h-full w-full object-contain transition-opacity ${videoReady && !previewFailed ? "opacity-100" : "opacity-0"}`}
        preload="auto"
        autoPlay
        loop
        muted
        playsInline
        onLoadedMetadata={(e) => seekNextFrame(e.currentTarget)}
        onLoadedData={(e) => handleFrameReady(e.currentTarget)}
        onCanPlay={(e) => handlePlayablePreview(e.currentTarget)}
        onSeeked={(e) => handleFrameReady(e.currentTarget)}
        onError={() => setPreviewFailed(true)}
      />
      <div className="pointer-events-none absolute inset-x-0 bottom-0 flex items-center justify-between bg-gradient-to-t from-black/80 to-transparent px-2 pb-2 pt-6 text-[10px] text-white/80">
        <span>{loadingBlob ? "Carregando prévia…" : videoReady ? "Prévia do vídeo" : "Vídeo processado"}</span>
        <Play className="h-3.5 w-3.5" />
      </div>
    </>
  );
}


function SideBySideCompare({
  originalSrc,
  editedSrc,
  editedLoading,
  errorMessage,
  isLink,
}: {
  originalSrc?: string;
  editedSrc?: string;
  editedLoading?: boolean;
  errorMessage?: string;
  isLink?: boolean;
}) {
  const originalRef = useRef<HTMLVideoElement>(null);
  const editedRef = useRef<HTMLVideoElement>(null);
  const [syncPlay, setSyncPlay] = useState(true);
  const [muted, setMuted] = useState(true);

  const playBoth = () => {
    originalRef.current?.play().catch(() => {});
    editedRef.current?.play().catch(() => {});
  };
  const pauseBoth = () => {
    originalRef.current?.pause();
    editedRef.current?.pause();
  };
  const restartBoth = () => {
    if (originalRef.current) originalRef.current.currentTime = 0;
    if (editedRef.current) editedRef.current.currentTime = 0;
    playBoth();
  };

  // sync from original -> edited (basic)
  useEffect(() => {
    if (!syncPlay) return;
    const o = originalRef.current;
    const e = editedRef.current;
    if (!o || !e) return;
    const onPlay = () => e.play().catch(() => {});
    const onPause = () => e.pause();
    const onSeek = () => {
      e.currentTime = o.currentTime;
    };
    o.addEventListener("play", onPlay);
    o.addEventListener("pause", onPause);
    o.addEventListener("seeked", onSeek);
    return () => {
      o.removeEventListener("play", onPlay);
      o.removeEventListener("pause", onPause);
      o.removeEventListener("seeked", onSeek);
    };
  }, [syncPlay, originalSrc, editedSrc]);

  const canCompare = !!originalSrc && !!editedSrc;

  return (
    <Card className="border-border/60 bg-card/50 p-4">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <div className="text-xs text-muted-foreground">
          {canCompare
            ? "Reproduza os dois vídeos ao mesmo tempo para ver as diferenças (flip, cor, velocidade, crop)."
            : isLink && editedSrc
              ? "Original do link não pode ser exibido no navegador — veja apenas o resultado editado."
              : "Selecione um vídeo processado para comparar."}
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <label className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <input
              type="checkbox"
              checked={syncPlay}
              onChange={(e) => setSyncPlay(e.target.checked)}
              className="h-3.5 w-3.5 accent-fuchsia-500"
            />
            Sincronizar
          </label>
          <label className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <input
              type="checkbox"
              checked={muted}
              onChange={(e) => setMuted(e.target.checked)}
              className="h-3.5 w-3.5 accent-fuchsia-500"
            />
            Mudo
          </label>
          <Button size="sm" variant="secondary" onClick={playBoth} disabled={!canCompare}>
            ▶ Play
          </Button>
          <Button size="sm" variant="secondary" onClick={pauseBoth} disabled={!canCompare}>
            ⏸ Pause
          </Button>
          <Button size="sm" variant="secondary" onClick={restartBoth} disabled={!canCompare}>
            ↺ Reiniciar
          </Button>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <div className="overflow-hidden rounded-md border border-border/50">
          <div className="flex items-center justify-between border-b border-border/50 bg-background/40 px-3 py-1.5">
            <span className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
              Original
            </span>
          </div>
          <div className="flex aspect-[9/16] max-h-[460px] w-full items-center justify-center bg-black">
            {originalSrc ? (
              <video
                ref={originalRef}
                src={originalSrc}
                controls
                muted={muted}
                playsInline
                className="h-full w-full object-contain"
              />
            ) : (
              <span className="px-4 text-center text-xs text-muted-foreground">
                {isLink
                  ? "Preview do original indisponível para links externos"
                  : "Nenhum vídeo selecionado"}
              </span>
            )}
          </div>
        </div>

        <div className="overflow-hidden rounded-md border border-fuchsia-500/40 ring-1 ring-fuchsia-500/20">
          <div className="flex items-center justify-between border-b border-fuchsia-500/30 bg-fuchsia-500/5 px-3 py-1.5">
            <span className="text-xs font-medium uppercase tracking-wider text-fuchsia-300">
              Editado
            </span>
            <Badge className="bg-fuchsia-500/20 text-fuchsia-300 hover:bg-fuchsia-500/20">
              novo
            </Badge>
          </div>
          <div className="flex aspect-[9/16] max-h-[460px] w-full items-center justify-center bg-black">
            {editedLoading ? (
              <div className="flex flex-col items-center gap-2 text-sm text-muted-foreground">
                <Loader2 className="h-6 w-6 animate-spin text-fuchsia-400" />
                Processando…
              </div>
            ) : editedSrc ? (
              <video
                ref={editedRef}
                src={editedSrc}
                controls
                muted={muted}
                playsInline
                crossOrigin="anonymous"
                className="h-full w-full object-contain"
              />
            ) : (
              <span className="px-4 text-center text-xs text-muted-foreground">
                {errorMessage ? `Erro: ${errorMessage}` : "Aguardando processamento"}
              </span>
            )}
          </div>
        </div>
      </div>
    </Card>
  );
}
