type ProcessingReport = {
  engine?: string;
  attempt?: number;
  compatibility_mode?: number;
  processing_seconds?: number;
  impact_time?: number;
  impact_analysis?: {
    method?: string;
    scene_start?: number;
    scene_end?: number;
    scene_cuts?: number[];
  };
  replay?: {
    start?: number;
    end?: number;
    speed?: number;
    placed_after_principal_impact?: boolean;
    restricted_to_same_scene?: boolean;
  };
  final_pass?: {
    temporal_interpolation?: boolean;
    frame_rate_conversion?: boolean;
    text_bands_removed?: boolean;
    source_fps?: number;
    output_fps?: number;
    fade_in_out?: boolean;
    final_crf?: number;
    final_duration?: number;
  };
  applied_effects?: Record<string, boolean>;
  metadata?: { written?: boolean };
  warnings?: string[];
};

declare global {
  interface Window {
    __dynamicVisualEffectsFetchInstalled?: boolean;
  }
}

const EFFECT_LABELS: Record<string, string> = {
  flip_horizontal: "Flip horizontal",
  random_trim: "Cortes início/fim",
  crop_zoom: "Crop e zoom",
  color_adjust: "Cor e contraste",
  fade: "Fade",
  fade_in_out: "Fade de entrada e saída confirmado",
  sensor_noise: "Ruído de sensor",
  output_29_97_fps: "29,97 FPS",
  frame_rate_conversion: "Conversão de FPS sem interpolação",
  temporal_interpolation: "Interpolação temporal",
  smooth_motion: "Movimento de câmera",
  adaptive_sharpen: "Nitidez adaptativa",
  hard_cuts: "Cortes secos",
  speed_ramp: "Speed ramp",
  short_slowmo: "Câmera lenta",
  short_speedup: "Aceleração curta",
  freeze_frame: "Freeze frame",
  highlight_replay: "Replay",
  principal_impact_replay: "Replay do golpe principal na mesma cena",
  dynamic_reframe: "Reenquadramento dinâmico",
  animated_grain_overlay: "Granulado animado",
  scene_color_variation: "Cor variável por cena",
  light_texture_overlay: "Luz e textura em movimento",
  text_bands_removed: "Recorte de faixas de texto",
  audio_removed: "Áudio removido",
  audio_preserved: "Áudio preservado",
  custom_metadata: "Metadados personalizados confirmados",
};

function showProcessingReport(report: ProcessingReport): void {
  document.getElementById("processing-audit-report")?.remove();
  const active = Object.entries(report.applied_effects ?? {})
    .filter(([, enabled]) => enabled)
    .map(([key]) => EFFECT_LABELS[key] ?? key.replaceAll("_", " "));
  const warnings = report.warnings ?? [];
  const panel = document.createElement("aside");
  panel.id = "processing-audit-report";
  panel.style.cssText = [
    "position:fixed",
    "right:18px",
    "bottom:18px",
    "z-index:99999",
    "width:min(450px,calc(100vw - 36px))",
    "max-height:72vh",
    "overflow:auto",
    "background:rgba(15,18,28,.97)",
    "color:#fff",
    "border:1px solid rgba(34,197,94,.45)",
    "border-radius:14px",
    "padding:16px",
    "box-shadow:0 18px 60px rgba(0,0,0,.45)",
    "font:13px/1.45 system-ui,sans-serif",
  ].join(";");
  const warningHtml = warnings.length
    ? `<div style="margin-top:10px;padding:10px;border-radius:9px;background:rgba(245,158,11,.12);color:#fde68a"><strong>Avisos:</strong><br>${warnings.map((w) => `• ${w}`).join("<br>")}</div>`
    : "";
  const sceneStart = report.impact_analysis?.scene_start;
  const sceneEnd = report.impact_analysis?.scene_end;
  const impactHtml = typeof report.impact_time === "number"
    ? `<div style="margin-top:10px;padding:10px;border-radius:9px;background:rgba(34,197,94,.10)"><strong>Impacto escolhido:</strong> ${report.impact_time.toFixed(2)}s<br><strong>Cena protegida:</strong> ${sceneStart?.toFixed(2) ?? "?"}s–${sceneEnd?.toFixed(2) ?? "?"}s<br><strong>Replay:</strong> ${report.replay?.start?.toFixed(2) ?? "?"}s–${report.replay?.end?.toFixed(2) ?? "?"}s a ${report.replay?.speed ?? "?"}x, sem atravessar cortes.</div>`
    : "";
  const finalHtml = report.final_pass
    ? `<div style="margin-top:10px"><strong>FPS:</strong> ${report.final_pass.source_fps ?? "?"} → ${report.final_pass.output_fps ?? "?"}, sem interpolação<br><strong>Fade final:</strong> ${report.final_pass.fade_in_out ? "aplicado na duração real" : "desativado"}<br><strong>Qualidade final:</strong> CRF ${report.final_pass.final_crf ?? "?"}<br><strong>Recorte de texto:</strong> ${report.final_pass.text_bands_removed ? "ativado manualmente" : "desligado"}</div>`
    : "";
  panel.innerHTML = `
    <button type="button" aria-label="Fechar" style="float:right;border:0;background:transparent;color:#fff;font-size:20px;cursor:pointer">×</button>
    <div style="font-weight:800;font-size:15px;margin-bottom:4px">Relatório do modo estável</div>
    <div style="color:#86efac;margin-bottom:10px">Motor: ${report.engine ?? "não informado"} · tentativa ${report.attempt ?? 1} · ${report.processing_seconds ?? "?"}s</div>
    <div><strong>${active.length} efeitos confirmados:</strong></div>
    <div style="margin-top:6px;color:#d1d5db">${active.length ? active.map((name) => `✓ ${name}`).join("<br>") : "Nenhum efeito informado."}</div>
    <div style="margin-top:10px"><strong>Metadados:</strong> ${report.metadata?.written ? "confirmados no arquivo" : "não aplicados"}</div>
    ${impactHtml}
    ${finalHtml}
    ${warningHtml}
  `;
  panel.querySelector("button")?.addEventListener("click", () => panel.remove());
  document.body.appendChild(panel);
}

let defaultsLocked = false;

function lockUnsafeDefault(labelText: string, replacement: string, hint: string): boolean {
  const span = Array.from(document.querySelectorAll("span")).find(
    (item) => item.textContent?.trim() === labelText,
  );
  if (!span) return false;
  const label = span.closest("label");
  const control = label?.parentElement?.querySelector<HTMLButtonElement>('button[role="switch"]');
  if (control?.getAttribute("aria-checked") === "true") control.click();
  if (control) {
    control.disabled = true;
    control.title = "Desativado no modo estável";
  }
  span.textContent = replacement;
  const hintSpan = span.parentElement?.querySelectorAll("span")[1];
  if (hintSpan) hintSpan.textContent = hint;
  return true;
}

function refreshEditorLabels(): void {
  if (!defaultsLocked) {
    const flipReady = lockUnsafeDefault(
      "Flip horizontal",
      "Flip horizontal — desativado",
      "Evita inverter textos, placas e logotipos",
    );
    const fpsReady = lockUnsafeDefault(
      "29,97 FPS",
      "FPS original — preservado",
      "Evita ghosting e perda de nitidez",
    );
    defaultsLocked = flipReady && fpsReady;
  }

  document.querySelectorAll("span").forEach((span) => {
    const text = span.textContent?.trim();
    if (text === "Movimento suave") span.textContent = "Movimento de câmera";
    if (text === "Aplica zoom progressivo e deslocamento leve") span.textContent = "Zoom e deslocamento do enquadramento";
  });

  if (document.getElementById("impact-replay-engine-note")) return;
  const heading = Array.from(document.querySelectorAll("h2")).find((item) =>
    item.textContent?.includes("Edições automáticas aplicadas"),
  );
  const card = heading?.nextElementSibling;
  if (!card) return;
  const note = document.createElement("div");
  note.id = "impact-replay-engine-note";
  note.style.cssText = "margin-top:14px;padding:11px;border-radius:9px;border:1px solid rgba(34,197,94,.32);background:rgba(34,197,94,.08);font-size:12px;color:#bbf7d0";
  note.innerHTML = "<strong>Modo estável v8:</strong> mantém o FPS original, não espelha, não recorta texto e limita o replay à mesma cena do impacto. O fade usa a duração final e a última codificação prioriza qualidade.";
  card.appendChild(note);
}

if (typeof window !== "undefined" && !window.__dynamicVisualEffectsFetchInstalled) {
  window.__dynamicVisualEffectsFetchInstalled = true;
  const originalFetch = window.fetch.bind(window);
  const observer = new MutationObserver(refreshEditorLabels);
  observer.observe(document.documentElement, { childList: true, subtree: true });
  queueMicrotask(refreshEditorLabels);

  window.fetch = async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = typeof input === "string" ? input : input instanceof URL ? input.href : input.url;
    const body = init?.body;
    const isProcessing = url.includes("/api/video/process");

    if (isProcessing && body instanceof FormData) {
      body.set("dynamic_montage_enabled", "true");
      body.set("dynamic_reframe", "true");
      body.set("animated_grain_overlay", "true");
      body.set("scene_color_variation", "true");
      body.set("light_texture_overlay", "true");
      body.set("highlight_replay", "true");
      body.set("flip_horizontal", "false");
      body.set("output_fps", "source");
      body.set("remove_text_overlays", "false");
    }

    const response = await originalFetch(input, init);
    if (isProcessing && response.ok) {
      response
        .clone()
        .json()
        .then((payload: { processing_report?: ProcessingReport }) => {
          if (payload.processing_report) showProcessingReport(payload.processing_report);
        })
        .catch(() => undefined);
    }
    return response;
  };
}

export {};
