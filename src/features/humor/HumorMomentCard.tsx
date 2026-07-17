import { Play } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import type { HumorMoment, Position } from "./types";

function formatTime(value: number): string {
  const minutes = Math.floor(Math.max(0, value) / 60);
  const seconds = Math.max(0, value) - minutes * 60;
  return `${String(minutes).padStart(2, "0")}:${seconds.toFixed(2).padStart(5, "0")}`;
}

export function HumorMomentCard({
  moment,
  index,
  duration,
  onChange,
  onPlay,
}: {
  moment: HumorMoment;
  index: number;
  duration: number;
  onChange: (patch: Partial<HumorMoment>) => void;
  onPlay: () => void;
}) {
  return (
    <Card className={`border p-4 ${moment.enabled ? "border-fuchsia-500/35 bg-fuchsia-500/5" : "border-border/60 bg-card/40 opacity-75"}`}>
      <div className="flex items-start justify-between gap-3">
        <button type="button" onClick={onPlay} className="flex items-center gap-3 text-left">
          <span className="flex h-8 w-8 items-center justify-center rounded-full bg-background text-xs font-bold">{index + 1}</span>
          <span>
            <span className="block text-sm font-semibold">{moment.label}</span>
            <span className="text-xs text-muted-foreground">{formatTime(moment.start)} → {formatTime(moment.end)}</span>
          </span>
          <Play className="h-4 w-4 text-fuchsia-400" />
        </button>
        <Switch checked={moment.enabled} onCheckedChange={(enabled) => onChange({ enabled })} />
      </div>

      <div className="mt-4 grid gap-2">
        {moment.suggestions.map((suggestion) => (
          <button
            key={suggestion}
            type="button"
            disabled={!moment.enabled}
            onClick={() => onChange({ selected_text: suggestion })}
            className={`rounded-lg border px-3 py-2 text-left text-sm transition ${moment.selected_text === suggestion ? "border-fuchsia-400 bg-fuchsia-500/10" : "border-border/60 bg-background/40 hover:border-border"}`}
          >
            {suggestion}
          </button>
        ))}
      </div>

      <div className="mt-4 grid gap-3 sm:grid-cols-[1fr_150px]">
        <div>
          <Label htmlFor={`text-${moment.id}`} className="text-xs text-muted-foreground">Editar frase livremente</Label>
          <textarea
            id={`text-${moment.id}`}
            disabled={!moment.enabled}
            value={moment.selected_text}
            maxLength={150}
            onChange={(event) => onChange({ selected_text: event.target.value })}
            className="mt-1 min-h-20 w-full resize-y rounded-md border border-input bg-background px-3 py-2 text-sm outline-none focus:border-fuchsia-400"
          />
        </div>
        <div>
          <Label className="text-xs text-muted-foreground">Posição segura</Label>
          <select
            disabled={!moment.enabled}
            value={moment.position}
            onChange={(event) => onChange({ position: event.target.value as Position })}
            className="mt-1 h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
          >
            <option value="top">Topo</option>
            <option value="middle">Centro</option>
            <option value="bottom">Rodapé</option>
          </select>
          <div className="mt-3 grid grid-cols-2 gap-2">
            <div>
              <Label className="text-[10px] text-muted-foreground">Início</Label>
              <Input type="number" step="0.05" min="0" max={duration} value={moment.start} onChange={(event) => onChange({ start: Number(event.target.value) })} />
            </div>
            <div>
              <Label className="text-[10px] text-muted-foreground">Fim</Label>
              <Input type="number" step="0.05" min="0" max={duration} value={moment.end} onChange={(event) => onChange({ end: Number(event.target.value) })} />
            </div>
          </div>
        </div>
      </div>
    </Card>
  );
}
