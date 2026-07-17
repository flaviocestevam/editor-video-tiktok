export type Position = "top" | "middle" | "bottom";

export type HumorMoment = {
  id: string;
  label: string;
  start: number;
  end: number;
  position: Position;
  suggestions: string[];
  selected_text: string;
  enabled: boolean;
};

export type HumorPlan = {
  duration: number;
  width: number;
  height: number;
  motion_peak: number;
  style: {
    font: string;
    max_lines: number;
    safe_width_percent: number;
  };
  moments: HumorMoment[];
};

export type Stage = "idle" | "uploading" | "planning" | "ready" | "rendering" | "done";
