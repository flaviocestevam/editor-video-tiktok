import { Link2, Loader2, Sparkles, Upload } from "lucide-react";
import { useRef } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import type { Stage } from "./types";

export function HumorImporter({
  stage,
  link,
  onLink,
  onImport,
  onFile,
}: {
  stage: Stage;
  link: string;
  onLink: (value: string) => void;
  onImport: () => void;
  onFile: (file: File) => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const busy = stage === "uploading" || stage === "planning" || stage === "rendering";
  return (
    <Card className="border-border/60 bg-card/50 p-5">
      <div className="mb-4 flex items-start gap-3">
        <Sparkles className="mt-0.5 h-5 w-5 text-fuchsia-400" />
        <div>
          <h2 className="font-semibold">1. Envie o vídeo para analisar</h2>
          <p className="mt-1 text-sm text-muted-foreground">Nenhuma frase entra automaticamente. Você aprova, edita, move ou remove antes da renderização.</p>
        </div>
      </div>
      <div className="grid gap-4 md:grid-cols-2">
        <button
          type="button"
          disabled={busy}
          onClick={() => inputRef.current?.click()}
          className="flex min-h-28 flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed border-border/70 bg-background/40 transition hover:border-fuchsia-400/70 hover:bg-fuchsia-500/5 disabled:opacity-50"
        >
          {stage === "uploading" ? <Loader2 className="h-6 w-6 animate-spin" /> : <Upload className="h-6 w-6" />}
          <span className="text-sm font-medium">Escolher vídeo MP4</span>
        </button>
        <div className="flex min-h-28 flex-col justify-center gap-3 rounded-xl border border-border/60 bg-background/30 p-4">
          <div className="flex items-center gap-2 text-sm font-medium"><Link2 className="h-4 w-4 text-indigo-400" /> Importar por link</div>
          <div className="flex gap-2">
            <Input value={link} onChange={(event) => onLink(event.target.value)} placeholder="TikTok, Reels ou Shorts" />
            <Button onClick={onImport} disabled={busy}>Analisar</Button>
          </div>
        </div>
      </div>
      <input ref={inputRef} type="file" accept="video/mp4,video/*" hidden onChange={(event) => {
        const file = event.target.files?.[0];
        if (file) onFile(file);
        event.target.value = "";
      }} />
      {(stage === "uploading" || stage === "planning") && (
        <div className="mt-4 flex items-center gap-2 rounded-lg border border-fuchsia-500/30 bg-fuchsia-500/5 p-3 text-sm">
          <Loader2 className="h-4 w-4 animate-spin text-fuchsia-400" />
          {stage === "uploading" ? "Enviando vídeo…" : "Detectando movimento, freeze, replay e melhores momentos…"}
        </div>
      )}
    </Card>
  );
}
