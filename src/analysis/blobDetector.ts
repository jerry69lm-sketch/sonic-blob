import type { AnalysisState, Blob } from "./types";

const ANALYSIS_W = 128;
const ANALYSIS_H = 72;
const MIN_AREA_FRAC = 0.004; // ignore specks
const MAX_AREA_FRAC = 0.55; // ignore near-whole-frame blob
const MAX_BLOBS = 14;
const MATCH_DIST = 0.12; // normalized distance for ID continuity
const SCAN_COLUMNS = 16; // matches the 16-step sequencer, one column per step

function otsuThreshold(gray: Uint8ClampedArray): number {
  const hist = new Array(256).fill(0);
  for (let i = 0; i < gray.length; i++) hist[gray[i]]++;
  const total = gray.length;
  let sum = 0;
  for (let t = 0; t < 256; t++) sum += t * hist[t];
  let sumB = 0;
  let wB = 0;
  let max = 0;
  let threshold = 127;
  for (let t = 0; t < 256; t++) {
    wB += hist[t];
    if (wB === 0) continue;
    const wF = total - wB;
    if (wF === 0) break;
    sumB += t * hist[t];
    const mB = sumB / wB;
    const mF = (sum - sumB) / wF;
    const between = wB * wF * (mB - mF) * (mB - mF);
    if (between > max) {
      max = between;
      threshold = t;
    }
  }
  return threshold;
}

interface RawBlob {
  minX: number;
  minY: number;
  maxX: number;
  maxY: number;
  count: number;
}

function connectedComponents(mask: Uint8Array, w: number, h: number): RawBlob[] {
  const visited = new Uint8Array(w * h);
  const blobs: RawBlob[] = [];
  const stack = new Int32Array(w * h);

  for (let start = 0; start < w * h; start++) {
    if (mask[start] === 0 || visited[start]) continue;
    let sp = 0;
    stack[sp++] = start;
    visited[start] = 1;
    let minX = w, minY = h, maxX = 0, maxY = 0, count = 0;

    while (sp > 0) {
      const idx = stack[--sp];
      const x = idx % w;
      const y = (idx / w) | 0;
      count++;
      if (x < minX) minX = x;
      if (x > maxX) maxX = x;
      if (y < minY) minY = y;
      if (y > maxY) maxY = y;

      if (x > 0 && !visited[idx - 1] && mask[idx - 1]) {
        visited[idx - 1] = 1;
        stack[sp++] = idx - 1;
      }
      if (x < w - 1 && !visited[idx + 1] && mask[idx + 1]) {
        visited[idx + 1] = 1;
        stack[sp++] = idx + 1;
      }
      if (y > 0 && !visited[idx - w] && mask[idx - w]) {
        visited[idx - w] = 1;
        stack[sp++] = idx - w;
      }
      if (y < h - 1 && !visited[idx + w] && mask[idx + w]) {
        visited[idx + w] = 1;
        stack[sp++] = idx + w;
      }
    }
    blobs.push({ minX, minY, maxX, maxY, count });
  }
  return blobs;
}

export class BlobDetector {
  private canvas: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D;
  private nextId = 1;
  private tracked: Blob[] = [];

  constructor() {
    this.canvas = document.createElement("canvas");
    this.canvas.width = ANALYSIS_W;
    this.canvas.height = ANALYSIS_H;
    this.ctx = this.canvas.getContext("2d", { willReadFrequently: true })!;
  }

  analyze(source: CanvasImageSource, mirror = true): AnalysisState {
    const ctx = this.ctx;
    ctx.save();
    if (mirror) {
      ctx.translate(ANALYSIS_W, 0);
      ctx.scale(-1, 1);
    }
    ctx.drawImage(source, 0, 0, ANALYSIS_W, ANALYSIS_H);
    ctx.restore();

    const { data } = ctx.getImageData(0, 0, ANALYSIS_W, ANALYSIS_H);
    const w = ANALYSIS_W;
    const h = ANALYSIS_H;
    const gray = new Uint8ClampedArray(w * h);
    let sum = 0;
    for (let i = 0, p = 0; i < data.length; i += 4, p++) {
      const lum = 0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2];
      gray[p] = lum;
      sum += lum;
    }
    const brightness = sum / (w * h) / 255;

    let variance = 0;
    for (let p = 0; p < gray.length; p++) {
      const d = gray[p] / 255 - brightness;
      variance += d * d;
    }
    const contrast = Math.min(1, Math.sqrt(variance / gray.length) * 3);

    // Sobel edge magnitude + density, bucketed into scan columns left-to-right
    let edgeCount = 0;
    const columnSum = new Float32Array(SCAN_COLUMNS);
    const columnCount = new Int32Array(SCAN_COLUMNS);
    for (let y = 1; y < h - 1; y++) {
      for (let x = 1; x < w - 1; x++) {
        const i = y * w + x;
        const gx =
          -gray[i - w - 1] - 2 * gray[i - 1] - gray[i + w - 1] +
          gray[i - w + 1] + 2 * gray[i + 1] + gray[i + w + 1];
        const gy =
          -gray[i - w - 1] - 2 * gray[i - w] - gray[i - w + 1] +
          gray[i + w - 1] + 2 * gray[i + w] + gray[i + w + 1];
        const mag = Math.sqrt(gx * gx + gy * gy) / 1020;
        if (mag > 0.18) edgeCount++;
        const col = Math.min(SCAN_COLUMNS - 1, (x / w) * SCAN_COLUMNS | 0);
        columnSum[col] += mag;
        columnCount[col]++;
      }
    }
    const edgeDensity = Math.min(1, edgeCount / ((w - 2) * (h - 2)) * 3);
    const columns = Array.from(columnSum, (s, i) => Math.min(1, (s / Math.max(1, columnCount[i])) * 3));

    // Blob mask via Otsu threshold around the brighter side of the histogram
    const threshold = otsuThreshold(gray);
    const mask = new Uint8Array(w * h);
    for (let p = 0; p < gray.length; p++) mask[p] = gray[p] > threshold ? 1 : 0;

    const raw = connectedComponents(mask, w, h);
    const minArea = MIN_AREA_FRAC * w * h;
    const maxArea = MAX_AREA_FRAC * w * h;
    const candidates: Blob[] = raw
      .filter((b) => b.count >= minArea && b.count <= maxArea)
      .sort((a, b) => b.count - a.count)
      .slice(0, MAX_BLOBS)
      .map((b) => ({
        id: -1,
        x: (b.minX + b.maxX) / 2 / w,
        y: (b.minY + b.maxY) / 2 / h,
        w: (b.maxX - b.minX) / w,
        h: (b.maxY - b.minY) / h,
        area: b.count / (w * h),
      }));

    // greedy nearest-centroid ID matching against previous frame
    const usedPrev = new Set<number>();
    for (const cand of candidates) {
      let bestIdx = -1;
      let bestDist = MATCH_DIST;
      for (let i = 0; i < this.tracked.length; i++) {
        if (usedPrev.has(i)) continue;
        const prev = this.tracked[i];
        const dist = Math.hypot(cand.x - prev.x, cand.y - prev.y);
        if (dist < bestDist) {
          bestDist = dist;
          bestIdx = i;
        }
      }
      if (bestIdx >= 0) {
        cand.id = this.tracked[bestIdx].id;
        usedPrev.add(bestIdx);
      } else {
        cand.id = this.nextId++;
        if (this.nextId > 99999) this.nextId = 1;
      }
    }

    this.tracked = candidates;

    return { blobs: candidates, edgeDensity, brightness, contrast, columns };
  }
}
