import { createFileRoute, Link } from "@tanstack/react-router";
import { useRef, useState } from "react";
import {
  ArrowLeft,
  Check,
  Film,
  Loader2,
  MessageSquareText,
} from "lucide-react";
import { toast, Toaster } from "sonner";

import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import {
  API_URL,
  absoluteUrl,
  createHumorPlan,
  downloadVideo,
  processVideoWithAllEdits,
  renderHumorVideo,
  uploadVideo,
} from "@/features/humor/api";
import { HumorImporter } from "@/features/humor/HumorImporter";
import { HumorMomentCard } from "@/features/humor/HumorMomentCard";
import { HumorPreview } from "@/features/humor/HumorPreview";
import { HumorResult } from "@/features/humor/HumorResult";
import type {
  HumorMoment,
  HumorPlan,
  Stage,
} from "@/features/humor/types";

export const Route = createFileRoute("/humor")({
  head: () => ({
    meta: [
      { title: "Tutorial Engraçado — Editor Vídeos TikTok" },
      {
        name: "description",
        content:
          "Edite o vídeo com as 19 funções e depois aprove manualmente as frases.",
      },
    ],
  }),
  component: HumorTutorial,
});

function HumorTutorial() {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [stage, setStage] = useState<Stage>("idle");
  const [link, setLink] = useState("");
  const [fileId, setFileId] = useState<string | null>(null);
  const [montageFilename, setMontageFilename] = useState<string | null>(null);
  const [sourceUrl, setSourceUrl] = useState<string | null>(null);
  const [fileName, setFileName] = useState("video-editado-com-legendas.mp4");
  const [plan, setPlan] = useState<HumorPlan | null>(null);
  const [moments, setMoments] = useState<HumorMoment[]>([]);
  const [currentTime, setCurrentTime] = useState(0);
  const [renderedUrl, setRenderedUrl] = useState<string | null>(null);

  const activeCount = moments.filter(
    (moment) => moment.enabled && moment.selected_text.trim(),
  ).length;
  const busy =
    stage === "uploading" || stage === "planning" || stage === "rendering";

  const updateMoment = (id: string, patch: Partial<HumorMoment>) => {
    setMoments((items) =>
      items.map((item) => (item.id === id ? { ...item, ...patch } : item)),
    );
  };

  const loadPlan = async (nextFileId: string) => {
    setStage("planning");

    // Mantém o editor original: primeiro aplica as 19 funções em /api/video/process.
    const processed = await processVideoWithAllEdits(nextFileId);

    // Depois analisa exatamente esse MP4, sem recriar ou trocar a montagem.
    const data = await createHumorPlan(processed.output_filename);
    if (data.preview_filename !== processed.output_filename) {
      throw new Error("O backend tentou substituir o vídeo já editado.");
    }

    setPlan(data);
    setMoments(data.moments);
    setMontageFilename(processed.output_filename);
    setSourceUrl(absoluteUrl(data.preview_url || processed.download_url));
    setStage("ready");
    toast.success(
      "As 19 edições foram concluídas. Agora escolha e edite as frases.",
    );
  };

  const resetPlan = () => {
    setRenderedUrl(null);
    setPlan(null);
    setMoments([]);
    setMontageFilename(null);
    setSourceUrl(null);
  };

  const handleFile = async (file: File) => {
    if (!API_URL) return toast.error("O backend Railway não está configurado.");
    resetPlan();
    setStage("uploading");
    setFileName(
      file.name.replace(/\.mp4$/i, "") + "-editado-com-legendas.mp4",
    );
    try {
      const nextFileId = await uploadVideo(file);
      setFileId(nextFileId);
      await loadPlan(nextFileId);
    } catch (error) {
      setStage("idle");
      toast.error(
        error instanceof Error ? error.message : "Falha ao editar o vídeo.",
      );
    }
  };

  const handleLink = async () => {
    const url = link.trim();
    if (!url) return toast.error("Cole um link primeiro.");
    if (!API_URL) return toast.error("O backend Railway não está configurado.");
    resetPlan();
    setStage("uploading");
    try {
      const nextFileId = await downloadVideo(url);
      setFileId(nextFileId);
      setFileName("video-editado-com-legendas.mp4");
      setLink("");
      await loadPlan(nextFileId);
    } catch (error) {
      setStage("idle");
      toast.error(
        error instanceof Error ? error.message : "Falha ao importar o vídeo.",
      );
    }
  };

  const playMoment = (moment: HumorMoment) => {
    if (!videoRef.current) return;
    videoRef.current.currentTime = moment.start;
    videoRef.current.play().catch(() => undefined);
  };

  const handleRender = async () => {
    if (!montageFilename) {
      return toast.error("O vídeo editado ainda não está pronto.");
    }
    setStage("rendering");
    try {
      const url = await renderHumorVideo(montageFilename, moments);
      setRenderedUrl(url);
      setStage("done");
      toast.success("As frases foram aplicadas no mesmo vídeo já editado.");
    } catch (error) {
      setStage("ready");
      toast.error(
        error instanceof Error ? error.message : "Falha ao aplicar as frases.",
      );
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
              <h1 className="text-lg font-semibold tracking-tight">
                Editor completo + frases
              </h1>
              <p className="text-xs text-muted-foreground">
                19 edições primeiro; legendas depois, no mesmo MP4
              </p>
            </div>
          </div>
          <Button asChild variant="ghost" size="sm">
            <Link to="/">
              <ArrowLeft className="mr-2 h-4 w-4" /> Editor principal
            </Link>
          </Button>
        </div>
      </header>

      <main className="mx-auto max-w-7xl space-y-7 px-4 py-7">
        <HumorImporter
          stage={stage}
          link={link}
          onLink={setLink}
          onImport={handleLink}
          onFile={handleFile}
        />

        {plan && sourceUrl && (
          <div className="grid gap-6 lg:grid-cols-[minmax(300px,420px)_1fr]">
            <HumorPreview
              sourceUrl={sourceUrl}
              currentTime={currentTime}
              moments={moments}
              videoRef={videoRef}
              onTime={setCurrentTime}
            />
            <div className="space-y-4">
              <div>
                <h2 className="text-lg font-semibold">
                  2. Aprove as frases e os momentos
                </h2>
                <p className="mt-1 text-sm text-muted-foreground">
                  A prévia é o vídeo que já passou pelas 19 opções. Esta etapa
                  adiciona somente os textos escolhidos.
                </p>
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
                    <div className="flex items-center gap-2 font-semibold">
                      <Check className="h-4 w-4 text-emerald-400" />
                      {activeCount} frases aprovadas
                    </div>
                    <p className="mt-1 text-sm text-muted-foreground">
                      Nenhuma edição anterior será refeita ou removida.
                    </p>
                  </div>
                  <Button
                    onClick={handleRender}
                    disabled={busy || activeCount === 0}
                    size="lg"
                    className="min-w-52 bg-gradient-to-r from-fuchsia-500 to-orange-400"
                  >
                    {stage === "rendering" ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        Aplicando textos…
                      </>
                    ) : (
                      <>
                        <Film className="mr-2 h-4 w-4" />
                        Finalizar vídeo completo
                      </>
                    )}
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
