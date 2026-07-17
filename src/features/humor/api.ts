import type { HumorMoment, HumorPlan } from "./types";

export const API_URL =
  (import.meta.env.VITE_API_URL as string | undefined)?.replace(/\/$/, "") ?? "";

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

export async function createHumorPlan(fileId: string): Promise<HumorPlan> {
  const form = new FormData();
  form.set("file_id", fileId);
  const response = await fetch(`${API_URL}/api/humor/plan`, {
    method: "POST",
    body: form,
    headers: { Accept: "application/json" },
  });
  if (!response.ok) throw new Error(await readError(response));
  return (await response.json()) as HumorPlan;
}

export async function renderHumorVideo(fileId: string, moments: HumorMoment[]): Promise<string> {
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
  form.set("file_id", fileId);
  form.set("script_json", JSON.stringify(script));
  form.set("quality_crf", "18");
  const response = await fetch(`${API_URL}/api/humor/render`, {
    method: "POST",
    body: form,
    headers: { Accept: "application/json" },
  });
  if (!response.ok) throw new Error(await readError(response));
  const data = await response.json();
  return absoluteUrl(data.download_url || `/api/video/result/${data.output_filename}`);
}
