export interface Blob {
  id: number;
  x: number; // normalized 0..1, center
  y: number; // normalized 0..1, center
  w: number; // normalized 0..1
  h: number; // normalized 0..1
  area: number; // normalized 0..1
}

export interface AnalysisState {
  blobs: Blob[];
  edgeDensity: number; // 0..1
  brightness: number; // 0..1
  contrast: number; // 0..1
}

export const emptyAnalysis: AnalysisState = {
  blobs: [],
  edgeDensity: 0,
  brightness: 0,
  contrast: 0,
};
