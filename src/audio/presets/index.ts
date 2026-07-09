import { technoPreset } from "./techno";
import { darkAmbientPreset, ambientPreset, noisePreset, jumpstylePreset } from "./stubs";
import type { Preset } from "./types";

export const presets: Preset[] = [
  technoPreset,
  darkAmbientPreset,
  ambientPreset,
  noisePreset,
  jumpstylePreset,
];

export type { Preset };
