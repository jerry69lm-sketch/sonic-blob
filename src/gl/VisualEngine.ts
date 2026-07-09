import * as THREE from "three";
import { BlobDetector } from "../analysis/blobDetector";
import type { AnalysisState } from "../analysis/types";
import {
  vertexShader,
  edgeCompositeFragment,
  brightPassFragment,
  blurFragment,
  combineFragment,
  trailFragment,
} from "./shaders";

interface FullscreenPass {
  scene: THREE.Scene;
  camera: THREE.OrthographicCamera;
  material: THREE.ShaderMaterial;
}

function makePass(fragmentShader: string, uniforms: Record<string, THREE.IUniform>): FullscreenPass {
  const scene = new THREE.Scene();
  const camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
  const material = new THREE.ShaderMaterial({ vertexShader, fragmentShader, uniforms, depthWrite: false, depthTest: false });
  const mesh = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), material);
  scene.add(mesh);
  return { scene, camera, material };
}

function makeTarget(w: number, h: number) {
  return new THREE.WebGLRenderTarget(w, h, {
    minFilter: THREE.LinearFilter,
    magFilter: THREE.LinearFilter,
    format: THREE.RGBAFormat,
    type: THREE.UnsignedByteType,
  });
}

export interface VisualParams {
  thresholdA: number;
  thresholdB: number;
  aberration: number;
  bloomIntensity: number;
  bloomThreshold: number;
  trailDecay: number;
  baseDesat: number;
  colorA: THREE.Vector3;
  colorB: THREE.Vector3;
  tint: THREE.Vector3;
}

export const defaultVisualParams: VisualParams = {
  thresholdA: 0.25,
  thresholdB: 0.45,
  aberration: 0.006,
  bloomIntensity: 1.1,
  bloomThreshold: 0.35,
  trailDecay: 0.82,
  baseDesat: 0.75,
  colorA: new THREE.Vector3(0.55, 0.95, 1.0),
  colorB: new THREE.Vector3(1.0, 0.85, 0.98),
  tint: new THREE.Vector3(0.65, 0.8, 1.0),
};

export class VisualEngine {
  private renderer: THREE.WebGLRenderer;
  private overlay: HTMLCanvasElement;
  private overlayCtx: CanvasRenderingContext2D;
  private sourceTexture: THREE.Texture | null = null;
  private sourceEl: HTMLVideoElement | HTMLImageElement | null = null;
  private isVideo = false;
  private mirror = true;
  private looping = false;

  private edgePass: FullscreenPass;
  private brightPass: FullscreenPass;
  private blurPass: FullscreenPass;
  private combinePass: FullscreenPass;
  private trailPass: FullscreenPass;

  private rtEdge: THREE.WebGLRenderTarget;
  private rtBrightHalf: THREE.WebGLRenderTarget;
  private rtBlurA: THREE.WebGLRenderTarget;
  private rtBlurB: THREE.WebGLRenderTarget;
  private rtCombined: THREE.WebGLRenderTarget;
  private rtTrail: [THREE.WebGLRenderTarget, THREE.WebGLRenderTarget];
  private trailIndex = 0;

  private blobDetector = new BlobDetector();
  private analysisCb: ((a: AnalysisState) => void) | null = null;
  private raf = 0;
  private width = 2;
  private height = 2;
  params: VisualParams = { ...defaultVisualParams };
  private lastAnalysis: AnalysisState | null = null;

  constructor(canvas: HTMLCanvasElement, overlay: HTMLCanvasElement) {
    this.overlay = overlay;
    this.overlayCtx = overlay.getContext("2d")!;

    this.renderer = new THREE.WebGLRenderer({ canvas, antialias: false, powerPreference: "high-performance" });
    this.renderer.autoClear = false;

    this.rtEdge = makeTarget(2, 2);
    this.rtBrightHalf = makeTarget(1, 1);
    this.rtBlurA = makeTarget(1, 1);
    this.rtBlurB = makeTarget(1, 1);
    this.rtCombined = makeTarget(2, 2);
    this.rtTrail = [makeTarget(2, 2), makeTarget(2, 2)];

    this.edgePass = makePass(edgeCompositeFragment, {
      tDiffuse: { value: null },
      texel: { value: new THREE.Vector2(1 / 640, 1 / 360) },
      thresholdA: { value: this.params.thresholdA },
      thresholdB: { value: this.params.thresholdB },
      aberration: { value: this.params.aberration },
      colorA: { value: this.params.colorA },
      colorB: { value: this.params.colorB },
      baseDesat: { value: this.params.baseDesat },
      tint: { value: this.params.tint },
      mirrorFlip: { value: 1 },
    });

    this.brightPass = makePass(brightPassFragment, {
      tDiffuse: { value: null },
      threshold: { value: this.params.bloomThreshold },
    });

    this.blurPass = makePass(blurFragment, {
      tDiffuse: { value: null },
      direction: { value: new THREE.Vector2(1 / 320, 0) },
    });

    this.combinePass = makePass(combineFragment, {
      tBase: { value: null },
      tBloom: { value: null },
      bloomIntensity: { value: this.params.bloomIntensity },
    });

    this.trailPass = makePass(trailFragment, {
      tCurrent: { value: null },
      tPrev: { value: null },
      decay: { value: this.params.trailDecay },
      drift: { value: new THREE.Vector2(0, 0) },
    });
  }

  onAnalysis(cb: (a: AnalysisState) => void) {
    this.analysisCb = cb;
  }

  getLastAnalysis(): AnalysisState | null {
    return this.lastAnalysis;
  }

  resize(width: number, height: number) {
    this.width = Math.max(2, Math.floor(width));
    this.height = Math.max(2, Math.floor(height));
    const halfW = Math.max(2, Math.floor(this.width / 2));
    const halfH = Math.max(2, Math.floor(this.height / 2));

    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.setSize(this.width, this.height, false);
    this.overlay.width = this.width;
    this.overlay.height = this.height;

    this.rtEdge.setSize(this.width, this.height);
    this.rtCombined.setSize(this.width, this.height);
    this.rtTrail[0].setSize(this.width, this.height);
    this.rtTrail[1].setSize(this.width, this.height);
    this.rtBrightHalf.setSize(halfW, halfH);
    this.rtBlurA.setSize(halfW, halfH);
    this.rtBlurB.setSize(halfW, halfH);

    (this.edgePass.material.uniforms.texel.value as THREE.Vector2).set(1 / this.width, 1 / this.height);
    (this.blurPass.material.uniforms.direction.value as THREE.Vector2).set(1 / halfW, 0);
  }

  setSource(el: HTMLVideoElement | HTMLImageElement, mirror = true) {
    this.sourceTexture?.dispose();
    this.sourceEl = el;
    this.isVideo = el instanceof HTMLVideoElement;
    this.mirror = mirror;
    this.sourceTexture = this.isVideo ? new THREE.VideoTexture(el as HTMLVideoElement) : new THREE.Texture(el as HTMLImageElement);
    this.sourceTexture.colorSpace = THREE.SRGBColorSpace;
    if (!this.isVideo) this.sourceTexture.needsUpdate = true;
    this.edgePass.material.uniforms.tDiffuse.value = this.sourceTexture;
    if (!this.looping) {
      this.looping = true;
      this.loop();
    }
  }

  setMirror(mirror: boolean) {
    this.mirror = mirror;
  }

  clearSource() {
    this.sourceEl = null;
  }

  stop() {
    this.looping = false;
    cancelAnimationFrame(this.raf);
  }

  private renderPass(pass: FullscreenPass, target: THREE.WebGLRenderTarget | null) {
    this.renderer.setRenderTarget(target);
    this.renderer.render(pass.scene, pass.camera);
  }

  private syncUniforms() {
    const p = this.params;
    const u = this.edgePass.material.uniforms;
    u.thresholdA.value = p.thresholdA;
    u.thresholdB.value = p.thresholdB;
    u.aberration.value = p.aberration;
    u.baseDesat.value = p.baseDesat;
    u.mirrorFlip.value = this.mirror ? 1 : 0;
    this.brightPass.material.uniforms.threshold.value = p.bloomThreshold;
    this.combinePass.material.uniforms.bloomIntensity.value = p.bloomIntensity;
    this.trailPass.material.uniforms.decay.value = p.trailDecay;
  }

  private drawOverlay(analysis: AnalysisState) {
    const ctx = this.overlayCtx;
    const w = this.overlay.width;
    const h = this.overlay.height;
    ctx.clearRect(0, 0, w, h);
    ctx.lineWidth = 1.5;
    ctx.font = "11px 'Courier New', monospace";
    ctx.textBaseline = "bottom";

    for (const b of analysis.blobs) {
      const bx = (b.x - b.w / 2) * w;
      const by = (b.y - b.h / 2) * h;
      const bw = b.w * w;
      const bh = b.h * h;
      ctx.strokeStyle = "rgba(210, 245, 255, 0.85)";
      ctx.shadowColor = "rgba(120, 220, 255, 0.8)";
      ctx.shadowBlur = 6;
      ctx.strokeRect(bx, by, bw, bh);
      ctx.shadowBlur = 0;
      ctx.fillStyle = "rgba(210, 245, 255, 0.9)";
      ctx.fillText(String(b.id).padStart(5, "0"), bx + 4, by - 2 < 10 ? by + 12 : by - 2);
    }
  }

  private loop = () => {
    this.raf = requestAnimationFrame(this.loop);
    if (!this.sourceEl || !this.sourceTexture) return;
    if (this.isVideo) {
      const v = this.sourceEl as HTMLVideoElement;
      if (v.readyState < 2) return;
      this.sourceTexture.needsUpdate = true;
    }
    this.syncUniforms();

    const analysis = this.blobDetector.analyze(this.sourceEl, this.mirror);
    this.lastAnalysis = analysis;
    this.analysisCb?.(analysis);
    this.drawOverlay(analysis);

    // 1. edge/dreamy composite
    this.renderPass(this.edgePass, this.rtEdge);

    // 2. bloom: bright-pass at half res, blur x2 passes (H then V)
    this.brightPass.material.uniforms.tDiffuse.value = this.rtEdge.texture;
    this.renderPass(this.brightPass, this.rtBrightHalf);

    this.blurPass.material.uniforms.tDiffuse.value = this.rtBrightHalf.texture;
    (this.blurPass.material.uniforms.direction.value as THREE.Vector2).set(1 / this.rtBrightHalf.width, 0);
    this.renderPass(this.blurPass, this.rtBlurA);

    this.blurPass.material.uniforms.tDiffuse.value = this.rtBlurA.texture;
    (this.blurPass.material.uniforms.direction.value as THREE.Vector2).set(0, 1 / this.rtBrightHalf.height);
    this.renderPass(this.blurPass, this.rtBlurB);

    // 3. combine base + bloom
    this.combinePass.material.uniforms.tBase.value = this.rtEdge.texture;
    this.combinePass.material.uniforms.tBloom.value = this.rtBlurB.texture;
    this.renderPass(this.combinePass, this.rtCombined);

    // 4. feedback trail ping-pong: same inputs rendered to the new trail buffer and to screen
    const prev = this.rtTrail[this.trailIndex];
    const next = this.rtTrail[1 - this.trailIndex];
    this.trailPass.material.uniforms.tCurrent.value = this.rtCombined.texture;
    this.trailPass.material.uniforms.tPrev.value = prev.texture;
    this.renderPass(this.trailPass, next);
    this.renderer.setRenderTarget(null);
    this.renderer.render(this.trailPass.scene, this.trailPass.camera);
    this.trailIndex = 1 - this.trailIndex;
  };

  dispose() {
    this.stop();
    this.sourceTexture?.dispose();
    this.rtEdge.dispose();
    this.rtBrightHalf.dispose();
    this.rtBlurA.dispose();
    this.rtBlurB.dispose();
    this.rtCombined.dispose();
    this.rtTrail[0].dispose();
    this.rtTrail[1].dispose();
    this.renderer.dispose();
  }
}
