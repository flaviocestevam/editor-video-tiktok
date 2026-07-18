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
    applied?: boolean;
    fallback_kept_montage?: boolean;
    compatibility_mode?: number;
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

type ProcessPayload = {
  processing_report?: ProcessingReport;
  output_filename?: string;
  processed_filename?: string;
  download_url?: string;
  processed_url?: string;
  output_url?: string;
};

type CachedVideo = {
  blob: Blob;
  savedAt: number;
};

declare global {
  interface Window {
    __dynamicVisualEffectsFetchInstalled?: boolean;
  }
}

const VIDEO_CACHE_DB = "shorts-enhancer-video-cache-v1";
const VIDEO_CACHE_STORE = "videos";
const VIDEO_CACHE_LIMIT = 25;

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

function showNotice(message: string, error = false): void {
  const id = "video-download-notice";
  document.getElementById(id)?.remove();
  const notice = document.createElement("div");
  notice.id = id;
  notice.textContent = message;
  notice.style.cssText = [
    "position:fixed",
    "left:50%",
    "bottom:24px",
    "transform:translateX(-50%)",
    "z-index:100001",
    "max-width:min(520px,calc(100vw - 32px))",
    "padding:12px 16px",
    "border-radius:10px",
    `background:${error ? "rgba(127,29,29,.97)" : "rgba(6,78,59,.97)"}`,
    `border:1px solid ${error ? "rgba(248,113,113,.55)" : "rgba(52,211,153,.55)"}`,
    "color:white",
    "box-shadow:0 16px 44px rgba(0,0,0,.45)",
    "font:600 13px/1.4 system-ui,sans-serif",
    "text-align:center",
  ].join(";");
  document.body.appendChild(notice);
  window.setTimeout(() => notice.remove(), error ? 7000 : 3000);
}

function openVideoCache(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (!("indexedDB" in window)) {
      reject(new Error("Armazenamento local de vídeos indisponível."));
      return;
    }
    const request = indexedDB.open(VIDEO_CACHE_DB, 1);
    request.onupgradeneeded = () => {
      const database = request.result;
      if (!database.objectStoreNames.contains(VIDEO_CACHE_STORE)) {
        database.createObjectStore(VIDEO_CACHE_STORE);
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error ?? new Error("Falha ao abrir o cache local."));
  });
}

async function putCachedVideo(key: string, blob: Blob): Promise<void> {
  const database = await openVideoCache();
  await new Promise<void>((resolve, reject) => {
    const transaction = database.transaction(VIDEO_CACHE_STORE, "readwrite");
    transaction.objectStore(VIDEO_CACHE_STORE).put({ blob, savedAt: Date.now() } satisfies CachedVideo, key);
    transaction.oncomplete = () => resolve();
    transaction.onerror = () => reject(transaction.error ?? new Error("Falha ao salvar o vídeo localmente."));
    transaction.onabort = () => reject(transaction.error ?? new Error("Cache local interrompido."));
  });
  database.close();
  void trimVideoCache();
}

async function getCachedVideo(key: string): Promise<Blob | undefined> {
  const database = await openVideoCache();
  const value = await new Promise<CachedVideo | undefined>((resolve, reject) => {
    const transaction = database.transaction(VIDEO_CACHE_STORE, "readonly");
    const request = transaction.objectStore(VIDEO_CACHE_STORE).get(key);
    request.onsuccess = () => resolve(request.result as CachedVideo | undefined);
    request.onerror = () => reject(request.error ?? new Error("Falha ao ler o vídeo local."));
  });
  database.close();
  return value?.blob;
}

async function trimVideoCache(): Promise<void> {
  try {
    const database = await openVideoCache();
    const entries = await new Promise<Array<{ key: IDBValidKey; savedAt: number }>>((resolve, reject) => {
      const transaction = database.transaction(VIDEO_CACHE_STORE, "readonly");
      const store = transaction.objectStore(VIDEO_CACHE_STORE);
      const request = store.openCursor();
      const found: Array<{ key: IDBValidKey; savedAt: number }> = [];
      request.onsuccess = () => {
        const cursor = request.result;
        if (!cursor) {
          resolve(found);
          return;
        }
        const value = cursor.value as CachedVideo | undefined;
        found.push({ key: cursor.key, savedAt: value?.savedAt ?? 0 });
        cursor.continue();
      };
      request.onerror = () => reject(request.error ?? new Error("Falha ao revisar o cache."));
    });
    if (entries.length > VIDEO_CACHE_LIMIT) {
      entries.sort((a, b) => b.savedAt - a.savedAt);
      const remove = entries.slice(VIDEO_CACHE_LIMIT);
      await new Promise<void>((resolve, reject) => {
        const transaction = database.transaction(VIDEO_CACHE_STORE, "readwrite");
        const store = transaction.objectStore(VIDEO_CACHE_STORE);
        remove.forEach((entry) => store.delete(entry.key));
        transaction.oncomplete = () => resolve();
        transaction.onerror = () => reject(transaction.error ?? new Error("Falha ao limpar o cache."));
      });
    }
    database.close();
  } catch {
    // O cache é uma proteção extra; falhas não podem interromper o editor.
  }
}

function cacheKeyFromUrl(url: string): string {
  try {
    const parsed = new URL(url, window.location.href);
    return decodeURIComponent(parsed.pathname.split("/").filter(Boolean).pop() ?? parsed.href);
  } catch {
    return url;
  }
}

function safeFilename(value: string | null | undefined, fallback: string): string {
  const raw = (value || fallback || "video-editado.mp4").split(/[\\/]/).pop() || "video-editado.mp4";
  const cleaned = raw.replace(/[<>:"/\\|?*\u0000-\u001F]/g, "_").trim();
  return cleaned.toLowerCase().endsWith(".mp4") ? cleaned : `${cleaned}.mp4`;
}

function triggerBlobDownload(blob: Blob, filename: string): void {
  const objectUrl = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = objectUrl;
  anchor.download = filename;
  anchor.style.display = "none";
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  window.setTimeout(() => URL.revokeObjectURL(objectUrl), 30_000);
}

async function fetchVideoBlob(
  url: string,
  nativeFetch: typeof window.fetch,
): Promise<Blob> {
  const response = await nativeFetch(url, {
    method: "GET",
    cache: "no-store",
    headers: { Accept: "video/mp4,application/octet-stream;q=0.9,*/*;q=0.8" },
  });
  if (!response.ok) {
    throw new Error(
      response.status === 404
        ? "O arquivo não existe mais no servidor. Vídeos antigos do Railway precisam ser processados novamente."
        : `Falha no download: HTTP ${response.status}`,
    );
  }
  const blob = await response.blob();
  if (!blob.size) throw new Error("O servidor retornou um arquivo vazio.");
  return blob.type.startsWith("video/") ? blob : blob.slice(0, blob.size, "video/mp4");
}

async function cacheProcessedVideo(
  url: string,
  nativeFetch: typeof window.fetch,
): Promise<void> {
  const key = cacheKeyFromUrl(url);
  try {
    const cached = await getCachedVideo(key).catch(() => undefined);
    if (cached?.size) return;
    const blob = await fetchVideoBlob(url, nativeFetch);
    await putCachedVideo(key, blob);
  } catch {
    // A ausência de cache não deve transformar um processamento concluído em erro.
  }
}

async function downloadVideo(
  url: string,
  filename: string,
  nativeFetch: typeof window.fetch,
): Promise<void> {
  const key = cacheKeyFromUrl(url);
  showNotice("Preparando o download…");
  try {
    let blob = await getCachedVideo(key).catch(() => undefined);
    if (!blob?.size) {
      blob = await fetchVideoBlob(url, nativeFetch);
      await putCachedVideo(key, blob).catch(() => undefined);
    }
    triggerBlobDownload(blob, filename);
    showNotice("Download iniciado.");
  } catch (error) {
    const message = error instanceof Error ? error.message : "Não foi possível baixar o vídeo.";
    showNotice(message, true);
  }
}

function resolveOutputUrl(payload: ProcessPayload, processUrl: string): string | undefined {
  const raw = payload.download_url || payload.processed_url || payload.output_url ||
    (payload.output_filename || payload.processed_filename
      ? `/api/video/result/${payload.output_filename || payload.processed_filename}`
      : undefined);
  if (!raw) return undefined;
  try {
    return new URL(raw, processUrl).href;
  } catch {
    return raw;
  }
}

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
    ? `<div style="margin-top:10px;padding:10px;border-radius:9px;background:rgba(245,158,11,.12);color:#fde68a"><strong>Avisos:</strong><br>${warnings.map((warning) => `• ${warning}`).join("<br>")}</div>`
    : "";
  const sceneStart = report.impact_analysis?.scene_start;
  const sceneEnd = report.impact_analysis?.scene_end;
  const impactHtml = typeof report.impact_time === "number"
    ? `<div style="margin-top:10px;padding:10px;border-radius:9px;background:rgba(34,197,94,.10)"><strong>Impacto escolhido:</strong> ${report.impact_time.toFixed(2)}s<br><strong>Cena protegida:</strong> ${sceneStart?.toFixed(2) ?? "?"}s–${sceneEnd?.toFixed(2) ?? "?"}s<br><strong>Replay:</strong> ${report.replay?.start?.toFixed(2) ?? "?"}s–${report.replay?.end?.toFixed(2) ?? "?"}s a ${report.replay?.speed ?? "?"}x, sem atravessar cortes.</div>`
    : "";
  const finalHtml = report.final_pass
    ? `<div style="margin-top:10px"><strong>Etapa final:</strong> ${report.final_pass.applied === false ? "montagem preservada pelo modo de segurança" : "concluída"}<br><strong>FPS:</strong> ${report.final_pass.source_fps ?? "?"} → ${report.final_pass.output_fps ?? "?"}, sem interpolação<br><strong>Fade final:</strong> ${report.final_pass.fade_in_out ? "aplicado na duração real" : "não aplicado"}<br><strong>Qualidade final:</strong> ${report.final_pass.final_crf ? `CRF ${report.final_pass.final_crf}` : "codificação principal preservada"}<br><strong>Recorte de texto:</strong> ${report.final_pass.text_bands_removed ? "ativado manualmente" : "desligado"}</div>`
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
  note.innerHTML = "<strong>Modo estável v9:</strong> mantém o FPS original, não espelha, limita o replay à mesma cena e protege o vídeo contra falhas da etapa final. Cada resultado também é salvo localmente no navegador para o botão de download continuar funcionando após reinícios do servidor.";
  card.appendChild(note);
}

if (typeof window !== "undefined" && !window.__dynamicVisualEffectsFetchInstalled) {
  window.__dynamicVisualEffectsFetchInstalled = true;
  const nativeFetch = window.fetch.bind(window);
  const observer = new MutationObserver(refreshEditorLabels);
  observer.observe(document.documentElement, { childList: true, subtree: true });
  queueMicrotask(refreshEditorLabels);

  document.addEventListener(
    "click",
    (event) => {
      const target = event.target instanceof Element ? event.target : null;
      const anchor = target?.closest<HTMLAnchorElement>("a[href]");
      if (!anchor?.href || !anchor.href.includes("/api/video/result/")) return;
      event.preventDefault();
      event.stopPropagation();
      const fallback = cacheKeyFromUrl(anchor.href);
      const filename = safeFilename(anchor.getAttribute("download"), fallback);
      void downloadVideo(anchor.href, filename, nativeFetch);
    },
    true,
  );

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

    const response = await nativeFetch(input, init);
    if (isProcessing && response.ok) {
      response
        .clone()
        .json()
        .then((payload: ProcessPayload) => {
          if (payload.processing_report) showProcessingReport(payload.processing_report);
          const outputUrl = resolveOutputUrl(payload, url);
          if (outputUrl) void cacheProcessedVideo(outputUrl, nativeFetch);
        })
        .catch(() => undefined);
    }
    return response;
  };
}

export {};
