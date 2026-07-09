import * as Tone from "tone";
import type { Preset } from "./types";
import { buildScaleNotes } from "../scales";

export const ambientPreset: Preset = {
  id: "ambient",
  label: "Ambient",
  bpm: 85,
  enabled: true,
  description:
    "Ecco2k PXE-inspired: a glassy autotune-like lead follows blob movement over slow pad chords, intimate plucked textures scan the frame, and glitch stutters bite on contrast spikes.",
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

    const pluck = new Tone.PluckSynth({ attackNoise: 0.5, dampening: 3200, resonance: 0.85 }).connect(delay);
    pluck.volume.value = -10;

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

      const scanEdge = analysis.columns[s % 16] ?? 0;
      if (scanEdge > 0.14 && Math.random() < 0.5) {
        const note = scale[(s + blobCount) % scale.length];
        pluck.triggerAttack(note, time);
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
      pluck.dispose();
      glitch.dispose();
      glitchCrush.dispose();
      delay.dispose();
      reverb.dispose();
      limiter.dispose();
    };
  },
};
