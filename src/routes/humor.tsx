import { createFileRoute, Link } from "@tanstack/react-router";
import { useRef, useState } from "react";
import { ArrowLeft, Check, Film, Loader2, MessageSquareText } from "lucide-react";
import { toast, Toaster } from "sonner";

import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { API_URL, createHumorPlan, downloadVideo, renderHumorVideo, uploadVideo } from "@/features/humor/api";
import { HumorImporter } from "@/features/humor/HumorImporter";
import { HumorMomentCard } from "@/features/humor/HumorMomentCard";
import { HumorPreview } from "@/features/humor/HumorPreview";
import { HumorResult } from "@/features/humor/HumorResult";
import type { HumorMoment, HumorPlan, Stage } from "@/features/humor/types";

export const Route = createFileRoute("/humor")({
  head: () => ({
    meta: [
      { title: "Tutorial Engraçado — Editor Vídeos TikTok" },
      { name: "description", content: "Crie tutoriais esportivos com sarcasmo e aprovação manual das frases." },
    ],
  }),
  component: HumorTutorial,
});

function HumorTutorial() {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [stage, setStage] = useState<Stage>("idle");
  const [link, setLink] = useState("");
  const [fileId, setFileId] = useState<string | null>(null);
  const [sourceUrl, setSourceUrl] = useState<string | null>(null);
  const [fileName, setFileName] = useState("tutorial-engracado.mp4");
  const [plan, setPlan] = useState<HumorPlan | null>(null);
  const [moments, setMoments] = useState<HumorMoment[]>([]);
  const [currentTime, setCurrentTime] = useState(0);
  const [renderedUrl, setRenderedUrl] = useState<string | null>(null);

  const activeCount = moments.filter((moment) => moment.enabled && moment.selected_text.trim()).length;
  const busy = stage === "uploading" || stage === "planning" || stage === "rendering";

  const updateMoment = (id: string, patch: Partial<HumorMoment>) => {
    setMoments((items) => items.map((item) => (item.id === id ? { ...item, ...patch } : item)));
  };

  const loadPlan = async (nextFileId: string) => {
    setStage("planning");
    const data = await createHumorPlan(nextFileId);
    setPlan(data);
    setMoments(data.moments);
    setStage("ready");
    toast.success("Momentos detectados. Escolha e edite as frases.");
  };

  const handleFile = async (file: File) => {
    if (!API_URL) return toast.error("VITE_API_URL não está configurada.");
    setRenderedUrl(null);
    setPlan(null);
    setMoments([]);
    setStage("uploading");
    setFileName(file.name.replace(/\.mp4$/i, "") + "-tutorial.mp4");
    setSourceUrl(URL.createObjectURL(file));
    try {
      const nextFileId = await uploadVideo(file);
      setFileId(nextFileId);
      await loadPlan(nextFileId);
    } catch (error) {
      setStage("idle");
      toast.error(error instanceof Error ? error.message : "Falha ao analisar o vídeo.");
    }
  };

  const handleLink = async () => {
    const url = link.trim();
    if (!url) return toast.error("Cole um link primeiro.");
    if (!API_URL) return toast.error("VITE_API_URL não está configurada.");
    setRenderedUrl(null);
    setPlan(null);
    setMoments([]);
    setStage("uploading");
    try {
      const nextFileId = await downloadVideo(url);
      setFileId(nextFileId);
      setSourceUrl(`${API_URL}/api/humor/source/${nextFileId}`);
      setFileName("tutorial-engracado.mp4");
      setLink("");
      await loadPlan(nextFileId);
    } catch (error) {
      setStage("idle");
      toast.error(error instanceof Error ? error.message : "Falha ao importar o vídeo.");
    }
  };

  const playMoment = (moment: HumorMoment) => {
    if (!videoRef.current) return;
    videoRef.current.currentTime = moment.start;
    videoRef.current.play().catch(() => undefined);
  };

  const handleRender = async () => {
    if (!fileId) return toast.error("Envie um vídeo primeiro.");
    setStage("rendering");
    try {
      const url = await renderHumorVideo(fileId, moments);
      setRenderedUrl(url);
      setStage("done");
      toast.success("Tutorial renderizado com as frases aprovadas.");
    } catch (error) {
      setStage("ready");
      toast.error(error instanceof Error ? error.message : "Falha ao renderizar.");
    }
  };

  return (
    <div className="min-h-screen bg-background text-foreground">
      <Toaster theme="dark" position="top-right" richColors />
      <header className="border-b border-border/60 bg-gradient-to-b from-fuchsia-500/10 to-transparent">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-5">
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-gradient-to-br from-fuchsia-500 to-orange-400 shadow-lg shadow-fuchsia-500/20">
              <MessageSquareText className="h-5 w-5 text-white" />
            </div>
            <div>
              <h1 className="text-lg font-semibold tracking-tight">Tutorial Engraçado</h1>
              <p className="text-xs text-muted-foreground">Sarcasmo, esporte, relacionamento e poder feminino</p>
            </div>
          </div>
          <Button asChild variant="ghost" size="sm"><Link to="/"><ArrowLeft className="mr-2 h-4 w-4" /> Editor principal</Link></Button>
        </div>
      </header>

      <main className="mx-auto max-w-7xl space-y-7 px-4 py-7">
        <HumorImporter stage={stage} link={link} onLink={setLink} onImport={handleLink} onFile={handleFile} />

        {plan && sourceUrl && (
          <div className="grid gap-6 lg:grid-cols-[minmax(300px,420px)_1fr]">
            <HumorPreview sourceUrl={sourceUrl} currentTime={currentTime} moments={moments} videoRef={videoRef} onTime={setCurrentTime} />
            <div className="space-y-4">
              <div>
                <h2 className="text-lg font-semibold">2. Aprove as frases e os momentos</h2>
                <p className="mt-1 text-sm text-muted-foreground">Quatro frases ficam ativas por padrão para manter o ritmo e evitar humor forçado.</p>
              </div>
              {moments.map((moment, index) => (
                <HumorMomentCard
                  key={moment.id}
                  moment={moment}
                  index={index}
                  duration={plan.duration}
                  onChange={(patch) => updateMoment(moment.id, patch)}
                  onPlay={() => playMoment(moment)}
                />
              ))}
              <Card className="border-emerald-500/25 bg-emerald-500/5 p-5">
                <div className="flex flex-col items-start justify-between gap-4 sm:flex-row sm:items-center">
                  <div>
                    <div className="flex items-center gap-2 font-semibold"><Check className="h-4 w-4 text-emerald-400" /> {activeCount} frases aprovadas</div>
                    <p className="mt-1 text-sm text-muted-foreground">O vídeo só será renderizado com as frases ativadas acima.</p>
                  </div>
                  <Button onClick={handleRender} disabled={busy || activeCount === 0} size="lg" className="min-w-52 bg-gradient-to-r from-fuchsia-500 to-orange-400">
                    {stage === "rendering" ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Renderizando…</> : <><Film className="mr-2 h-4 w-4" />Aprovar e renderizar</>}
                  </Button>
                </div>
              </Card>
            </div>
          </div>
        )}

        {renderedUrl && <HumorResult url={renderedUrl} fileName={fileName} />}
      </main>
    </div>
  );
}
