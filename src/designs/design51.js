export const DESIGN_51_ID = "design-51-live-lab";
export const DESIGN_52_ID = "design-52-copy-of-02";
export const DESIGN_53_ID = "design-53-copy-of-03";
export const DESIGN_51_LAYOUT_VERSION = 1;

const BASE_REFERENCE_TOTAL = 50;
const BASE_DESIGN_OVERRIDES = {
  0: {
    center: 17.4,
    orbSize: 3,
    radius: 11,
    sides: 6,
    x1: 0,
    x2: 4,
    y1: 1.15,
    y2: 0.8,
    zoom: 21,
  },
};
const DESIGN_52_OVERRIDE = {
  ballSize: 81,
  center: 802,
  contrast: 2.32,
  inner: 0.17,
  outer: 8.3,
  pDiv: 22,
  radius: 6146,
  shape: 5,
  xInner: 0.19,
  xOuter: 0.9,
  yInner: 3.39,
  yOuter: 3.3,
  zoom: 1449,
};
const DESIGN_53_OVERRIDE = {
  bump: 0.36,
  colorShift: 0.35,
  contrast: 3.4,
  cosMul: 4.6,
  gloop: 0.57,
  orbSize: 218,
  radius: 2.8,
  rotation: 28,
  sides: 0,
  sinMul: 9485,
  speed: 1.9,
  xDivide: 5.3,
  xMul: 0.77,
  xSpeed: 0.43,
  yMul: 0.11,
  ySpeed: 1.18,
  zoom: 7.3,
};

export const DESIGN_51_CONTROL_GROUPS = [
  {
    id: "dna",
    title: "DNA do shader",
    fields: [
      { key: "labOrbCount", label: "Total de orbs", type: "number", min: 1, max: 24, step: 1, defaultValue: 6, integer: true },
      { key: "labBaseRing", label: "Base ring", type: "number", min: 0, max: 2, step: 0.01, defaultValue: 0.35 },
      { key: "labRingWobble", label: "Ring wobble", type: "number", min: 0, max: 2, step: 0.01, defaultValue: 0.55 },
      { key: "labWarpBase", label: "Warp base", type: "number", min: 0, max: 2, step: 0.01, defaultValue: 0.08 },
      { key: "labWarpAudioMult", label: "Warp com audio", type: "number", min: 0, max: 4, step: 0.01, defaultValue: 0.45 },
      { key: "labWarpXFreq", label: "Warp X freq", type: "number", min: 0, max: 20, step: 0.01, defaultValue: 5.6 },
      { key: "labWarpYFreq", label: "Warp Y freq", type: "number", min: 0, max: 20, step: 0.01, defaultValue: 4.8 },
      { key: "labWarpXSpeed", label: "Warp X speed", type: "number", min: -8, max: 8, step: 0.01, defaultValue: 1.2 },
      { key: "labWarpYSpeed", label: "Warp Y speed", type: "number", min: -8, max: 8, step: 0.01, defaultValue: 1.05 },
      { key: "labHueStreamMult", label: "Hue por stream", type: "number", min: -8, max: 8, step: 0.01, defaultValue: 1.6 },
      { key: "labHueTimeMult", label: "Hue por tempo", type: "number", min: -8, max: 8, step: 0.01, defaultValue: 0.22 },
      { key: "labColorDriftSpeed", label: "Color drift", type: "number", min: -8, max: 8, step: 0.01, defaultValue: 0.38 },
      { key: "labStrobeTimeMult", label: "Strobe tempo", type: "number", min: 0, max: 40, step: 0.01, defaultValue: 7.5 },
      { key: "labStrobeStreamMult", label: "Strobe stream", type: "number", min: 0, max: 40, step: 0.01, defaultValue: 12.5 },
    ],
  },
  {
    id: "core",
    title: "Composicao",
    fields: [
      { key: "zoom", label: "Zoom", type: "number", min: 0.2, max: 5, step: 0.01, defaultValue: 1 },
      { key: "contrast", label: "Contraste", type: "number", min: 0.1, max: 4, step: 0.01, defaultValue: 1 },
      { key: "orbSize", label: "Tamanho da orb", type: "number", min: 0.05, max: 3, step: 0.01, defaultValue: 1 },
      { key: "radius", label: "Raio", type: "number", min: 0, max: 4, step: 0.01, defaultValue: 1 },
      { key: "speed", label: "Velocidade", type: "number", min: -4, max: 4, step: 0.01, defaultValue: 1 },
      { key: "twist", label: "Twist", type: "number", min: -6.28, max: 6.28, step: 0.01, defaultValue: 1 },
      { key: "pulse", label: "Pulse", type: "number", min: -2, max: 6, step: 0.01, defaultValue: 1 },
      { key: "colorShift", label: "Color shift", type: "number", min: 0, max: 8, step: 0.01, defaultValue: 1 },
      { key: "colorOffset", label: "Color offset", type: "number", min: -8, max: 8, step: 0.01, defaultValue: 1 },
    ],
  },
  {
    id: "symmetry",
    title: "Simetria e espelho",
    fields: [
      { key: "kaleidoscope", label: "Kaleidoscopio", type: "boolean", defaultValue: true },
      { key: "sides", label: "Lados", type: "number", min: 1, max: 24, step: 1, defaultValue: 1, integer: true },
      { key: "mirrorX", label: "Espelho X", type: "boolean", defaultValue: true },
      { key: "mirrorY", label: "Espelho Y", type: "boolean", defaultValue: false },
      { key: "invert", label: "Inverter cor", type: "boolean", defaultValue: true },
    ],
  },
  {
    id: "surface",
    title: "Textura e acabamento",
    fields: [
      { key: "warp", label: "Warp", type: "boolean", defaultValue: true },
      { key: "posterize", label: "Posterizar", type: "boolean", defaultValue: false },
      { key: "posterSteps", label: "Poster steps", type: "number", min: 2, max: 24, step: 1, defaultValue: 4, integer: true },
      { key: "vignette", label: "Vignette", type: "number", min: 0, max: 1, step: 0.01, defaultValue: 0 },
      { key: "grain", label: "Grao", type: "number", min: 0, max: 1.5, step: 0.01, defaultValue: 0 },
      { key: "strobe", label: "Strobe", type: "number", min: 0, max: 1, step: 0.01, defaultValue: 1 },
    ],
  },
];

export const DESIGN_51_CONTROL_FIELDS = DESIGN_51_CONTROL_GROUPS.flatMap((group) => group.fields);

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

export function getDesign51DefaultVariant() {
  const variant = {};

  DESIGN_51_CONTROL_GROUPS.forEach((group) => {
    group.fields.forEach((field) => {
      variant[field.key] = { value: field.defaultValue };
    });
  });

  return variant;
}

function buildDesign51Shader() {
  return `void main() {
  vec2 uv = k_uv();
  uv *= zoom;

  float streamPhase = stream * 0.0025;
  float t = time * speed + streamPhase * 40.0;
  float orbTotal = max(1.0, floor(labOrbCount + 0.5));
  uv *= k_rotate2d(twist + streamPhase * 3.0);

  if (mirrorX) uv.x = abs(uv.x);
  if (mirrorY) uv.y = abs(uv.y);

  if (warp) {
    uv += vec2(
      sin(uv.y * labWarpXFreq + t * labWarpXSpeed),
      cos(uv.x * labWarpYFreq - t * labWarpYSpeed)
    ) * (labWarpBase + volume * labWarpAudioMult);
  }

  if (kaleidoscope) {
    uv = k_kale(uv, vec2(0.0), max(1.0, sides));
  }

  vec4 color = vec4(0.0);

  for (float i = 0.0; i < 24.0; i++) {
    if (i >= orbTotal) break;
    float p = i / orbTotal;
    float ring = radius * (labBaseRing + labRingWobble * sin(t * (0.25 + pulse) + p * 12.0));
    float a = p * TWO_PI + t * (0.3 + pulse);
    vec2 pos = vec2(cos(a), sin(a)) * ring;
    vec3 rgb = k_rainbow(p + streamPhase, colorShift, colorOffset + t * labColorDriftSpeed);
    float size = orbSize * (0.35 + volume * 1.3 + 0.2 * sin(t * 2.0 + p * 9.0));
    color += k_orb(uv, size, pos, rgb, contrast);
  }

  color = k_hue(color, streamPhase * labHueStreamMult + time * labHueTimeMult);

  if (posterize) {
    float steps = max(2.0, posterSteps);
    color.rgb = floor(color.rgb * steps) / steps;
  }

  float vignetteMask = 1.0 - smoothstep(0.18, 1.35, length(k_uv()));
  color.rgb *= mix(1.0, vignetteMask, vignette);

  float n = fract(sin(dot(gl_FragCoord.xy + vec2(time * 12.0), vec2(12.9898, 78.233))) * 43758.5453123);
  color.rgb += (n - 0.5) * grain;

  if (strobe > 0.001) {
    float pulseGate = step(0.0, sin(time * labStrobeTimeMult + streamPhase * labStrobeStreamMult));
    float strobeValue = mix(0.18, 1.0, pulseGate);
    color.rgb *= mix(1.0, strobeValue, strobe);
  }

  if (invert) {
    color.rgb = 1.0 - color.rgb;
  }

  gl_FragColor = vec4(color.rgb, 1.0);
}`;
}

export function createDesign51Sketch() {
  return {
    id: DESIGN_51_ID,
    shader: buildDesign51Shader(),
    variants: [getDesign51DefaultVariant()],
  };
}

function createDesign52Sketch(iterations) {
  const sourceSketch = iterations?.[1];
  if (!sourceSketch) return null;

  const clonedSketch = clone(sourceSketch);
  clonedSketch.id = DESIGN_52_ID;
  const baseVariant = clone(clonedSketch.variants?.[0] || {});
  applyVariantOverride(baseVariant, DESIGN_52_OVERRIDE);
  clonedSketch.variants = [baseVariant];
  return clonedSketch;
}

function createDesign53Sketch(iterations) {
  const sourceSketch = iterations?.[2];
  if (!sourceSketch) return null;

  const clonedSketch = clone(sourceSketch);
  clonedSketch.id = DESIGN_53_ID;
  const baseVariant = clone(clonedSketch.variants?.[0] || {});
  applyVariantOverride(baseVariant, DESIGN_53_OVERRIDE);
  clonedSketch.variants = [baseVariant];
  return clonedSketch;
}

function replaceAtIndex(iterations, index, sketch) {
  if (index < iterations.length) {
    iterations.splice(index, 1, sketch);
    return;
  }
  iterations.push(sketch);
}

function applyVariantOverride(variant, values) {
  if (!variant || typeof variant !== "object") return;

  Object.entries(values || {}).forEach(([key, value]) => {
    variant[key] = { value };
  });
}

function applyBaseDesignOverrides(iterations) {
  Object.entries(BASE_DESIGN_OVERRIDES).forEach(([rawIndex, values]) => {
    const index = Number(rawIndex);
    if (!Number.isInteger(index) || index < 0 || index >= iterations.length) return;

    const sketch = iterations[index];
    if (!sketch) return;
    if (!Array.isArray(sketch.variants) || !sketch.variants.length) {
      sketch.variants = [{}];
    }

    applyVariantOverride(sketch.variants[0], values);
  });
}

function ensureBaseDesignIds(iterations) {
  iterations.forEach((sketch, index) => {
    if (!sketch || sketch.id) return;
    sketch.id = `design-${String(index + 1).padStart(2, "0")}`;
  });
}

export function ensureDesign51(sketchesStore) {
  const iterations = sketchesStore?.iterations;
  if (!Array.isArray(iterations)) return;

  while (iterations.length > BASE_REFERENCE_TOTAL) {
    iterations.pop();
  }

  ensureBaseDesignIds(iterations);
  applyBaseDesignOverrides(iterations);

  replaceAtIndex(iterations, BASE_REFERENCE_TOTAL, clone(createDesign51Sketch()));
  const design52Sketch = createDesign52Sketch(iterations);
  if (design52Sketch) {
    replaceAtIndex(iterations, BASE_REFERENCE_TOTAL + 1, design52Sketch);
  }
  const design53Sketch = createDesign53Sketch(iterations);
  if (design53Sketch) {
    replaceAtIndex(iterations, BASE_REFERENCE_TOTAL + 2, design53Sketch);
  }

  if (iterations.length > BASE_REFERENCE_TOTAL + 3) {
    iterations.splice(BASE_REFERENCE_TOTAL + 3);
  }
}
