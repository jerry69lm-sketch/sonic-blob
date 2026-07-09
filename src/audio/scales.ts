export const NOTE_NAMES = ["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"];

export const SCALES: Record<string, number[]> = {
  "Minor Pentatonic": [0, 3, 5, 7, 10],
  "Natural Minor": [0, 2, 3, 5, 7, 8, 10],
  Dorian: [0, 2, 3, 5, 7, 9, 10],
  Major: [0, 2, 4, 5, 7, 9, 11],
  Phrygian: [0, 1, 3, 5, 7, 8, 10],
};

export const SCALE_NAMES = Object.keys(SCALES);

export interface MusicParams {
  rootNote: string;
  scaleName: string;
}

export const defaultMusicParams: MusicParams = {
  rootNote: "A",
  scaleName: "Minor Pentatonic",
};

export function buildScaleNotes(root: string, scaleName: string, baseOctave = 1, spanOctaves = 2): string[] {
  const rootIdx = Math.max(0, NOTE_NAMES.indexOf(root));
  const intervals = SCALES[scaleName] ?? SCALES["Minor Pentatonic"];
  const notes: string[] = [];
  for (let o = 0; o < spanOctaves; o++) {
    for (const iv of intervals) {
      const semis = rootIdx + iv;
      const noteIdx = ((semis % 12) + 12) % 12;
      const octave = baseOctave + o + Math.floor(semis / 12);
      notes.push(`${NOTE_NAMES[noteIdx]}${octave}`);
    }
  }
  return notes;
}
