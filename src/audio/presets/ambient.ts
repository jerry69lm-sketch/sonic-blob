import * as Tone from "tone";
import type { Preset } from "./types";
import { buildScaleNotes } from "../scales";

export const ambientPreset: Preset = {
  id: "ambient",
  label: "Ambient",
  bpm: 88,
  enabled: true,
  description:
    "Ecco2k PXE: a heavenly chorus pad, an ethereal/powerful distorted guitar-like lead, and heavily distorted vocal-chop noise bursts colliding in chaotic, glitchy stops and starts.",
  build(getAnalysis, getMusic) {
    const limiter = new Tone.Limiter(-2).toDestination();
    const reverb = new Tone.Freeverb({ roomSize: 0.85, dampening: 3200, wet: 0.4 }).connect(limiter);
    const delay = new Tone.FeedbackDelay({ delayTime: "8n.", feedback: 0.3, wet: 0.2 }).connect(reverb);
    const chorus = new Tone.Chorus({ frequency: 0.8, delayTime: 4, depth: 0.6, wet: 0.5 }).connect(reverb);

    // heavenly chorus pad
    const pad = new Tone.PolySynth(Tone.Synth, {
      oscillator: { type: "sine" },
      envelope: { attack: 2.2, decay: 1, sustain: 0.8, release: 3.5 },
    }).connect(chorus);
    pad.volume.value = -15;

    // ethereal / powerful distorted guitar-like lead
    const guitarDistortion = new Tone.Distortion({ distortion: 0.3, wet: 0.35 }).connect(delay);
    const guitar = new Tone.MonoSynth({
      oscillator: { type: "sawtooth" },
      filter: { type: "lowpass", frequency: 2200, Q: 1 },
      envelope: { attack: 0.005, decay: 0.35, sustain: 0.2, release: 0.6 },
      filterEnvelope: { attack: 0.005, decay: 0.3, sustain: 0.3, release: 0.5, baseFrequency: 400, octaves: 3 },
    }).connect(guitarDistortion);
    guitar.volume.value = -10;

    // heavily distorted vocal chop
    const chopCrush = new Tone.BitCrusher(4).connect(delay);
    const chopDistortion = new Tone.Distortion({ distortion: 0.5, wet: 0.4 }).connect(chopCrush);
    const chop = new Tone.FMSynth({
      harmonicity: 1.5,
      modulationIndex: 6,
      envelope: { attack: 0.001, decay: 0.09, sustain: 0, release: 0.03 },
      modulation: { type: "square" },
    }).connect(chopDistortion);
    chop.volume.value = -9;

    // noise / chaos production
    const noiseDistortion = new Tone.Distortion({ distortion: 0.65, wet: 0.5 }).connect(limiter);
    const noise = new Tone.NoiseSynth({
      noise: { type: "pink" },
      envelope: { attack: 0.001, decay: 0.15, sustain: 0 },
    }).connect(noiseDistortion);
    noise.volume.value = -16;

    // sparse sub pulse, cloud-rap foundation
    const sub = new Tone.MonoSynth({
      oscillator: { type: "sine" },
      envelope: { attack: 0.05, decay: 0.4, sustain: 0.3, release: 0.6 },
      filter: { type: "lowpass", frequency: 300 },
    }).connect(limiter);
    sub.volume.value = -14;

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

      if (s === 0 || s === 16) {
        const lowScale = buildScaleNotes(music.rootNote, music.scaleName, 0, 1);
        sub.triggerAttackRelease(lowScale[blobCount % lowScale.length], "2n", time, 0.5);
      }

      if (s % 4 === 0 && analysis.brightness > 0.15 && Math.random() < 0.6) {
        const avgY = analysis.blobs.reduce((a, b) => a + b.y, 0) / Math.max(1, analysis.blobs.length);
        const idx = Math.floor((1 - avgY) * scale.length) % scale.length;
        guitar.triggerAttackRelease(scale[idx] ?? scale[0], "8n", time, 0.4 + analysis.edgeDensity * 0.3);
      }

      // scan across the frame left-to-right, one column per step
      const scanEdge = analysis.columns[s % 16] ?? 0;
      if (scanEdge > 0.14 && Math.random() < 0.5) {
        const note = scale[(s + blobCount) % scale.length];
        chop.triggerAttackRelease(note, "16n", time, 0.4 + scanEdge * 0.4);
        chop.frequency.rampTo(Tone.Frequency(note).transpose(-7).toFrequency(), 0.12, time + 0.02);
      }

      if (Math.abs(analysis.contrast - prevContrast) > 0.08) {
        noise.triggerAttackRelease("8n", time, 0.4 + analysis.contrast * 0.5);
      }
      prevContrast = analysis.contrast;

      step++;
    }, "16n").start(0);

    return () => {
      loop.dispose();
      pad.dispose();
      chorus.dispose();
      guitar.dispose();
      guitarDistortion.dispose();
      chop.dispose();
      chopCrush.dispose();
      chopDistortion.dispose();
      noise.dispose();
      noiseDistortion.dispose();
      sub.dispose();
      delay.dispose();
      reverb.dispose();
      limiter.dispose();
    };
  },
};
