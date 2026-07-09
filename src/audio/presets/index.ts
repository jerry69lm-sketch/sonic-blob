import { braindancePreset } from "./braindance";
import { deconstructedClubPreset } from "./deconstructedClub";
import { ambientPreset } from "./ambient";
import type { Preset } from "./types";

export const presets: Preset[] = [braindancePreset, deconstructedClubPreset, ambientPreset];

export type { Preset };
