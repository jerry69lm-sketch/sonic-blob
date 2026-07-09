import * as Tone from "tone";
import type { Preset } from "./types";
import { buildScaleNotes } from "../scales";

export const deconstructedClubPreset: Preset = {
  id: "deconstructed-club",
  label: "Deconstructed Club",
  bpm: 140,
  enabled: true,
  description:
    'KAVARI x KOPI O "If You Live (Body Bags)": half-time dark dubstep with an LFO wobble sub, a low distorted growl voice standing in for the vocal, and a brooding drone underneath.',
  build(getAnalysis, getMusic) {
    const limiter = new Tone.Limiter(-1).toDestination();
    const masterDistortion = new Tone.Distortion({ distortion: 0.35, wet: 0.25 }).connect(limiter);
    const reverb = new Tone.Freeverb({ roomSize: 0.75, dampening: 2500, wet: 0.22 }).connect(masterDistortion);

    // wobble sub: a resonant filter swept by an LFO for the classic dubstep wub
    const wobbleFilter = new Tone.Filter({ type: "lowpass", frequency: 400, Q: 8 }).connect(masterDistortion);
    const wobbleLfo = new Tone.LFO({ frequency: "8n", min: 150, max: 1400, type: "sine" });
    wobbleLfo.connect(wobbleFilter.frequency);
    wobbleLfo.start();
    const subDistortion = new Tone.Distortion({ distortion: 0.4, wet: 0.3 }).connect(wobbleFilter);
    const sub = new Tone.MonoSynth({
      oscillator: { type: "sawtooth" },
      filter: { type: "lowpass", frequency: 3000, Q: 0.5 },
      envelope: { attack: 0.01, decay: 0.1, sustain: 0.9, release: 0.3 },
    }).connect(subDistortion);
    sub.volume.value = -5;

    // half-time snare, sparse kick
    const snareFilter = new Tone.Filter({ type: "bandpass", frequency: 1800, Q: 1 }).connect(reverb);
    const snareDistortion = new Tone.Distortion({ distortion: 0.5, wet: 0.35 }).connect(snareFilter);
    const snare = new Tone.NoiseSynth({
      noise: { type: "pink" },
      envelope: { attack: 0.001, decay: 0.22, sustain: 0 },
    }).connect(snareDistortion);
    snare.volume.value = -8;

    const kick = new Tone.MembraneSynth({
      pitchDecay: 0.05,
      octaves: 6,
      envelope: { attack: 0.001, decay: 0.4, sustain: 0, release: 0.4 },
    }).connect(masterDistortion);

    // dark drone bed
    const droneFilter = new Tone.Filter({ type: "lowpass", frequency: 260, Q: 1 }).connect(reverb);
    const drone = new Tone.FatOscillator({ type: "sawtooth", count: 3, spread: 35 }).connect(droneFilter);
    drone.volume.value = -22;
    drone.start();

    // low distorted growl voice standing in for the featured vocal
    const growlDistortion = new Tone.Distortion({ distortion: 0.6, wet: 0.5 }).connect(reverb);
    const growl = new Tone.FMSynth({
      harmonicity: 0.5,
      modulationIndex: 4,
      envelope: { attack: 0.02, decay: 0.3, sustain: 0.2, release: 0.4 },
      modulation: { type: "square" },
    }).connect(growlDistortion);
    growl.volume.value = -14;

    const crashDistortion = new Tone.Distortion({ distortion: 0.7, wet: 0.5 }).connect(masterDistortion);
    const crash = new Tone.NoiseSynth({
      noise: { type: "white" },
      envelope: { attack: 0.001, decay: 0.3, sustain: 0 },
    }).connect(crashDistortion);
    crash.volume.value = -12;

    let step = 0;
    let prevContrast = 0;

    const loop = new Tone.Loop((time) => {
      const analysis = getAnalysis();
      const music = getMusic();
      const s = step % 16;
      const blobCount = analysis.blobs.length;
      const lowScale = buildScaleNotes(music.rootNote, music.scaleName, -1, 1);

      wobbleLfo.min = 120 + analysis.edgeDensity * 200;
      wobbleLfo.max = 900 + analysis.edgeDensity * 2000;
      droneFilter.frequency.rampTo(140 + analysis.brightness * 500, 0.4);
      drone.frequency.rampTo(Tone.Frequency(lowScale[0]).toFrequency(), 0.5);

      if (s === 0 || s === 10) {
        const scale = buildScaleNotes(music.rootNote, music.scaleName, 0, 2);
        const note = scale[blobCount % scale.length];
        sub.triggerAttackRelease(note, "2n", time, 0.9);
      }

      if (s === 0 || s === 6) {
        kick.triggerAttackRelease("C1", "8n", time);
      }
      if (s === 8) {
        snare.triggerAttackRelease("4n", time, 0.85);
      }

      // scan across the frame left-to-right, one column per step
      const scanEdge = analysis.columns[s] ?? 0;
      if (scanEdge > 0.22 && Math.random() < 0.6) {
        growl.triggerAttackRelease(lowScale[0], "8n", time, 0.3 + scanEdge * 0.3);
      }

      if (Math.abs(analysis.contrast - prevContrast) > 0.15) {
        crash.triggerAttackRelease("8n", time, 0.5 + analysis.contrast * 0.4);
      }
      prevContrast = analysis.contrast;

      step++;
    }, "16n").start(0);

    return () => {
      loop.dispose();
      wobbleLfo.dispose();
      wobbleFilter.dispose();
      subDistortion.dispose();
      sub.dispose();
      snare.dispose();
      snareFilter.dispose();
      snareDistortion.dispose();
      kick.dispose();
      drone.dispose();
      droneFilter.dispose();
      growl.dispose();
      growlDistortion.dispose();
      crash.dispose();
      crashDistortion.dispose();
      reverb.dispose();
      masterDistortion.dispose();
      limiter.dispose();
    };
  },
};
