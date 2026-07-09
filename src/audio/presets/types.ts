import type { AnalysisState } from "../../analysis/types";
import type { MusicParams } from "../scales";

export interface Preset {
  id: string;
  label: string;
  bpm: number;
  enabled: boolean;
  description: string;
  build: (getAnalysis: () => AnalysisState, getMusic: () => MusicParams) => () => void;
}
