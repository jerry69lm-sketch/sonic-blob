import * as Tone from "tone";
import type { Preset } from "./types";
import { buildScaleNotes } from "../scales";

const KICK_STEPS = new Set([0, 3, 8, 11]);
const GHOST_STEPS = [1, 6, 9, 14];

export const deconstructedClubPreset: Preset = {
  id: "deconstructed-club",
  label: "Deconstructed Club",
  bpm: 145,
  enabled: true,
  description:
    "Kavari-inspired brutalist club: distorted glitch-jump sub, industrial metallic hits, a dark ambient drone bed, and noise blasts on contrast spikes.",
  build(getAnalysis, getMusic) {
    const limiter = new Tone.Limiter(-1).toDestination();
    const masterDistortion = new Tone.Distortion({ distortion: 0.5, wet: 0.35 }).connect(limiter);
    const reverb = new Tone.Freeverb({ roomSize: 0.8, dampening: 2000, wet: 0.2 }).connect(masterDistortion);

    const bassDistortion = new Tone.Distortion({ distortion: 0.7, wet: 0.5 }).connect(masterDistortion);
    const bassCrush = new Tone.BitCrusher(6).connect(bassDistortion);
    const bass = new Tone.MonoSynth({
      oscillator: { type: "square" },
      filter: { type: "lowpass", frequency: 500, Q: 4 },
      envelope: { attack: 0.001, decay: 0.2, sustain: 0.3, release: 0.15 },
      filterEnvelope: { attack: 0.001, decay: 0.1, sustain: 0.2, release: 0.1, baseFrequency: 80, octaves: 4 },
    }).connect(bassCrush);
    bass.volume.value = -4;

    const metal = new Tone.MetalSynth({
      envelope: { attack: 0.001, decay: 0.15, release: 0.05 },
      harmonicity: 5.1,
      modulationIndex: 22,
      resonance: 3000,
      octaves: 1.2,
    }).connect(masterDistortion);
    metal.volume.value = -14;

    const droneFilter = new Tone.Filter({ type: "lowpass", frequency: 300, Q: 1 }).connect(reverb);
    const drone = new Tone.FatOscillator({ type: "sawtooth", count: 3, spread: 40 }).connect(droneFilter);
    drone.volume.value = -20;
    drone.start();

    const noiseDistortion = new Tone.Distortion({ distortion: 0.8, wet: 0.6 }).connect(masterDistortion);
    const noiseBurst = new Tone.NoiseSynth({
      noise: { type: "white" },
      envelope: { attack: 0.001, decay: 0.3, sustain: 0 },
    }).connect(noiseDistortion);
    noiseBurst.volume.value = -16;

    let step = 0;
    let prevContrast = 0;

    const loop = new Tone.Loop((time) => {
      const analysis = getAnalysis();
      const music = getMusic();
      const s = step % 16;
      const blobCount = analysis.blobs.length;

      droneFilter.frequency.rampTo(150 + analysis.brightness * 900, 0.3);
      const droneScale = buildScaleNotes(music.rootNote, music.scaleName, -1, 1);
      drone.frequency.rampTo(Tone.Frequency(droneScale[0]).toFrequency(), 0.5);

      if (KICK_STEPS.has(s)) {
        const scale = buildScaleNotes(music.rootNote, music.scaleName, 0, 2);
        const note = scale[blobCount % scale.length];
        bass.triggerAttackRelease(note, "8n", time, 0.95);
      }
      if (GHOST_STEPS.includes(s) && Math.random() < 0.25 + analysis.contrast * 0.4) {
        bass.triggerAttackRelease("C1", "16n", time, 0.5);
      }

      if (s === 4 || s === 12) {
        metal.triggerAttackRelease("16n", time, 0.7);
      }

      // scan across the frame left-to-right, one column per step; the
      // metallic tick only fires where the scan crosses a real edge
      const scanEdge = analysis.columns[s] ?? 0;
      if (scanEdge > 0.18) {
        metal.triggerAttackRelease("32n", time, 0.15 + scanEdge * 0.4);
      }

      if (Math.abs(analysis.contrast - prevContrast) > 0.12) {
        noiseBurst.triggerAttackRelease("8n", time, 0.5 + analysis.contrast * 0.4);
      }
      prevContrast = analysis.contrast;

      step++;
    }, "16n").start(0);

    return () => {
      loop.dispose();
      bass.dispose();
      bassCrush.dispose();
      bassDistortion.dispose();
      metal.dispose();
      drone.dispose();
      droneFilter.dispose();
      noiseBurst.dispose();
      noiseDistortion.dispose();
      reverb.dispose();
      masterDistortion.dispose();
      limiter.dispose();
    };
  },
};
