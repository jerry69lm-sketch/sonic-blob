import * as Tone from "tone";
import type { Preset } from "./types";
import { buildScaleNotes } from "../scales";

export const deconstructedClubPreset: Preset = {
  id: "deconstructed-club",
  label: "Deconstructed Club",
  bpm: 140,
  enabled: true,
  description:
    "Half-time trap clap, glide 808 sub driven by blob count, hi-hat rolls driven by edge density, glitch stabs on sudden blob jumps.",
  build(getAnalysis, getMusic) {
    const limiter = new Tone.Limiter(-1).toDestination();
    const reverb = new Tone.Freeverb({ roomSize: 0.6, dampening: 4000, wet: 0.14 }).connect(limiter);
    const distortion = new Tone.Distortion({ distortion: 0.35, wet: 0.18 }).connect(reverb);

    const sub = new Tone.MonoSynth({
      oscillator: { type: "sine" },
      filter: { type: "lowpass", Q: 2, rolloff: -24 },
      envelope: { attack: 0.005, decay: 0.3, sustain: 0.4, release: 0.3 },
      filterEnvelope: { attack: 0.01, decay: 0.2, sustain: 0.5, release: 0.3, baseFrequency: 120, octaves: 2.5 },
      portamento: 0.06,
    }).connect(distortion);
    sub.volume.value = -4;

    const clapFilter = new Tone.Filter({ type: "bandpass", frequency: 1800, Q: 1.2 }).connect(reverb);
    const clap = new Tone.NoiseSynth({
      noise: { type: "pink" },
      envelope: { attack: 0.001, decay: 0.18, sustain: 0 },
    }).connect(clapFilter);
    clap.volume.value = -10;

    const hihatFilter = new Tone.Filter({ type: "highpass", frequency: 8000 }).connect(reverb);
    const hihat = new Tone.NoiseSynth({
      noise: { type: "white" },
      envelope: { attack: 0.001, decay: 0.03, sustain: 0 },
    }).connect(hihatFilter);
    hihat.volume.value = -16;

    const bitcrusher = new Tone.BitCrusher(4).connect(limiter);
    const glitch = new Tone.FMSynth({
      harmonicity: 3.5,
      modulationIndex: 8,
      envelope: { attack: 0.001, decay: 0.08, sustain: 0, release: 0.05 },
    }).connect(bitcrusher);
    glitch.volume.value = -12;

    let step = 0;
    let prevBlobCount = 0;

    const loop = new Tone.Loop((time) => {
      const analysis = getAnalysis();
      const music = getMusic();
      const s = step % 16;
      const blobCount = analysis.blobs.length;

      if (s === 0 || s === 10) {
        const scale = buildScaleNotes(music.rootNote, music.scaleName, 0, 2);
        const note = scale[blobCount % scale.length];
        sub.triggerAttackRelease(note, "4n", time, 0.9);
      }

      if (s === 8) {
        clap.triggerAttackRelease("8n", time, 0.8);
      }

      // scan across the frame left-to-right, one column per step; only pop
      // the hi-hat when the scan crosses an actual edge in that column
      const scanEdge = analysis.columns[s] ?? 0;
      if (scanEdge > 0.16) {
        hihat.triggerAttackRelease("32n", time, 0.2 + scanEdge * 0.5);
        if (scanEdge > 0.4) {
          hihat.triggerAttackRelease("32n", time + Tone.Time("64n").toSeconds(), 0.25 + scanEdge * 0.4);
        }
      }

      if (Math.abs(blobCount - prevBlobCount) >= 2) {
        const scale = buildScaleNotes(music.rootNote, music.scaleName, 2, 2);
        const note = scale[Math.floor(Math.random() * scale.length)];
        glitch.triggerAttackRelease(note, "16n", time, 0.6);
      }
      prevBlobCount = blobCount;

      step++;
    }, "16n").start(0);

    return () => {
      loop.dispose();
      sub.dispose();
      clap.dispose();
      clapFilter.dispose();
      hihat.dispose();
      hihatFilter.dispose();
      glitch.dispose();
      bitcrusher.dispose();
      distortion.dispose();
      reverb.dispose();
      limiter.dispose();
    };
  },
};
