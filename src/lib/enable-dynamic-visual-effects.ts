type ProcessingReport = {
  engine?: string;
  attempt?: number;
  compatibility_mode?: number;
  processing_seconds?: number;
  impact_time?: number;
  replay?: {
    start?: number;
    end?: number;
    speed?: number;
    placed_after_principal_impact?: boolean;
  };
  final_pass?: {
    temporal_interpolation?: boolean;
    text_bands_removed?: boolean;
    source_fps?: number;
    output_fps?: number;
    fade_in_out?: boolean;
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
  temporal_interpolation: "FPS com interpolação temporal",
  smooth_motion: "Movimento de câmera",
  adaptive_sharpen: "Nitidez adaptativa",
  hard_cuts: "Cortes secos",
  speed_ramp: "Speed ramp",
  short_slowmo: "Câmera lenta",
  short_speedup: "Aceleração curta",
  freeze_frame: "Freeze frame",
  highlight_replay: "Replay",
  principal_impact_replay: "Replay do golpe principal em câmera lenta",
  dynamic_reframe: "Reenquadramento dinâmico",
  animated_grain_overlay: "Granulado animado",
  scene_color_variation: "Cor variável por cena",
  light_texture_overlay: "Luz e textura em movimento",
  text_bands_removed: "Faixas de textos e legendas removidas",
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
    "width:min(440px,calc(100vw - 36px))",
    "max-height:72vh",
    "overflow:auto",
    "background:rgba(15,18,28,.97)",
    "color:#fff",
    "border:1px solid rgba(217,70,239,.45)",
    "border-radius:14px",
    "padding:16px",
    "box-shadow:0 18px 60px rgba(0,0,0,.45)",
    "font:13px/1.45 system-ui,sans-serif",
  ].join(";");
  const warningHtml = warnings.length
    ? `<div style="margin-top:10px;padding:10px;border-radius:9px;background:rgba(245,158,11,.12);color:#fde68a"><strong>Avisos:</strong><br>${warnings.map((w) => `• ${w}`).join("<br>")}</div>`
    : "";
  const impactHtml = typeof report.impact_time === "number"
    ? `<div style="margin-top:10px;padding:10px;border-radius:9px;background:rgba(99,102,241,.12)"><strong>Melhor momento:</strong> ${report.impact_time.toFixed(2)}s<br><strong>Replay:</strong> ${report.replay?.start?.toFixed(2) ?? "?"}s–${report.replay?.end?.toFixed(2) ?? "?"}s a ${report.replay?.speed ?? "?"}x, colocado depois do golpe principal.</div>`
    : "";
  const fpsHtml = report.final_pass
    ? `<div style="margin-top:10px"><strong>FPS:</strong> ${report.final_pass.source_fps ?? "?"} → ${report.final_pass.output_fps ?? "?"}${report.final_pass.temporal_interpolation ? " com interpolação" : ""}<br><strong>Fade final:</strong> ${report.final_pass.fade_in_out ? "aplicado na duração real" : "desativado"}<br><strong>Textos:</strong> ${report.final_pass.text_bands_removed ? "faixas superior e inferior removidas" : "não removidos"}</div>`
    : "";
  panel.innerHTML = `
    <button type="button" aria-label="Fechar" style="float:right;border:0;background:transparent;color:#fff;font-size:20px;cursor:pointer">×</button>
    <div style="font-weight:800;font-size:15px;margin-bottom:4px">Relatório real do processamento</div>
    <div style="color:#c4b5fd;margin-bottom:10px">Motor: ${report.engine ?? "não informado"} · tentativa ${report.attempt ?? 1} · ${report.processing_seconds ?? "?"}s</div>
    <div><strong>${active.length} efeitos confirmados:</strong></div>
    <div style="margin-top:6px;color:#d1d5db">${active.length ? active.map((name) => `✓ ${name}`).join("<br>") : "Nenhum efeito informado."}</div>
    <div style="margin-top:10px"><strong>Metadados:</strong> ${report.metadata?.written ? "confirmados no arquivo" : "não aplicados"}</div>
    ${impactHtml}
    ${fpsHtml}
    ${warningHtml}
  `;
  panel.querySelector("button")?.addEventListener("click", () => panel.remove());
  document.body.appendChild(panel);
}

function refreshEditorLabels(): void {
  document.querySelectorAll("span").forEach((span) => {
    const text = span.textContent?.trim();
    if (text === "29,97 FPS") span.textContent = "29,97 FPS interpolado";
    if (text === "Padroniza a taxa de quadros") span.textContent = "Cria quadros intermediários em vez de repetir frames";
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
  note.style.cssText = "margin-top:14px;padding:11px;border-radius:9px;border:1px solid rgba(99,102,241,.32);background:rgba(99,102,241,.08);font-size:12px;color:#c7d2fe";
  note.innerHTML = "<strong>Motor dinâmico:</strong> identifica o golpe principal, repete o momento depois do impacto em câmera lenta, remove faixas comuns de textos/legendas e aplica o fade usando a duração final real.";
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
      body.set("remove_text_overlays", "true");
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
