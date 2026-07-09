import { braindancePreset } from "./braindance";
import { witchHousePreset } from "./witchHouse";
import { ambientPreset } from "./ambient";
import type { Preset } from "./types";

export const presets: Preset[] = [braindancePreset, witchHousePreset, ambientPreset];

export type { Preset };
