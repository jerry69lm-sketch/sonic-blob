export const vertexShader = /* glsl */ `
  varying vec2 vUv;
  void main() {
    vUv = uv;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;

export const edgeCompositeFragment = /* glsl */ `
  precision highp float;
  varying vec2 vUv;
  uniform sampler2D tDiffuse;
  uniform vec2 texel;
  uniform float thresholdA;
  uniform float thresholdB;
  uniform float aberration;
  uniform vec3 colorA;
  uniform vec3 colorB;
  uniform float baseDesat;
  uniform vec3 tint;
  uniform float mirrorFlip;

  float luma(vec3 c) { return dot(c, vec3(0.299, 0.587, 0.114)); }

  float sobel(vec2 uv, float spread) {
    vec2 o = texel * spread;
    float tl = luma(texture2D(tDiffuse, uv + vec2(-o.x, -o.y)).rgb);
    float tc = luma(texture2D(tDiffuse, uv + vec2(0.0, -o.y)).rgb);
    float tr = luma(texture2D(tDiffuse, uv + vec2(o.x, -o.y)).rgb);
    float l  = luma(texture2D(tDiffuse, uv + vec2(-o.x, 0.0)).rgb);
    float r  = luma(texture2D(tDiffuse, uv + vec2(o.x, 0.0)).rgb);
    float bl = luma(texture2D(tDiffuse, uv + vec2(-o.x, o.y)).rgb);
    float bc = luma(texture2D(tDiffuse, uv + vec2(0.0, o.y)).rgb);
    float br = luma(texture2D(tDiffuse, uv + vec2(o.x, o.y)).rgb);
    float gx = -tl - 2.0 * l - bl + tr + 2.0 * r + br;
    float gy = -tl - 2.0 * tc - tr + bl + 2.0 * bc + br;
    return length(vec2(gx, gy));
  }

  void main() {
    vec2 uv = vec2(mix(vUv.x, 1.0 - vUv.x, mirrorFlip), vUv.y);

    vec2 dir = uv - 0.5;
    vec2 aoff = dir * aberration;
    float rC = texture2D(tDiffuse, uv - aoff).r;
    float gC = texture2D(tDiffuse, uv).g;
    float bC = texture2D(tDiffuse, uv + aoff).b;
    vec3 base = vec3(rC, gC, bC);

    float l = luma(base);
    vec3 desat = mix(base, vec3(l), baseDesat) * tint;

    float edgeFine = sobel(uv, 1.0);
    float edgeCoarse = sobel(uv, 2.6);

    float eA = smoothstep(thresholdA, thresholdA + 0.15, edgeFine);
    float eB = smoothstep(thresholdB, thresholdB + 0.28, edgeCoarse);

    vec3 col = desat * 0.92;
    col += colorA * eA * 0.7;
    col += colorB * eB * 0.55;

    gl_FragColor = vec4(col, 1.0);
  }
`;

export const brightPassFragment = /* glsl */ `
  precision highp float;
  varying vec2 vUv;
  uniform sampler2D tDiffuse;
  uniform float threshold;
  void main() {
    vec3 c = texture2D(tDiffuse, vUv).rgb;
    float l = dot(c, vec3(0.299, 0.587, 0.114));
    float m = smoothstep(threshold, threshold + 0.35, l);
    gl_FragColor = vec4(c * m, 1.0);
  }
`;

export const blurFragment = /* glsl */ `
  precision highp float;
  varying vec2 vUv;
  uniform sampler2D tDiffuse;
  uniform vec2 direction;
  void main() {
    vec4 sum = vec4(0.0);
    sum += texture2D(tDiffuse, vUv - 4.0 * direction) * 0.0162162162;
    sum += texture2D(tDiffuse, vUv - 3.0 * direction) * 0.0540540541;
    sum += texture2D(tDiffuse, vUv - 2.0 * direction) * 0.1216216216;
    sum += texture2D(tDiffuse, vUv - 1.0 * direction) * 0.1945945946;
    sum += texture2D(tDiffuse, vUv)                    * 0.2270270270;
    sum += texture2D(tDiffuse, vUv + 1.0 * direction) * 0.1945945946;
    sum += texture2D(tDiffuse, vUv + 2.0 * direction) * 0.1216216216;
    sum += texture2D(tDiffuse, vUv + 3.0 * direction) * 0.0540540541;
    sum += texture2D(tDiffuse, vUv + 4.0 * direction) * 0.0162162162;
    gl_FragColor = sum;
  }
`;

export const combineFragment = /* glsl */ `
  precision highp float;
  varying vec2 vUv;
  uniform sampler2D tBase;
  uniform sampler2D tBloom;
  uniform float bloomIntensity;
  void main() {
    vec3 base = texture2D(tBase, vUv).rgb;
    vec3 bloom = texture2D(tBloom, vUv).rgb;
    gl_FragColor = vec4(base + bloom * bloomIntensity, 1.0);
  }
`;

export const trailFragment = /* glsl */ `
  precision highp float;
  varying vec2 vUv;
  uniform sampler2D tCurrent;
  uniform sampler2D tPrev;
  uniform float decay;
  uniform vec2 drift;
  void main() {
    vec3 cur = texture2D(tCurrent, vUv).rgb;
    vec3 prev = texture2D(tPrev, vUv + drift).rgb;
    vec3 col = max(cur, prev * decay);
    gl_FragColor = vec4(col, 1.0);
  }
`;
