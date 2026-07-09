import * as Tone from "tone";
import type { Preset } from "./types";
import { buildScaleNotes } from "../scales";

export const technoPreset: Preset = {
  id: "techno",
  label: "Techno",
  bpm: 128,
  enabled: true,
  description: "Four-on-the-floor kick, reese bass driven by blob count, hi-hats driven by edge density.",
  build(getAnalysis, getMusic) {
    const limiter = new Tone.Limiter(-1).toDestination();
    const reverb = new Tone.Freeverb({ roomSize: 0.7, dampening: 3000, wet: 0.16 }).connect(limiter);
    const distortion = new Tone.Distortion({ distortion: 0.25, wet: 0.12 }).connect(reverb);

    const kick = new Tone.MembraneSynth({
      pitchDecay: 0.045,
      octaves: 6,
      envelope: { attack: 0.001, decay: 0.35, sustain: 0, release: 0.4 },
    }).connect(limiter);

    const bass = new Tone.MonoSynth({
      oscillator: { type: "fatsawtooth", count: 3, spread: 25 },
      filter: { type: "lowpass", Q: 5, rolloff: -24 },
      envelope: { attack: 0.01, decay: 0.15, sustain: 0.6, release: 0.25 },
      filterEnvelope: {
        attack: 0.02,
        decay: 0.25,
        sustain: 0.35,
        release: 0.4,
        baseFrequency: 90,
        octaves: 3,
      },
    }).connect(distortion);
    bass.volume.value = -6;

    const hihatFilter = new Tone.Filter({ type: "highpass", frequency: 7500 }).connect(reverb);
    const hihat = new Tone.NoiseSynth({
      noise: { type: "white" },
      envelope: { attack: 0.001, decay: 0.045, sustain: 0 },
    }).connect(hihatFilter);
    hihat.volume.value = -14;

    let step = 0;
    const loop = new Tone.Loop((time) => {
      const analysis = getAnalysis();
      const s = step % 16;

      if (s === 0 || s === 4 || s === 8 || s === 12) {
        kick.triggerAttackRelease("C1", "8n", time);
      }

      if (s === 2 || s === 6 || s === 10 || s === 14) {
        const music = getMusic();
        const scale = buildScaleNotes(music.rootNote, music.scaleName);
        const blobCount = analysis.blobs.length;
        const note = scale[blobCount % scale.length];
        bass.filterEnvelope.baseFrequency = 60 + analysis.brightness * 400;
        bass.triggerAttackRelease(note, "8n", time, 0.85);
      }

      const hatProb = 0.28 + analysis.edgeDensity * 0.65;
      if (Math.random() < hatProb) {
        const vel = 0.15 + analysis.edgeDensity * 0.55;
        hihat.triggerAttackRelease("16n", time, vel);
      }

      step++;
    }, "16n").start(0);

    return () => {
      loop.dispose();
      kick.dispose();
      bass.dispose();
      hihat.dispose();
      hihatFilter.dispose();
      distortion.dispose();
      reverb.dispose();
      limiter.dispose();
    };
  },
};
