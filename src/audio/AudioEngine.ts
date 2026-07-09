import * as Tone from "tone";
import { emptyAnalysis, type AnalysisState } from "../analysis/types";
import type { Preset } from "./presets/types";
import { defaultMusicParams, type MusicParams } from "./scales";

export class AudioEngine {
  private started = false;
  private analysis: AnalysisState = emptyAnalysis;
  private music: MusicParams = { ...defaultMusicParams };
  private disposeCurrent: (() => void) | null = null;
  currentPresetId: string | null = null;

  async start() {
    if (this.started) return;
    await Tone.start();
    this.started = true;
  }

  updateAnalysis(a: AnalysisState) {
    this.analysis = a;
  }

  updateMusicParams(m: Partial<MusicParams>) {
    this.music = { ...this.music, ...m };
  }

  setBpm(bpm: number) {
    Tone.Transport.bpm.value = bpm;
  }

  getBpm(): number {
    return Tone.Transport.bpm.value;
  }

  setPreset(preset: Preset) {
    this.disposeCurrent?.();
    this.disposeCurrent = null;
    Tone.Transport.stop();
    Tone.Transport.cancel();
    Tone.Transport.position = 0;
    Tone.Transport.bpm.value = preset.bpm;
    this.currentPresetId = preset.id;
    if (!preset.enabled) return;
    this.disposeCurrent = preset.build(
      () => this.analysis,
      () => this.music,
    );
    Tone.Transport.start();
  }

  stop() {
    Tone.Transport.stop();
    this.disposeCurrent?.();
    this.disposeCurrent = null;
    this.currentPresetId = null;
  }
}
