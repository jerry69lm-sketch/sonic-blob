import * as Tone from "tone";
import type { Preset } from "./types";
import { buildScaleNotes } from "../scales";

export const witchHousePreset: Preset = {
  id: "witch-house",
  label: "Witch House",
  bpm: 68,
  enabled: true,
  description:
    "SALEM witch house: chopped & screwed pitched-down vocals, a choir drowning in digital clipping, a molasses synth drone, and a slow rolling half-time beat with tape-stutter skips.",
  build(getAnalysis, getMusic) {
    const limiter = new Tone.Limiter(-1).toDestination();
    const reverb = new Tone.Freeverb({ roomSize: 0.9, dampening: 2000, wet: 0.45 }).connect(limiter);

    // choir drowning in digital clipping
    const choirClip = new Tone.Distortion({ distortion: 0.6, wet: 0.55 }).connect(reverb);
    const choir = new Tone.PolySynth(Tone.Synth, {
      oscillator: { type: "sawtooth" },
      envelope: { attack: 1.8, decay: 1, sustain: 0.7, release: 3 },
    }).connect(choirClip);
    choir.volume.value = -14;

    // molasses synth drone
    const droneFilter = new Tone.Filter({ type: "lowpass", frequency: 350, Q: 1 }).connect(reverb);
    const drone = new Tone.FatOscillator({ type: "sawtooth", count: 4, spread: 50 }).connect(droneFilter);
    drone.volume.value = -20;
    drone.start();

    // pitched-down, chopped & screwed vocal
    const vocalDistortion = new Tone.Distortion({ distortion: 0.3, wet: 0.25 }).connect(reverb);
    const vocal = new Tone.FMSynth({
      harmonicity: 0.5,
      modulationIndex: 3,
      envelope: { attack: 0.05, decay: 0.6, sustain: 0.4, release: 1.2 },
      modulation: { type: "sine" },
    }).connect(vocalDistortion);
    vocal.volume.value = -10;

    // slow rolling half-time beat
    const kick = new Tone.MembraneSynth({
      pitchDecay: 0.08,
      octaves: 5,
      envelope: { attack: 0.001, decay: 0.5, sustain: 0, release: 0.5 },
    }).connect(limiter);

    const snareFilter = new Tone.Filter({ type: "bandpass", frequency: 1400, Q: 1 }).connect(reverb);
    const snareDistortion = new Tone.Distortion({ distortion: 0.4, wet: 0.35 }).connect(snareFilter);
    const snare = new Tone.NoiseSynth({
      noise: { type: "pink" },
      envelope: { attack: 0.001, decay: 0.3, sustain: 0 },
    }).connect(snareDistortion);
    snare.volume.value = -10;

    // tape-stutter skip: pitch drops fast after the hit, like a tape slowing to a stop
    const stutter = new Tone.FMSynth({
      harmonicity: 1,
      modulationIndex: 2,
      envelope: { attack: 0.001, decay: 0.15, sustain: 0, release: 0.1 },
      modulation: { type: "square" },
    }).connect(reverb);
    stutter.volume.value = -14;

    let step = 0;
    let prevBlobCount = 0;

    const loop = new Tone.Loop((time) => {
      const analysis = getAnalysis();
      const music = getMusic();
      const s = step % 16;
      const blobCount = analysis.blobs.length;
      const droneScale = buildScaleNotes(music.rootNote, music.scaleName, -1, 1);
      const choirScale = buildScaleNotes(music.rootNote, music.scaleName, 2, 2);

      droneFilter.frequency.rampTo(150 + analysis.brightness * 400, 0.6);
      drone.frequency.rampTo(Tone.Frequency(droneScale[0]).toFrequency(), 0.8);

      if (s === 0) {
        const voicing = [choirScale[0], choirScale[2 % choirScale.length]];
        choir.triggerAttackRelease(voicing, "2m", time, 0.5);
      }

      if (s === 0 || s === 7) {
        kick.triggerAttackRelease("C1", "4n", time);
      }
      if (s === 8) {
        snare.triggerAttackRelease("4n", time, 0.7 + analysis.contrast * 0.3);
      }

      // pitched-down vocal chop, driven by the frame scan
      const scanEdge = analysis.columns[s] ?? 0;
      if (scanEdge > 0.18 && Math.random() < 0.5) {
        const vocalScale = buildScaleNotes(music.rootNote, music.scaleName, -1, 2);
        const note = vocalScale[blobCount % vocalScale.length];
        vocal.triggerAttackRelease(note, "4n", time, 0.4 + scanEdge * 0.3);
      }

      // tape-stutter skip on sudden blob jumps
      if (Math.abs(blobCount - prevBlobCount) >= 2) {
        stutter.triggerAttackRelease("A2", "16n", time, 0.5);
        stutter.frequency.rampTo(55, 0.3, time + 0.02);
      }
      prevBlobCount = blobCount;

      step++;
    }, "16n").start(0);

    return () => {
      loop.dispose();
      choir.dispose();
      choirClip.dispose();
      drone.dispose();
      droneFilter.dispose();
      vocal.dispose();
      vocalDistortion.dispose();
      kick.dispose();
      snare.dispose();
      snareFilter.dispose();
      snareDistortion.dispose();
      stutter.dispose();
      reverb.dispose();
      limiter.dispose();
    };
  },
};
