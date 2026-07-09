import { technoPreset } from "./techno";
import { deconstructedClubPreset } from "./deconstructedClub";
import { ambientPreset } from "./stubs";
import type { Preset } from "./types";

export const presets: Preset[] = [technoPreset, deconstructedClubPreset, ambientPreset];

export type { Preset };
