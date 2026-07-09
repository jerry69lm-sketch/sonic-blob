import type { Preset } from "./types";

function stub(id: string, label: string, bpm: number, description: string): Preset {
  return {
    id,
    label,
    bpm,
    enabled: false,
    description,
    build: () => () => {},
  };
}

export const ambientPreset = stub(
  "ambient",
  "Ambient",
  90,
  "Sparse reverbed pads, blob movement speed drives pad volume envelope. Coming soon.",
);
