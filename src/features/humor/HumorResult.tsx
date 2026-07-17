import { Download } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";

export function HumorResult({ url, fileName }: { url: string; fileName: string }) {
  return (
    <Card className="border-emerald-500/30 bg-emerald-500/5 p-5">
      <div className="grid items-center gap-5 md:grid-cols-[220px_1fr]">
        <video src={url} controls playsInline className="aspect-[9/16] max-h-80 w-full rounded-xl bg-black object-contain" />
        <div>
          <h2 className="text-lg font-semibold">3. Tutorial pronto</h2>
          <p className="mt-2 text-sm text-muted-foreground">A fonte, o contorno, a posição e os tempos foram aplicados conforme a prévia aprovada.</p>
          <Button asChild className="mt-4" size="lg">
            <a href={url} download={fileName} target="_blank" rel="noopener"><Download className="mr-2 h-4 w-4" /> Baixar vídeo</a>
          </Button>
        </div>
      </div>
    </Card>
  );
}
