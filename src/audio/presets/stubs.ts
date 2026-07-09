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

export const darkAmbientPreset = stub(
  "dark-ambient",
  "Dark Ambient",
  70,
  "Low drone + noise bed, brightness/contrast drive frequency drift. Coming soon.",
);

export const ambientPreset = stub(
  "ambient",
  "Ambient",
  90,
  "Sparse reverbed pads, blob movement speed drives pad volume envelope. Coming soon.",
);

export const noisePreset = stub(
  "noise",
  "Noise",
  110,
  "Granular/harsh texture, edge noise drives density and filter cutoff. Coming soon.",
);

export const jumpstylePreset = stub(
  "jumpstyle",
  "Jumpstyle",
  150,
  "Fast reverse bass stabs triggered by blob jump motion. Coming soon.",
);
