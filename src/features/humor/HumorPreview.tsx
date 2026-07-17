import { useMemo, type CSSProperties, type RefObject } from "react";
import { Card } from "@/components/ui/card";
import type { HumorMoment, Position } from "./types";

function positionStyle(position: Position): CSSProperties {
  if (position === "top") return { top: "10%" };
  if (position === "middle") return { top: "50%", transform: "translate(-50%, -50%)" };
  return { bottom: "13%" };
}

function formatTime(value: number): string {
  const safe = Math.max(0, value || 0);
  const minutes = Math.floor(safe / 60);
  const seconds = safe - minutes * 60;
  return `${String(minutes).padStart(2, "0")}:${seconds.toFixed(2).padStart(5, "0")}`;
}

function wrapCaption(text: string): string {
  const clean = text.trim().replace(/\s+/g, " ");
  const maxChars = 24;
  if (clean.length <= maxChars) return clean;
  const words = clean.split(" ");
  let best: { score: number; first: string; second: string } | null = null;
  for (let index = 1; index < words.length; index += 1) {
    const first = words.slice(0, index).join(" ");
    const second = words.slice(index).join(" ");
    if (first.length <= maxChars + 5 && second.length <= maxChars + 5) {
      const score = Math.abs(first.length - second.length);
      if (!best || score < best.score) best = { score, first, second };
    }
  }
  if (best) return `${best.first}\n${best.second}`;
  const first = clean.slice(0, maxChars).trimEnd();
  const remaining = clean.slice(first.length).trim();
  const second = remaining.length > maxChars + 5 ? `${remaining.slice(0, maxChars + 2).trimEnd()}…` : remaining;
  return `${first}\n${second}`;
}

export function HumorPreview({
  sourceUrl,
  currentTime,
  moments,
  videoRef,
  onTime,
}: {
  sourceUrl: string;
  currentTime: number;
  moments: HumorMoment[];
  videoRef: RefObject<HTMLVideoElement | null>;
  onTime: (time: number) => void;
}) {
  const active = useMemo(
    () =>
      moments.find(
        (moment) => moment.enabled && currentTime >= moment.start && currentTime <= moment.end,
      ) ?? null,
    [moments, currentTime],
  );

  return (
    <div className="space-y-4 lg:sticky lg:top-5 lg:self-start">
      <Card className="overflow-hidden border-border/60 bg-black p-0">
        <div className="relative mx-auto aspect-[9/16] max-h-[76vh] w-full overflow-hidden bg-black">
          <video
            ref={videoRef}
            src={sourceUrl}
            controls
            playsInline
            className="h-full w-full object-contain"
            onTimeUpdate={(event) => onTime(event.currentTarget.currentTime)}
          />
          {active && (
            <div
              className="pointer-events-none absolute left-1/2 z-20 w-[84%] -translate-x-1/2 whitespace-pre-line rounded-xl bg-black/15 px-4 py-3 text-center text-white"
              style={{
                ...positionStyle(active.position),
                fontFamily: 'Lato, Inter, "Arial Black", sans-serif',
                fontWeight: 900,
                fontSize: "clamp(22px, 4vw, 46px)",
                lineHeight: 1,
                letterSpacing: "-0.03em",
                textShadow:
                  "-3px -3px 0 #000,3px -3px 0 #000,-3px 3px 0 #000,3px 3px 0 #000,0 5px 8px rgba(0,0,0,.85)",
              }}
            >
              {wrapCaption(active.selected_text)}
            </div>
          )}
        </div>
      </Card>
      <Card className="border-border/60 bg-card/50 p-4">
        <div className="flex items-center justify-between text-sm">
          <span className="text-muted-foreground">Prévia no tempo</span>
          <span className="font-mono">{formatTime(currentTime)}</span>
        </div>
        <div className="mt-3 grid grid-cols-3 gap-2 text-center text-xs">
          <div className="rounded-lg bg-background/50 p-2"><strong>Lato Heavy</strong><br />moderna</div>
          <div className="rounded-lg bg-background/50 p-2"><strong>84%</strong><br />área segura</div>
          <div className="rounded-lg bg-background/50 p-2"><strong>2 linhas</strong><br />máximo</div>
        </div>
      </Card>
    </div>
  );
}
