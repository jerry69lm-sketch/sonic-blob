import * as Tone from "tone";
import type { Preset } from "./types";
import { buildScaleNotes } from "../scales";

export const ambientPreset: Preset = {
  id: "ambient",
  label: "Ambient",
  bpm: 85,
  enabled: true,
  description:
    "Ecco2k PXE: a glassy autotune-like lead follows blob movement over slow pad chords, bitcrushed vocal-chop stutters scan the frame with a pitch slide-off, and glitch bursts bite on contrast spikes.",
  build(getAnalysis, getMusic) {
    const limiter = new Tone.Limiter(-2).toDestination();
    const reverb = new Tone.Freeverb({ roomSize: 0.85, dampening: 3500, wet: 0.4 }).connect(limiter);
    const delay = new Tone.FeedbackDelay({ delayTime: "8n.", feedback: 0.35, wet: 0.22 }).connect(reverb);

    const pad = new Tone.PolySynth(Tone.Synth, {
      oscillator: { type: "sine" },
      envelope: { attack: 2.5, decay: 1, sustain: 0.8, release: 4 },
    }).connect(reverb);
    pad.volume.value = -16;

    const vibrato = new Tone.Vibrato({ frequency: 5, depth: 0.15 }).connect(delay);
    const lead = new Tone.FMSynth({
      harmonicity: 2,
      modulationIndex: 2.5,
      envelope: { attack: 0.15, decay: 0.4, sustain: 0.5, release: 1.2 },
      modulation: { type: "sine" },
    }).connect(vibrato);
    lead.volume.value = -12;

    const chopCrush = new Tone.BitCrusher(5).connect(delay);
    const chop = new Tone.FMSynth({
      harmonicity: 1.5,
      modulationIndex: 6,
      envelope: { attack: 0.001, decay: 0.09, sustain: 0, release: 0.03 },
      modulation: { type: "square" },
    }).connect(chopCrush);
    chop.volume.value = -9;

    const glitchCrush = new Tone.BitCrusher(3).connect(limiter);
    const glitch = new Tone.NoiseSynth({
      noise: { type: "pink" },
      envelope: { attack: 0.001, decay: 0.04, sustain: 0 },
    }).connect(glitchCrush);
    glitch.volume.value = -18;

    let step = 0;
    let prevContrast = 0;

    const loop = new Tone.Loop((time) => {
      const analysis = getAnalysis();
      const music = getMusic();
      const s = step % 32;
      const blobCount = analysis.blobs.length;
      const scale = buildScaleNotes(music.rootNote, music.scaleName, 2, 2);

      if (s === 0) {
        const voicing = [scale[0], scale[(2 + blobCount) % scale.length], scale[(4 + blobCount) % scale.length]];
        pad.triggerAttackRelease(voicing, "2m", time, 0.6);
      }

      if (s % 4 === 0 && analysis.brightness > 0.15 && Math.random() < 0.55) {
        const avgY = analysis.blobs.reduce((a, b) => a + b.y, 0) / Math.max(1, analysis.blobs.length);
        const idx = Math.floor((1 - avgY) * scale.length) % scale.length;
        lead.triggerAttackRelease(scale[idx] ?? scale[0], "4n", time, 0.35);
      }

      // bitcrushed vocal-chop stutter that slides pitch down, like an
      // autotuned syllable getting yanked off — scans one column per step
      const scanEdge = analysis.columns[s % 16] ?? 0;
      if (scanEdge > 0.14 && Math.random() < 0.5) {
        const note = scale[(s + blobCount) % scale.length];
        chop.triggerAttackRelease(note, "16n", time, 0.4 + scanEdge * 0.35);
        chop.frequency.rampTo(Tone.Frequency(note).transpose(-7).toFrequency(), 0.12, time + 0.02);
        if (Math.random() < 0.3) {
          chop.triggerAttackRelease(note, "32n", time + 0.055, 0.3);
        }
      }

      if (Math.abs(analysis.contrast - prevContrast) > 0.1) {
        glitch.triggerAttackRelease("32n", time, 0.3 + analysis.contrast * 0.3);
      }
      prevContrast = analysis.contrast;

      step++;
    }, "16n").start(0);

    return () => {
      loop.dispose();
      pad.dispose();
      lead.dispose();
      vibrato.dispose();
      chop.dispose();
      chopCrush.dispose();
      glitch.dispose();
      glitchCrush.dispose();
      delay.dispose();
      reverb.dispose();
      limiter.dispose();
    };
  },
};
