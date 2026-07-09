import * as Tone from "tone";
import type { Preset } from "./types";
import { buildScaleNotes } from "../scales";

const KICK_STEPS = new Set([0, 3, 7, 10, 13]);
const SNARE_STEPS = new Set([6, 14]);

export const braindancePreset: Preset = {
  id: "braindance",
  label: "Braindance",
  bpm: 136,
  enabled: true,
  description:
    "Aphex Twin acid/IDM: squelchy 303 bass swept by edge density and keyed to blob count, a broken/glitchy beat, sparse FM chimes on bright frames.",
  build(getAnalysis, getMusic) {
    const limiter = new Tone.Limiter(-1).toDestination();
    const delay = new Tone.FeedbackDelay({ delayTime: "16n.", feedback: 0.28, wet: 0.16 }).connect(limiter);
    const reverb = new Tone.Freeverb({ roomSize: 0.5, dampening: 5000, wet: 0.12 }).connect(delay);

    const acidFilter = new Tone.Filter({ type: "lowpass", frequency: 250, Q: 9 }).connect(reverb);
    const acid = new Tone.MonoSynth({
      oscillator: { type: "sawtooth" },
      filter: { type: "lowpass", frequency: 8000, Q: 0.5 },
      envelope: { attack: 0.005, decay: 0.12, sustain: 0.15, release: 0.08 },
      portamento: 0.02,
    }).connect(acidFilter);
    acid.volume.value = -8;

    const kick = new Tone.MembraneSynth({
      pitchDecay: 0.04,
      octaves: 5,
      envelope: { attack: 0.001, decay: 0.28, sustain: 0, release: 0.3 },
    }).connect(limiter);

    const snareFilter = new Tone.Filter({ type: "bandpass", frequency: 2200, Q: 1 }).connect(reverb);
    const snare = new Tone.NoiseSynth({
      noise: { type: "pink" },
      envelope: { attack: 0.001, decay: 0.12, sustain: 0 },
    }).connect(snareFilter);
    snare.volume.value = -12;

    const hihatFilter = new Tone.Filter({ type: "highpass", frequency: 9000 }).connect(reverb);
    const hihat = new Tone.NoiseSynth({
      noise: { type: "white" },
      envelope: { attack: 0.001, decay: 0.025, sustain: 0 },
    }).connect(hihatFilter);
    hihat.volume.value = -18;

    const chime = new Tone.FMSynth({
      harmonicity: 4.2,
      modulationIndex: 3,
      envelope: { attack: 0.005, decay: 0.6, sustain: 0.1, release: 0.8 },
      modulation: { type: "sine" },
    }).connect(delay);
    chime.volume.value = -14;

    let step = 0;
    const loop = new Tone.Loop((time) => {
      const analysis = getAnalysis();
      const music = getMusic();
      const s = step % 16;
      const blobCount = analysis.blobs.length;

      if (KICK_STEPS.has(s)) {
        kick.triggerAttackRelease("C1", "16n", time);
      }
      if (SNARE_STEPS.has(s)) {
        snare.triggerAttackRelease("16n", time, 0.7);
      }

      if (s % 2 === 0 || Math.random() < 0.4) {
        const scale = buildScaleNotes(music.rootNote, music.scaleName, 1, 2);
        const note = scale[(blobCount + s) % scale.length];
        acidFilter.frequency.rampTo(250 + analysis.edgeDensity * 3200, 0.05);
        acid.triggerAttackRelease(note, "16n", time, 0.55 + analysis.edgeDensity * 0.3);
      }

      // scan across the frame left-to-right, one column per step; only pop
      // the hi-hat when the scan crosses an actual edge in that column
      const scanEdge = analysis.columns[s] ?? 0;
      if (scanEdge > 0.16) {
        const jitter = (Math.random() - 0.5) * 0.015;
        hihat.triggerAttackRelease("32n", time + jitter, 0.2 + scanEdge * 0.6);
      }

      if ((s === 0 || s === 8) && analysis.brightness > 0.3 && Math.random() < 0.6) {
        const scale = buildScaleNotes(music.rootNote, music.scaleName, 3, 2);
        const note = scale[Math.floor(analysis.brightness * scale.length) % scale.length];
        chime.triggerAttackRelease(note, "8n", time, 0.4);
      }

      step++;
    }, "16n").start(0);

    return () => {
      loop.dispose();
      acid.dispose();
      acidFilter.dispose();
      kick.dispose();
      snare.dispose();
      snareFilter.dispose();
      hihat.dispose();
      hihatFilter.dispose();
      chime.dispose();
      delay.dispose();
      reverb.dispose();
      limiter.dispose();
    };
  },
};
