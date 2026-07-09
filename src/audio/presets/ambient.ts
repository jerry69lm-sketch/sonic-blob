import * as Tone from "tone";
import type { Preset } from "./types";
import { buildScaleNotes } from "../scales";

export const ambientPreset: Preset = {
  id: "ambient",
  label: "Ambient",
  bpm: 138,
  enabled: true,
  description:
    "Ecco2k E: a cold, futuristic trap beat under an extremely high autotuned falsetto lead, gorgeous pristine synth pads, and glistening bell sparkle.",
  build(getAnalysis, getMusic) {
    const limiter = new Tone.Limiter(-2).toDestination();
    const reverb = new Tone.Freeverb({ roomSize: 0.7, dampening: 4500, wet: 0.28 }).connect(limiter);

    // gorgeous pristine pad
    const pad = new Tone.PolySynth(Tone.Synth, {
      oscillator: { type: "sine" },
      envelope: { attack: 2, decay: 1, sustain: 0.75, release: 3 },
    }).connect(reverb);
    pad.volume.value = -16;

    // cold, sub-zero 808
    const sub = new Tone.MonoSynth({
      oscillator: { type: "sine" },
      filter: { type: "lowpass", frequency: 900, Q: 0.5 },
      envelope: { attack: 0.01, decay: 0.25, sustain: 0.4, release: 0.3 },
      portamento: 0.03,
    }).connect(limiter);
    sub.volume.value = -6;

    // snappy clean snare
    const snareFilter = new Tone.Filter({ type: "bandpass", frequency: 2000, Q: 1.3 }).connect(reverb);
    const snare = new Tone.NoiseSynth({
      noise: { type: "white" },
      envelope: { attack: 0.001, decay: 0.12, sustain: 0 },
    }).connect(snareFilter);
    snare.volume.value = -12;

    // crisp trap hi-hat
    const hihatFilter = new Tone.Filter({ type: "highpass", frequency: 8500 }).connect(reverb);
    const hihat = new Tone.NoiseSynth({
      noise: { type: "white" },
      envelope: { attack: 0.001, decay: 0.025, sustain: 0 },
    }).connect(hihatFilter);
    hihat.volume.value = -18;

    // extremely high autotuned falsetto lead
    const leadReverb = new Tone.Freeverb({ roomSize: 0.8, dampening: 4000, wet: 0.35 }).connect(limiter);
    const lead = new Tone.FMSynth({
      harmonicity: 2,
      modulationIndex: 1.2,
      envelope: { attack: 0.02, decay: 0.2, sustain: 0.5, release: 0.6 },
      modulation: { type: "sine" },
    }).connect(leadReverb);
    lead.volume.value = -10;

    // glistening bell sparkle
    const bell = new Tone.FMSynth({
      harmonicity: 3.5,
      modulationIndex: 2,
      envelope: { attack: 0.001, decay: 0.4, sustain: 0, release: 0.3 },
      modulation: { type: "sine" },
    }).connect(reverb);
    bell.volume.value = -16;

    let step = 0;

    const loop = new Tone.Loop((time) => {
      const analysis = getAnalysis();
      const music = getMusic();
      const s = step % 32;
      const s16 = step % 16;
      const blobCount = analysis.blobs.length;
      const scale = buildScaleNotes(music.rootNote, music.scaleName, 2, 2);

      if (s === 0) {
        const voicing = [scale[0], scale[(2 + blobCount) % scale.length], scale[(4 + blobCount) % scale.length]];
        pad.triggerAttackRelease(voicing, "2m", time, 0.55);
      }

      if (s16 === 0 || s16 === 10) {
        const lowScale = buildScaleNotes(music.rootNote, music.scaleName, 0, 1);
        sub.triggerAttackRelease(lowScale[blobCount % lowScale.length], "4n", time, 0.7);
      }
      if (s16 === 8) {
        snare.triggerAttackRelease("8n", time, 0.6);
      }

      // scan across the frame left-to-right, one column per step
      const scanEdge = analysis.columns[s16] ?? 0;
      if (scanEdge > 0.16) {
        hihat.triggerAttackRelease("32n", time, 0.15 + scanEdge * 0.45);
      }

      // extremely high, autotune-quantized falsetto — no glide between notes
      if (s16 % 4 === 2 && analysis.brightness > 0.12 && Math.random() < 0.55) {
        const highScale = buildScaleNotes(music.rootNote, music.scaleName, 4, 2);
        const avgY = analysis.blobs.reduce((a, b) => a + b.y, 0) / Math.max(1, analysis.blobs.length);
        const idx = Math.floor((1 - avgY) * highScale.length) % highScale.length;
        const note = highScale[idx] ?? highScale[0];
        lead.triggerAttackRelease(note, "8n", time, 0.4);
        if (Math.random() < 0.25) {
          lead.triggerAttackRelease(note, "32n", time + 0.06, 0.3);
        }
      }

      if (Math.random() < 0.08 + analysis.contrast * 0.15) {
        const bellScale = buildScaleNotes(music.rootNote, music.scaleName, 4, 2);
        bell.triggerAttackRelease(bellScale[Math.floor(Math.random() * bellScale.length)], "16n", time, 0.3);
      }

      step++;
    }, "16n").start(0);

    return () => {
      loop.dispose();
      pad.dispose();
      sub.dispose();
      snare.dispose();
      snareFilter.dispose();
      hihat.dispose();
      hihatFilter.dispose();
      lead.dispose();
      leadReverb.dispose();
      bell.dispose();
      reverb.dispose();
      limiter.dispose();
    };
  },
};
