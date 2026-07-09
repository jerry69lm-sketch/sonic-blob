/**
 * iOS Safari (and some other mobile browsers) route raw Web Audio API output
 * through the "ambient" audio session category, which is silenced by the
 * hardware mute switch — headphones bypass the switch entirely, which is why
 * sound only comes through with headphones plugged in. Playing any real
 * <audio>/<video> element switches the page's session to "playback", which
 * ignores the mute switch and applies to all audio on the page, including
 * Tone.js. This creates a silent, looping element to force that switch.
 */
function createSilentWavUrl(): string {
  const sampleRate = 8000;
  const numSamples = Math.floor(sampleRate * 0.3);
  const buffer = new ArrayBuffer(44 + numSamples);
  const view = new DataView(buffer);
  const writeString = (offset: number, s: string) => {
    for (let i = 0; i < s.length; i++) view.setUint8(offset + i, s.charCodeAt(i));
  };
  writeString(0, "RIFF");
  view.setUint32(4, 36 + numSamples, true);
  writeString(8, "WAVE");
  writeString(12, "fmt ");
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true);
  view.setUint16(22, 1, true);
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate, true);
  view.setUint16(32, 1, true);
  view.setUint16(34, 8, true);
  writeString(36, "data");
  view.setUint32(40, numSamples, true);
  for (let i = 0; i < numSamples; i++) view.setUint8(44 + i, 128);
  return URL.createObjectURL(new Blob([buffer], { type: "audio/wav" }));
}

let unlocked = false;

export function unlockMobileSpeakerAudio() {
  if (unlocked) return;
  unlocked = true;
  const audio = new Audio(createSilentWavUrl());
  audio.loop = true;
  audio.play().catch(() => {});
}
