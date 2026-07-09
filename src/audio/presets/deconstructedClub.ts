import * as Tone from "tone";
import type { Preset } from "./types";
import { buildScaleNotes } from "../scales";

interface BarBeat {
  kick: boolean;
  crack: boolean;
  metal: boolean;
  screech: boolean;
}

function rollBar(density: number): BarBeat[] {
  const pattern: BarBeat[] = [];
  for (let i = 0; i < 16; i++) {
    pattern.push({
      kick: Math.random() < 0.22 + density * 0.3,
      crack: Math.random() < 0.15 + density * 0.35,
      metal: Math.random() < 0.12 + density * 0.25,
      screech: Math.random() < 0.04 + density * 0.08,
    });
  }
  return pattern;
}

export const deconstructedClubPreset: Preset = {
  id: "deconstructed-club",
  label: "Deconstructed Club",
  bpm: 145,
  enabled: true,
  description:
    "KAVARI-inspired: festival-banger fragments ripped apart and stitched back into overwhelming noise and crunch — whip-crack transients, screeches, sudden crashes, and a bass pattern that never lands the same way twice.",
  build(getAnalysis, getMusic) {
    const limiter = new Tone.Limiter(-1).toDestination();
    const masterDistortion = new Tone.Distortion({ distortion: 0.55, wet: 0.4 }).connect(limiter);

    const bassCrush = new Tone.BitCrusher(5).connect(masterDistortion);
    const bass = new Tone.MonoSynth({
      oscillator: { type: "square" },
      filter: { type: "lowpass", frequency: 450, Q: 5 },
      envelope: { attack: 0.001, decay: 0.15, sustain: 0.2, release: 0.1 },
      filterEnvelope: { attack: 0.001, decay: 0.08, sustain: 0.15, release: 0.08, baseFrequency: 70, octaves: 4.5 },
    }).connect(bassCrush);
    bass.volume.value = -3;

    const crackDistortion = new Tone.Distortion({ distortion: 0.9, wet: 0.7 }).connect(masterDistortion);
    const crack = new Tone.NoiseSynth({
      noise: { type: "white" },
      envelope: { attack: 0.0005, decay: 0.03, sustain: 0 },
    }).connect(crackDistortion);
    crack.volume.value = -6;

    const screechFilter = new Tone.Filter({ type: "bandpass", frequency: 2000, Q: 18 }).connect(masterDistortion);
    const screech = new Tone.FMSynth({
      harmonicity: 7,
      modulationIndex: 30,
      envelope: { attack: 0.02, decay: 0.5, sustain: 0.1, release: 0.3 },
      modulation: { type: "sawtooth" },
    }).connect(screechFilter);
    screech.volume.value = -14;

    const metal = new Tone.MetalSynth({
      envelope: { attack: 0.001, decay: 0.12, release: 0.04 },
      harmonicity: 6.1,
      modulationIndex: 26,
      resonance: 3500,
      octaves: 1.4,
    }).connect(masterDistortion);
    metal.volume.value = -12;

    const crashDistortion = new Tone.Distortion({ distortion: 0.85, wet: 0.65 }).connect(masterDistortion);
    const crash = new Tone.NoiseSynth({
      noise: { type: "white" },
      envelope: { attack: 0.001, decay: 0.35, sustain: 0 },
    }).connect(crashDistortion);
    crash.volume.value = -8;

    let step = 0;
    let prevContrast = 0;
    let barPattern: BarBeat[] = [];

    const loop = new Tone.Loop((time) => {
      const analysis = getAnalysis();
      const music = getMusic();
      const s = step % 16;
      const blobCount = analysis.blobs.length;

      if (s === 0) {
        barPattern = rollBar(analysis.edgeDensity);
      }
      const beat = barPattern[s] ?? { kick: false, crack: false, metal: false, screech: false };

      if (beat.kick) {
        const scale = buildScaleNotes(music.rootNote, music.scaleName, 0, 2);
        const note = scale[(blobCount + s) % scale.length];
        bass.triggerAttackRelease(note, "16n", time, 0.7 + Math.random() * 0.3);
      }
      if (beat.crack) {
        crack.triggerAttackRelease("32n", time, 0.6 + Math.random() * 0.4);
      }
      if (beat.metal) {
        metal.triggerAttackRelease("16n", time, 0.4 + Math.random() * 0.4);
      }
      if (beat.screech) {
        screechFilter.frequency.rampTo(600 + Math.random() * 5000, 0.15);
        screech.triggerAttackRelease("A3", "8n", time, 0.3 + analysis.contrast * 0.3);
      }

      // scan across the frame left-to-right, one column per step
      const scanEdge = analysis.columns[s] ?? 0;
      if (scanEdge > 0.2) {
        metal.triggerAttackRelease("32n", time, 0.15 + scanEdge * 0.4);
      }

      if (Math.abs(analysis.contrast - prevContrast) > 0.1) {
        crash.triggerAttackRelease("8n", time, 0.6 + analysis.contrast * 0.4);
      }
      prevContrast = analysis.contrast;

      step++;
    }, "16n").start(0);

    return () => {
      loop.dispose();
      bass.dispose();
      bassCrush.dispose();
      crack.dispose();
      crackDistortion.dispose();
      screech.dispose();
      screechFilter.dispose();
      metal.dispose();
      crash.dispose();
      crashDistortion.dispose();
      masterDistortion.dispose();
      limiter.dispose();
    };
  },
};
