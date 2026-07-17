import type { HumorMoment, HumorPlan } from "./types";

const DEFAULT_API_URL =
  "https://editor-video-tiktok-backend-production.up.railway.app";

export const API_URL = (
  (import.meta.env.VITE_API_URL as string | undefined) ?? DEFAULT_API_URL
).replace(/\/$/, "");

export function absoluteUrl(pathOrUrl: string): string {
  if (/^https?:\/\//i.test(pathOrUrl)) return pathOrUrl;
  return `${API_URL}${pathOrUrl.startsWith("/") ? "" : "/"}${pathOrUrl}`;
}

async function readError(response: Response): Promise<string> {
  const text = await response.text().catch(() => "");
  try {
    const data = JSON.parse(text);
    if (typeof data?.detail === "string") return data.detail;
  } catch {
    // resposta não JSON
  }
  return text || `Erro HTTP ${response.status}`;
}

export async function uploadVideo(file: File): Promise<string> {
  const form = new FormData();
  form.set("file", file);
  const response = await fetch(`${API_URL}/api/video/upload`, {
    method: "POST",
    body: form,
    headers: { Accept: "application/json" },
  });
  if (!response.ok) throw new Error(await readError(response));
  const data = await response.json();
  if (!data.file_id) throw new Error("O backend não retornou file_id.");
  return data.file_id as string;
}

export async function downloadVideo(url: string): Promise<string> {
  const form = new FormData();
  form.set("url", url);
  const response = await fetch(`${API_URL}/api/video/download`, {
    method: "POST",
    body: form,
    headers: { Accept: "application/json" },
  });
  if (!response.ok) throw new Error(await readError(response));
  const data = await response.json();
  if (!data.file_id) throw new Error("O backend não retornou file_id.");
  return data.file_id as string;
}

export type ProcessedVideo = {
  output_filename: string;
  download_url: string;
};

export async function processVideoWithAllEdits(
  fileId: string,
): Promise<ProcessedVideo> {
  const form = new FormData();
  form.set("file_id", fileId);

  const enabledBooleans = [
    "remove_audio",
    "flip_horizontal",
    "random_trim",
    "crop_zoom",
    "speed_change",
    "color_adjust",
    "fade",
    "strip_metadata",
    "smooth_motion",
    "adaptive_sharpen",
    "dynamic_montage_enabled",
    "hard_cuts",
    "speed_ramp",
    "short_slowmo",
    "short_speedup",
    "freeze_frame",
    "highlight_replay",
  ];
  enabledBooleans.forEach((key) => form.set(key, "true"));

  form.set("sensor_noise", "2");
  form.set("crop_pixels", "4");
  form.set("zoom_factor", "1.02");
  form.set("hue_degrees", "1");
  form.set("color_grade", "cinematic");
  form.set("output_fps", "29.97");
  form.set("quality_crf", "18");

  const response = await fetch(`${API_URL}/api/video/process`, {
    method: "POST",
    body: form,
    headers: { Accept: "application/json" },
  });
  if (!response.ok) throw new Error(await readError(response));

  const data = await response.json();
  if (!data.output_filename) {
    throw new Error("O editor não retornou o vídeo processado.");
  }
  return {
    output_filename: data.output_filename as string,
    download_url: absoluteUrl(
      data.download_url || `/api/video/result/${data.output_filename}`,
    ),
  };
}

export async function createHumorPlan(
  montageFilename: string,
): Promise<HumorPlan> {
  const form = new FormData();
  form.set("montage_filename", montageFilename);
  const response = await fetch(`${API_URL}/api/humor/caption-plan`, {
    method: "POST",
    body: form,
    headers: { Accept: "application/json" },
  });
  if (!response.ok) throw new Error(await readError(response));
  return (await response.json()) as HumorPlan;
}

export async function renderHumorVideo(
  montageFilename: string,
  moments: HumorMoment[],
): Promise<string> {
  const script = moments
    .filter((moment) => moment.enabled && moment.selected_text.trim())
    .map((moment) => ({
      id: moment.id,
      text: moment.selected_text.trim(),
      start: moment.start,
      end: moment.end,
      position: moment.position,
      enabled: true,
    }));
  if (!script.length) throw new Error("Ative pelo menos uma frase.");

  const form = new FormData();
  form.set("montage_filename", montageFilename);
  form.set("script_json", JSON.stringify(script));
  form.set("quality_crf", "18");
  const response = await fetch(`${API_URL}/api/humor/caption-render`, {
    method: "POST",
    body: form,
    headers: { Accept: "application/json" },
  });
  if (!response.ok) throw new Error(await readError(response));
  const data = await response.json();
  return absoluteUrl(
    data.download_url || `/api/video/result/${data.output_filename}`,
  );
}
