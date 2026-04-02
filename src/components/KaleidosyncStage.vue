<script setup>
import { computed, onBeforeUnmount, onMounted, ref, shallowRef, watch } from "vue";
import { Mesh, OrthographicCamera, PlaneGeometry, Scene, ShaderMaterial } from "three";
import ShaderScroll from "@wearesage/vue/components/webgl/ShaderScroll.vue";
import { useSketches } from "@wearesage/vue/stores/sketches";
import { useViewport } from "@wearesage/vue/stores/viewport";
import { useUI } from "@wearesage/vue/stores/ui";
import { useAnimation, useRAF } from "@wearesage/vue";
import { DEFAULT_FRAGMENT_SHADER, DEFAULT_VERTEX_SHADER, GLSL_UTILS } from "@wearesage/vue/constants/glsl-defaults";
import StageSketchMesh from "./StageSketchMesh.vue";

const DESIGN_TRANSITION_MS = 900;
const PERFORMANCE_SAMPLE_WINDOW_MS = 500;
const ASCII_STYLE_ID = "ascii-bw";
const ASCII_CHARS = " .,:;irsXA253hMHGS#9B&@";
const SHADER_DEFS = ["precision highp float;", "#define PI 3.14159265359", "#define TWO_PI 2. * PI", "varying vec2 vUv;"].join("\n");
const QUALITY_MODE_CONFIG = {
  performance: {
    label: "Alta perf",
    activeFps: 30,
    idleFps: 20,
    hiddenFps: 8,
    prewarmLimit: 1,
    dprMinScale: 1,
    dprMaxScale: 1.05,
    initialDprScale: 1,
    targetFps: 28,
    targetFpsHysteresis: 2,
    dprStepUp: 0.01,
    dprStepDownSoft: 0.02,
    dprStepDownMedium: 0.04,
    dprStepDownHard: 0.07,
    filterStrength: 0,
    overlayOpacityScale: 0,
    overlayBlurScale: 0,
    transitionScale: 0.006,
    asciiInterval: 120,
  },
  balanced: {
    label: "Medio",
    activeFps: 45,
    idleFps: 30,
    hiddenFps: 10,
    prewarmLimit: 3,
    dprMinScale: 1.55,
    dprMaxScale: 1.7,
    initialDprScale: 1.6,
    targetFps: 40,
    targetFpsHysteresis: 4,
    dprStepUp: 0.015,
    dprStepDownSoft: 0.02,
    dprStepDownMedium: 0.035,
    dprStepDownHard: 0.06,
    filterStrength: 0.5,
    overlayOpacityScale: 0.45,
    overlayBlurScale: 0.5,
    transitionScale: 0.012,
    asciiInterval: 100,
  },
  beautiful: {
    label: "Bonito",
    activeFps: 60,
    idleFps: 40,
    hiddenFps: 12,
    prewarmLimit: 5,
    dprMinScale: 2.15,
    dprMaxScale: 2.3,
    initialDprScale: 2.2,
    targetFps: 54,
    targetFpsHysteresis: 4,
    dprStepUp: 0.02,
    dprStepDownSoft: 0.02,
    dprStepDownMedium: 0.03,
    dprStepDownHard: 0.05,
    filterStrength: 1,
    overlayOpacityScale: 1,
    overlayBlurScale: 1,
    transitionScale: 0.018,
    asciiInterval: 95,
  },
};

const props = defineProps({
  blink: {
    type: Number,
    default: 1,
  },
  motion: {
    type: Number,
    default: 0,
  },
  colorIntensity: {
    type: Number,
    default: 0,
  },
  visualStyle: {
    type: String,
    default: "default",
  },
  qualityMode: {
    type: String,
    default: "balanced",
  },
  showPerformanceHud: {
    type: Boolean,
    default: false,
  },
});

const emit = defineEmits(["select"]);

const raf = useRAF();
const sketches = useSketches();
const viewport = useViewport();
const ui = useUI();
const context = shallowRef();
const activeSketchMesh = shallowRef();
const scroll = shallowRef();
const activeRenderEpoch = ref(0);
const renderTime = ref(window.performance.now());
const transitionStartAt = ref(0);
const transitionProgress = ref(1);
const asciiFrame = ref("");
const asciiColumns = ref(0);
const asciiRows = ref(0);
const performanceFps = ref(0);
const performanceFrameMs = ref(0);
const performanceRenderWidth = ref(0);
const performanceRenderHeight = ref(0);
const performanceSampleFrames = ref(0);
const adaptiveDpr = ref(0.34);
let asciiCanvas = null;
let asciiContext = null;
let asciiMeasureCanvas = null;
let asciiMeasureContext = null;
let lastAsciiFrameAt = 0;
let performanceFrameCount = 0;
let performanceAccumulatedDelta = 0;
let performanceLastFrameAt = 0;
let performanceLastSampleAt = 0;
let lastRenderAt = 0;
const prewarmedProgramKeys = new Set();
const queuedProgramKeys = new Set();
let prewarmTimer = 0;
let prewarmQueue = [];
let prewarmInFlight = false;
let prewarmGeometry = null;
let prewarmCamera = null;

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

function mixNumber(from, to, amount) {
  return from + (to - from) * amount;
}

function normalizeShaderSource(shaderCode) {
  const source = String(shaderCode || DEFAULT_FRAGMENT_SHADER);
  const isMainImageShader = /void\s+mainImage\s*\(\s*out\s+vec4\s+\w+\s*,\s*in\s+vec2\s+\w+\s*\)/.test(source);
  if (!isMainImageShader) return source;

  const lines = source.split("\n");
  const globalLines = [];
  const functionLines = [];
  let inFunction = false;
  let braceCount = 0;

  for (const line of lines) {
    const trimmed = line.trim();

    if (!inFunction && /void\s+\w+\s*\(/.test(trimmed)) {
      inFunction = true;
      functionLines.push(line);
      braceCount += (line.match(/\{/g) || []).length;
      braceCount -= (line.match(/\}/g) || []).length;
      continue;
    }

    if (inFunction) {
      functionLines.push(line);
      braceCount += (line.match(/\{/g) || []).length;
      braceCount -= (line.match(/\}/g) || []).length;
      if (braceCount <= 0) {
        inFunction = false;
        braceCount = 0;
      }
      continue;
    }

    globalLines.push(line);
  }

  return `
${globalLines.join("\n")}

${functionLines.join("\n")}

void main() {
  mainImage(gl_FragColor, gl_FragCoord.xy);
}`;
}

function buildShaderUniformShape(sourceUniforms = {}) {
  const nextUniforms = {
    resolution: { value: [1, 1] },
    time: { value: 0 },
    stream: { value: 0 },
    volume: { value: 1 },
    iResolution: { value: [1, 1, 1] },
    iTime: { value: 0 },
    iStream: { value: 0 },
    iVolume: { value: 1 },
    ...Object.fromEntries(
      Object.entries(sourceUniforms || {}).map(([key, entry]) => [
        key,
        {
          value: Array.isArray(entry?.value) ? [...entry.value] : entry?.value,
        },
      ])
    ),
  };

  Object.entries(sourceUniforms || {}).forEach(([key, entry]) => {
    if (typeof entry?.value === "boolean") {
      nextUniforms[`${key}Tween`] = { value: false };
      nextUniforms[`${key}TweenProgress`] = { value: 0 };
    }
  });

  return nextUniforms;
}

function buildUniformDeclarations(uniformsMap) {
  return Object.keys(uniformsMap).reduce((acc, key) => {
    const value = uniformsMap[key]?.value;
    if (Array.isArray(value)) {
      return acc + `\nuniform ${value.length === 2 ? "vec2" : "vec3"} ${key};`;
    }
    if (typeof value === "number") {
      return acc + `\nuniform float ${key};`;
    }
    if (typeof value === "boolean") {
      return acc + `\nuniform bool ${key};`;
    }
    return acc;
  }, "");
}

function buildProgramKey(sketchValue) {
  const shaderSource = normalizeShaderSource(sketchValue?.shader || DEFAULT_FRAGMENT_SHADER);
  const uniformsMap = buildShaderUniformShape(sketchValue?.variants?.[0] || {});
  const declarations = buildUniformDeclarations(uniformsMap);
  return `${shaderSource}__${declarations}`;
}

function ensurePrewarmResources() {
  if (!prewarmGeometry) {
    prewarmGeometry = new PlaneGeometry(2, 2, 1, 1);
  }
  if (!prewarmCamera) {
    prewarmCamera = new OrthographicCamera(-1, 1, 1, -1, 0.1, 10);
    prewarmCamera.position.z = 1;
  }
}

async function prewarmSketchProgram(sketchValue) {
  const renderer = context.value?.context?.renderer?.value;
  if (!renderer || !sketchValue?.shader) return false;

  const programKey = buildProgramKey(sketchValue);
  if (prewarmedProgramKeys.has(programKey)) return true;

  ensurePrewarmResources();

  const uniformsMap = buildShaderUniformShape(sketchValue?.variants?.[0] || {});
  const declarations = buildUniformDeclarations(uniformsMap);
  const vertexShader = `${SHADER_DEFS}${declarations}${DEFAULT_VERTEX_SHADER}`;
  const fragmentShader = `${SHADER_DEFS}${declarations}${GLSL_UTILS}${normalizeShaderSource(sketchValue.shader || DEFAULT_FRAGMENT_SHADER)}`;
  const prewarmScene = new Scene();
  const material = new ShaderMaterial({
    uniforms: uniformsMap,
    vertexShader,
    fragmentShader,
  });
  const mesh = new Mesh(prewarmGeometry, material);
  prewarmScene.add(mesh);

  try {
    await renderer.compileAsync(prewarmScene, prewarmCamera);
    prewarmedProgramKeys.add(programKey);
    return true;
  } catch {
    return false;
  } finally {
    material.dispose();
    prewarmScene.remove(mesh);
  }
}

function scheduleShaderPrewarm(sketchList = []) {
  if (!Array.isArray(sketchList) || !sketchList.length) return;

  sketchList.forEach((sketchValue) => {
    const programKey = buildProgramKey(sketchValue);
    if (prewarmedProgramKeys.has(programKey) || queuedProgramKeys.has(programKey)) return;
    queuedProgramKeys.add(programKey);
    prewarmQueue.push(sketchValue);
  });

  if (prewarmTimer || prewarmInFlight) return;

  prewarmTimer = window.setTimeout(async () => {
    prewarmTimer = 0;
    if (prewarmInFlight) return;
    prewarmInFlight = true;

    try {
      while (prewarmQueue.length) {
        const nextSketch = prewarmQueue.shift();
        if (!nextSketch) continue;
        const programKey = buildProgramKey(nextSketch);
        queuedProgramKeys.delete(programKey);
        await prewarmSketchProgram(nextSketch);
        await new Promise((resolve) => window.setTimeout(resolve, 48));
      }
    } finally {
      prewarmInFlight = false;
      if (prewarmQueue.length) {
        scheduleShaderPrewarm([]);
      }
    }
  }, 120);
}

function getSketchPrewarmPriorityList() {
  const allSketches = Array.isArray(sketches.iterations) ? sketches.iterations : [];
  if (!allSketches.length) return [];

  const currentIndex = Math.max(0, sketches.index ?? 0);
  const orderedIndexes = [];
  for (let offset = 0; offset < allSketches.length; offset += 1) {
    const forward = (currentIndex + offset) % allSketches.length;
    const backward = (currentIndex - offset + allSketches.length) % allSketches.length;
    if (!orderedIndexes.includes(forward)) orderedIndexes.push(forward);
    if (!orderedIndexes.includes(backward)) orderedIndexes.push(backward);
  }

  return orderedIndexes.map((index) => allSketches[index]).filter(Boolean);
}

function getPrewarmBudget() {
  return Math.max(0, Number(qualityPreset.value.prewarmLimit || 0));
}

function ensureAsciiBuffer() {
  if (asciiCanvas && asciiContext) return;
  asciiCanvas = document.createElement("canvas");
  asciiContext = asciiCanvas.getContext("2d", { willReadFrequently: true });
  if (asciiContext) {
    asciiContext.imageSmoothingEnabled = false;
  }
}

function ensureAsciiMeasureContext() {
  if (asciiMeasureCanvas && asciiMeasureContext) return;
  asciiMeasureCanvas = document.createElement("canvas");
  asciiMeasureContext = asciiMeasureCanvas.getContext("2d");
}

function measureAsciiCharWidth(fontSize) {
  ensureAsciiMeasureContext();
  if (!asciiMeasureContext) {
    return fontSize * 0.6;
  }
  asciiMeasureContext.font = `${fontSize}px Consolas, "Courier New", monospace`;
  const metrics = asciiMeasureContext.measureText("M");
  return metrics.width || fontSize * 0.6;
}

function getAsciiMetrics() {
  const lineHeight = 0.92;
  const rows = clamp(Math.floor(height.value / 12), 36, 120);
  const fontSize = clamp(height.value / (rows * lineHeight), 7, 16);
  const charWidth = measureAsciiCharWidth(fontSize);
  const columns = clamp(Math.floor(width.value / charWidth), 84, 320);
  return {
    columns,
    rows,
    fontSize,
    lineHeight,
    letterSpacing: 0,
  };
}

function resetAsciiFrame() {
  asciiFrame.value = "";
  asciiColumns.value = 0;
  asciiRows.value = 0;
  lastAsciiFrameAt = 0;
}

function resetPerformanceHud() {
  performanceFps.value = 0;
  performanceFrameMs.value = 0;
  performanceRenderWidth.value = 0;
  performanceRenderHeight.value = 0;
  performanceSampleFrames.value = 0;
  performanceFrameCount = 0;
  performanceAccumulatedDelta = 0;
  performanceLastFrameAt = 0;
  performanceLastSampleAt = 0;
}

function getInitialAdaptiveDpr() {
  const viewportPixels = Math.max(1, width.value * height.value);
  if (viewportPixels >= 1920 * 1080) return 0.26;
  if (viewportPixels >= 1600 * 900) return 0.3;
  return 0.34;
}

function updateAsciiFrame(now) {
  if (props.visualStyle !== ASCII_STYLE_ID) {
    if (asciiFrame.value) resetAsciiFrame();
    return;
  }

  if (now - lastAsciiFrameAt < qualityPreset.value.asciiInterval) return;

  const sourceCanvas = context.value?.context?.renderer?.value?.domElement;
  if (!(sourceCanvas instanceof HTMLCanvasElement)) return;

  ensureAsciiBuffer();
  if (!asciiContext) return;

  const metrics = getAsciiMetrics();
  if (asciiCanvas.width !== metrics.columns || asciiCanvas.height !== metrics.rows) {
    asciiCanvas.width = metrics.columns;
    asciiCanvas.height = metrics.rows;
    asciiContext.imageSmoothingEnabled = false;
  }

  asciiContext.clearRect(0, 0, metrics.columns, metrics.rows);
  asciiContext.drawImage(sourceCanvas, 0, 0, metrics.columns, metrics.rows);

  const { data } = asciiContext.getImageData(0, 0, metrics.columns, metrics.rows);
  const lines = [];

  for (let row = 0; row < metrics.rows; row += 1) {
    let line = "";

    for (let column = 0; column < metrics.columns; column += 1) {
      const offset = (row * metrics.columns + column) * 4;
      const alpha = data[offset + 3] / 255;
      if (alpha < 0.04) {
        line += " ";
        continue;
      }

      const red = data[offset];
      const green = data[offset + 1];
      const blue = data[offset + 2];
      const luminance = clamp(((0.2126 * red + 0.7152 * green + 0.0722 * blue) / 255 - 0.5) * 1.35 + 0.5, 0, 1);
      const charIndex = Math.round(luminance * (ASCII_CHARS.length - 1));
      line += ASCII_CHARS[charIndex];
    }

    lines.push(line);
  }

  asciiColumns.value = metrics.columns;
  asciiRows.value = metrics.rows;
  asciiFrame.value = lines.join("\n");
  lastAsciiFrameAt = now;
}
const visualStylePreset = computed(() => {
  switch (props.visualStyle) {
    case "bw-jagged":
      return {
        minDpr: 0.22,
        maxDpr: 0.42,
        grayscale: 1,
        sepia: 0,
        hueRotate: 0,
        saturationBoost: 0,
        brightnessBase: 0.92,
        brightnessColorBoost: 0.34,
        brightnessBlinkBoost: 0.18,
        contrastBase: 1.36,
        contrastColorBoost: 0.16,
        colorAlphaBase: 0,
        colorAlphaBoost: 0,
        flashRgb: "255, 255, 255",
        colorRgb: "255, 255, 255",
        overlayBlur: 0,
      };
    case "ascii-bw":
      return {
        minDpr: 0.2,
        maxDpr: 0.32,
        grayscale: 1,
        sepia: 0,
        hueRotate: 0,
        saturationBoost: 0,
        brightnessBase: 0.74,
        brightnessColorBoost: 0.18,
        brightnessBlinkBoost: 0.14,
        contrastBase: 1.48,
        contrastColorBoost: 0.18,
        colorAlphaBase: 0,
        colorAlphaBoost: 0,
        flashRgb: "255, 255, 255",
        colorRgb: "255, 255, 255",
        overlayBlur: 0,
      };
    case "halftone-cmyk":
      return {
        minDpr: 0.24,
        maxDpr: 0.46,
        grayscale: 0,
        sepia: 0,
        hueRotate: 0,
        saturationBoost: 1.22,
        brightnessBase: 0.95,
        brightnessColorBoost: 0.28,
        brightnessBlinkBoost: 0.16,
        contrastBase: 1.08,
        contrastColorBoost: 0.22,
        colorAlphaBase: 0.08,
        colorAlphaBoost: 0.2,
        flashRgb: "255, 244, 220",
        colorRgb: "255, 192, 128",
        overlayBlur: 6,
      };
    case "pixel-brutal":
      return {
        minDpr: 0.18,
        maxDpr: 0.32,
        grayscale: 0,
        sepia: 0,
        hueRotate: 0,
        saturationBoost: 1.14,
        brightnessBase: 0.9,
        brightnessColorBoost: 0.3,
        brightnessBlinkBoost: 0.22,
        contrastBase: 1.16,
        contrastColorBoost: 0.26,
        colorAlphaBase: 0.04,
        colorAlphaBoost: 0.16,
        flashRgb: "255, 240, 214",
        colorRgb: "255, 168, 82",
        overlayBlur: 0,
        invert: 0,
      };
    case "pixel-brutal-xl":
      return {
        minDpr: 0.14,
        maxDpr: 0.24,
        grayscale: 0,
        sepia: 0,
        hueRotate: 0,
        saturationBoost: 1.08,
        brightnessBase: 0.88,
        brightnessColorBoost: 0.24,
        brightnessBlinkBoost: 0.18,
        contrastBase: 1.22,
        contrastColorBoost: 0.3,
        colorAlphaBase: 0.03,
        colorAlphaBoost: 0.12,
        flashRgb: "255, 236, 206",
        colorRgb: "255, 160, 72",
        overlayBlur: 0,
        invert: 0,
      };
    case "crt-amber":
      return {
        minDpr: 0.22,
        maxDpr: 0.42,
        grayscale: 0.12,
        sepia: 0.82,
        hueRotate: -18,
        saturationBoost: 0.36,
        brightnessBase: 0.84,
        brightnessColorBoost: 0.24,
        brightnessBlinkBoost: 0.16,
        contrastBase: 1.2,
        contrastColorBoost: 0.18,
        colorAlphaBase: 0.1,
        colorAlphaBoost: 0.22,
        flashRgb: "255, 232, 188",
        colorRgb: "255, 176, 74",
        overlayBlur: 5,
        invert: 0,
      };
    case "duotone-ice":
      return {
        minDpr: 0.22,
        maxDpr: 0.42,
        grayscale: 0.18,
        sepia: 0.28,
        hueRotate: 158,
        saturationBoost: 0.7,
        brightnessBase: 0.94,
        brightnessColorBoost: 0.26,
        brightnessBlinkBoost: 0.14,
        contrastBase: 1.12,
        contrastColorBoost: 0.2,
        colorAlphaBase: 0.08,
        colorAlphaBoost: 0.2,
        flashRgb: "235, 246, 255",
        colorRgb: "105, 220, 255",
        overlayBlur: 6,
        invert: 0,
      };
    case "infrared-bloom":
      return {
        minDpr: 0.22,
        maxDpr: 0.4,
        grayscale: 0.08,
        sepia: 0.56,
        hueRotate: -34,
        saturationBoost: 1.48,
        brightnessBase: 0.88,
        brightnessColorBoost: 0.34,
        brightnessBlinkBoost: 0.2,
        contrastBase: 1.18,
        contrastColorBoost: 0.24,
        colorAlphaBase: 0.1,
        colorAlphaBoost: 0.24,
        flashRgb: "255, 225, 200",
        colorRgb: "255, 94, 64",
        overlayBlur: 4,
        invert: 0,
      };
    default:
      return {
        minDpr: 0.2,
        maxDpr: 0.38,
        grayscale: 0,
        sepia: 0,
        hueRotate: 0,
        saturationBoost: 1,
        brightnessBase: 0.92,
        brightnessColorBoost: 0.34,
        brightnessBlinkBoost: 0.18,
        contrastBase: 1,
        contrastColorBoost: 0.16,
        colorAlphaBase: 0.06,
        colorAlphaBoost: 0.18,
        flashRgb: "255, 255, 255",
        colorRgb: "101, 224, 255",
        overlayBlur: 4,
        invert: 0,
      };
  }
});

const width = computed(() => viewport.width);
const height = computed(() => viewport.height);
const qualityPreset = computed(() => QUALITY_MODE_CONFIG[props.qualityMode] || QUALITY_MODE_CONFIG.balanced);
const dprRange = computed(() => {
  const minDpr = clamp(visualStylePreset.value.minDpr * qualityPreset.value.dprMinScale, 0.14, 1);
  const maxDpr = clamp(visualStylePreset.value.maxDpr * qualityPreset.value.dprMaxScale, minDpr, 1);
  const initialDpr = clamp(getInitialAdaptiveDpr() * qualityPreset.value.initialDprScale, minDpr, maxDpr);
  return {
    minDpr,
    maxDpr,
    initialDpr,
  };
});
const dpr = computed(() => {
  const { minDpr, maxDpr } = dprRange.value;
  return clamp(Number(adaptiveDpr.value.toFixed(2)), minDpr, maxDpr);
});
const stageFilter = computed(() => {
  const filterStrength = qualityPreset.value.filterStrength;
  if (props.visualStyle === "default" || dpr.value <= 0.24 || filterStrength <= 0.01) {
    return "none";
  }

  const saturateTarget = visualStylePreset.value.saturationBoost + props.colorIntensity * 1.2;
  const brightnessTarget =
    visualStylePreset.value.brightnessBase +
    props.colorIntensity * visualStylePreset.value.brightnessColorBoost * 0.55 +
    props.blink * visualStylePreset.value.brightnessBlinkBoost * 0.45;
  const contrastTarget = visualStylePreset.value.contrastBase + props.colorIntensity * visualStylePreset.value.contrastColorBoost * 0.55;

  return [
    `saturate(${mixNumber(1, saturateTarget, filterStrength).toFixed(3)})`,
    `brightness(${mixNumber(1, brightnessTarget, filterStrength).toFixed(3)})`,
    `contrast(${mixNumber(1, contrastTarget, filterStrength).toFixed(3)})`,
    `grayscale(${(visualStylePreset.value.grayscale * filterStrength).toFixed(3)})`,
    `sepia(${(visualStylePreset.value.sepia * filterStrength).toFixed(3)})`,
    `hue-rotate(${Math.round(visualStylePreset.value.hueRotate * filterStrength)}deg)`,
  ].join(" ");
});
const styles = computed(() => ({
  width: `${width.value}px`,
  height: `${height.value}px`,
  filter: stageFilter.value,
}));
const transitionActive = computed(() => transitionProgress.value < 1);
const stageScale = computed(() => 1 + Math.sin(transitionProgress.value * Math.PI) * qualityPreset.value.transitionScale);
const overlayOpacity = computed(() => {
  if (dpr.value <= 0.22 || props.visualStyle === "default" || qualityPreset.value.overlayOpacityScale <= 0.01) {
    return 0;
  }
  const transitionGlow = transitionActive.value ? Math.sin(transitionProgress.value * Math.PI) * 0.22 : 0;
  const liveFlash = Math.min(0.3, props.blink * (0.1 + props.colorIntensity * 0.16));
  return (transitionGlow + liveFlash) * qualityPreset.value.overlayOpacityScale;
});
const overlayStyle = computed(() => ({
  opacity: overlayOpacity.value.toFixed(3),
  "--overlay-blur": `${Math.round(visualStylePreset.value.overlayBlur * qualityPreset.value.overlayBlurScale)}px`,
  "--flash-alpha": (0.08 + props.blink * 0.24).toFixed(3),
  "--color-alpha": (visualStylePreset.value.colorAlphaBase + props.colorIntensity * visualStylePreset.value.colorAlphaBoost).toFixed(3),
  "--flash-rgb": visualStylePreset.value.flashRgb,
  "--color-rgb": visualStylePreset.value.colorRgb,
}));
const asciiStyle = computed(() => {
  const metrics = getAsciiMetrics();
  return {
    fontSize: `${metrics.fontSize.toFixed(2)}px`,
    lineHeight: metrics.lineHeight.toFixed(2),
    letterSpacing: `${metrics.letterSpacing.toFixed(2)}px`,
  };
});
const performanceViewportWidth = computed(() => Math.max(1, Math.round(width.value)));
const performanceViewportHeight = computed(() => Math.max(1, Math.round(height.value)));
const performanceCanvasWidth = computed(() => performanceRenderWidth.value || Math.max(1, Math.round(width.value * dpr.value)));
const performanceCanvasHeight = computed(() => performanceRenderHeight.value || Math.max(1, Math.round(height.value * dpr.value)));
const performanceToneClass = computed(() => {
  if (performanceFps.value >= 55) return "is-good";
  if (performanceFps.value >= 35) return "is-warning";
  return "is-bad";
});
const performanceStyleLabel = computed(() => String(props.visualStyle || "default"));
const performanceQualityLabel = computed(() => qualityPreset.value.label);

function tuneAdaptiveDpr(nextFps) {
  const { minDpr, maxDpr } = dprRange.value;
  const { targetFps, targetFpsHysteresis, dprStepUp, dprStepDownSoft, dprStepDownMedium, dprStepDownHard } = qualityPreset.value;
  let nextDpr = adaptiveDpr.value;

  if (nextFps > targetFps + targetFpsHysteresis) {
    nextDpr += dprStepUp;
  } else if (nextFps < targetFps - 18) {
    nextDpr -= dprStepDownHard;
  } else if (nextFps < targetFps - 10) {
    nextDpr -= dprStepDownMedium;
  } else if (nextFps < targetFps - 4) {
    nextDpr -= dprStepDownSoft;
  }

  adaptiveDpr.value = clamp(Number(nextDpr.toFixed(2)), minDpr, maxDpr);
}

function updatePerformanceHud(now) {
  if (!performanceLastSampleAt) {
    performanceLastSampleAt = now;
  }

  if (performanceLastFrameAt) {
    const delta = now - performanceLastFrameAt;
    if (delta > 0 && delta < 1000) {
      performanceFrameCount += 1;
      performanceAccumulatedDelta += delta;
    }
  }

  performanceLastFrameAt = now;

  const elapsed = now - performanceLastSampleAt;
  if (elapsed < PERFORMANCE_SAMPLE_WINDOW_MS) {
    return;
  }

  performanceSampleFrames.value = performanceFrameCount;
  performanceFps.value = performanceFrameCount > 0 ? Number(((performanceFrameCount * 1000) / elapsed).toFixed(1)) : 0;
  performanceFrameMs.value = performanceFrameCount > 0 ? Number((performanceAccumulatedDelta / performanceFrameCount).toFixed(1)) : 0;
  tuneAdaptiveDpr(performanceFps.value);

  const renderer = context.value?.context?.renderer?.value;
  const canvas = renderer?.domElement;
  performanceRenderWidth.value = canvas?.width || Math.max(1, Math.round(width.value * dpr.value));
  performanceRenderHeight.value = canvas?.height || Math.max(1, Math.round(height.value * dpr.value));

  performanceFrameCount = 0;
  performanceAccumulatedDelta = 0;
  performanceLastSampleAt = now;
}

function easeOutCubic(value) {
  return 1 - Math.pow(1 - value, 3);
}

function resolveFrameTime(value) {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }
  const fallback = Number(raf.time?.value);
  if (Number.isFinite(fallback)) {
    return fallback;
  }
  return window.performance.now();
}

function resolveTargetRenderFps() {
  if (document.hidden) {
    return qualityPreset.value.hiddenFps;
  }

  const audioEnergy = props.blink + props.motion + props.colorIntensity;
  const busyScene =
    ui.showShaderScroll ||
    props.showPerformanceHud ||
    props.visualStyle === ASCII_STYLE_ID ||
    transitionStartAt.value > 0 ||
    audioEnergy > 0.12;

  return busyScene ? qualityPreset.value.activeFps : qualityPreset.value.idleFps;
}

function shouldRenderFrame(frameNow) {
  const targetFps = Math.max(1, resolveTargetRenderFps());
  const minFrameDelta = 1000 / targetFps;

  if (!lastRenderAt) {
    lastRenderAt = frameNow;
    return true;
  }

  if (frameNow - lastRenderAt >= minFrameDelta) {
    lastRenderAt = frameNow;
    return true;
  }

  return false;
}

function resetRenderPacing() {
  lastRenderAt = 0;
}

function handleVisibilityChange() {
  resetRenderPacing();
  lastAsciiFrameAt = 0;
  performanceLastFrameAt = 0;
  performanceLastSampleAt = window.performance.now();
}

function selectSketch(sketchValue) {
  sketches.selectSketch(sketchValue);
  ui.showShaderScroll = false;
  emit("select", sketchValue);
}

watch(
  () => sketches.shader,
  (nextShader) => {
    if (!nextShader) return;
    activeRenderEpoch.value += 1;
    transitionStartAt.value = window.performance.now();
    transitionProgress.value = 0;
    resetRenderPacing();
    scheduleShaderPrewarm(getSketchPrewarmPriorityList().slice(0, getPrewarmBudget()));
  },
  { immediate: true }
);

watch(
  () => sketches.iterations,
  () => {
    scheduleShaderPrewarm(getSketchPrewarmPriorityList().slice(0, getPrewarmBudget()));
  },
  { immediate: true }
);

watch(
  [() => sketches.index, () => sketches.uniformKeysSerialized],
  ([nextIndex, nextUniformKeys], [previousIndex, previousUniformKeys] = []) => {
    if (nextIndex === previousIndex && nextUniformKeys === previousUniformKeys) return;
    activeRenderEpoch.value += 1;
    resetRenderPacing();
  }
);

watch(
  [() => props.visualStyle, () => props.qualityMode],
  () => {
    adaptiveDpr.value = dprRange.value.initialDpr;
    resetRenderPacing();
  },
  { immediate: true }
);

useAnimation((now) => {
  const frameNow = resolveFrameTime(now);

  if (!context.value?.context) {
    return;
  }
  const { renderer, scene, camera } = context.value.context;
  if (!renderer?.value || !scene?.value || !camera?.value) {
    return;
  }

  if (!shouldRenderFrame(frameNow)) {
    return;
  }

  renderTime.value = frameNow;
  updatePerformanceHud(frameNow);

  if (transitionStartAt.value) {
    const elapsed = frameNow - transitionStartAt.value;
    const linear = Math.min(1, elapsed / DESIGN_TRANSITION_MS);
    transitionProgress.value = easeOutCubic(linear);
    if (linear >= 1) {
      transitionStartAt.value = 0;
      transitionProgress.value = 1;
    }
  }

  activeSketchMesh.value?.update?.(frameNow);
  if (ui.showShaderScroll) {
    scroll.value?.update?.(frameNow);
  }
  renderer.value.render(scene.value, camera.value);
  updateAsciiFrame(frameNow);
});

function handleWheel(event) {
  raf.preFrame.push(() => {
    viewport.onScroll(event.deltaY);
  });
}

onMounted(() => {
  if (!sketches.sketch) {
    sketches.sampleSketches();
  }

  adaptiveDpr.value = dprRange.value.initialDpr;
  scheduleShaderPrewarm(getSketchPrewarmPriorityList().slice(0, getPrewarmBudget()));

  document.body.addEventListener("wheel", handleWheel, { passive: true });
  document.addEventListener("visibilitychange", handleVisibilityChange);
  window.addEventListener("focus", handleVisibilityChange);
  window.addEventListener("pageshow", handleVisibilityChange);
});

onBeforeUnmount(() => {
  document.body.removeEventListener("wheel", handleWheel);
  document.removeEventListener("visibilitychange", handleVisibilityChange);
  window.removeEventListener("focus", handleVisibilityChange);
  window.removeEventListener("pageshow", handleVisibilityChange);
  window.clearTimeout(prewarmTimer);
  prewarmTimer = 0;
  prewarmQueue = [];
  queuedProgramKeys.clear();
  prewarmedProgramKeys.clear();
  prewarmInFlight = false;
  prewarmGeometry?.dispose?.();
  prewarmGeometry = null;
  prewarmCamera = null;
  resetRenderPacing();
  resetAsciiFrame();
  resetPerformanceHud();
});
</script>

<template>
  <figure class="sage-renderer" :style="styles" :class="[{ show: ui.showShaderScroll }, `style-${props.visualStyle}`]">
    <TresCanvas
      :width="width"
      :height="height"
      :dpr="dpr"
      class="sage-renderer__canvas"
      render-mode="manual"
      :antialias="false"
      :alpha="false"
      :premultiplied-alpha="false"
      :preserve-drawing-buffer="false"
      power-preference="high-performance"
      ref="context"
    >
      <TresPerspectiveCamera :position="[0, 0, 1]" />

      <StageSketchMesh
        ref="activeSketchMesh"
        :key="`active-${activeRenderEpoch}`"
        :width="width"
        :height="height"
        :dpr="dpr"
        :shader="sketches.shader"
        :uniforms="sketches.uniforms"
        :volume="props.blink"
        :stream="props.motion"
        :time="renderTime"
        :opacity="1"
        :scale="stageScale"
        :position="[0, 0, 0]"
      />

      <ShaderScroll
        v-if="ui.showShaderScroll"
        ref="scroll"
        @select="selectSketch"
        :scrollY="viewport.scrollY"
        :width="viewport.width"
        :height="viewport.height"
        :dpr="dpr"
        :visible="ui.showShaderScroll"
        :sketches="sketches.iterations"
        :volume="props.blink"
        :stream="props.motion"
        :time="renderTime"
      />
    </TresCanvas>
    <div class="sage-renderer__overlay" :style="overlayStyle"></div>
    <div v-if="props.qualityMode !== 'performance'" class="sage-renderer__fx"></div>
    <pre v-if="props.visualStyle === ASCII_STYLE_ID" class="sage-renderer__ascii" :style="asciiStyle" aria-hidden="true">{{ asciiFrame }}</pre>
    <aside v-if="props.showPerformanceHud" class="sage-renderer__perf" aria-label="Performance debugger">
      <div class="sage-renderer__perf-top">
        <p>Performance</p>
        <span>P</span>
      </div>
      <div class="sage-renderer__perf-grid">
        <div class="sage-renderer__perf-card">
          <span>FPS</span>
          <strong :class="performanceToneClass">{{ performanceFps.toFixed(1) }}</strong>
        </div>
        <div class="sage-renderer__perf-card">
          <span>Frame</span>
          <strong>{{ performanceFrameMs.toFixed(1) }} ms</strong>
        </div>
        <div class="sage-renderer__perf-card">
          <span>Render</span>
          <strong>{{ performanceCanvasWidth }} x {{ performanceCanvasHeight }}</strong>
        </div>
        <div class="sage-renderer__perf-card">
          <span>Viewport</span>
          <strong>{{ performanceViewportWidth }} x {{ performanceViewportHeight }}</strong>
        </div>
        <div class="sage-renderer__perf-card">
          <span>DPR</span>
          <strong>{{ dpr.toFixed(2) }}</strong>
        </div>
        <div class="sage-renderer__perf-card">
          <span>Qualidade</span>
          <strong>{{ performanceQualityLabel }}</strong>
        </div>
        <div class="sage-renderer__perf-card">
          <span>Style</span>
          <strong>{{ performanceStyleLabel }}</strong>
        </div>
      </div>
      <p class="sage-renderer__perf-footnote">{{ performanceSampleFrames }} frames analisados por janela</p>
    </aside>
  </figure>
</template>

<style scoped>
.sage-renderer {
  position: fixed;
  inset: 0;
  z-index: 1;
  margin: 0;
  width: 100%;
  height: 100%;
  background: #02040a;
}

.sage-renderer__canvas {
  width: 100%;
  height: 100%;
  background: #02040a;
}

.sage-renderer__overlay {
  position: absolute;
  inset: 0;
  pointer-events: none;
  background:
    radial-gradient(circle at 50% 50%, rgba(var(--flash-rgb, 255, 255, 255), var(--flash-alpha, 0.12)), transparent 42%),
    radial-gradient(circle at 50% 50%, rgba(var(--color-rgb, 101, 224, 255), var(--color-alpha, 0.08)), transparent 58%);
  mix-blend-mode: screen;
  filter: blur(var(--overlay-blur, 0px));
}

.sage-renderer__fx {
  position: absolute;
  inset: 0;
  pointer-events: none;
  opacity: 0;
}

.sage-renderer__ascii {
  position: absolute;
  inset: 0;
  z-index: 2;
  width: 100%;
  height: 100%;
  margin: 0;
  padding: 0;
  overflow: hidden;
  color: #f6f6f6;
  white-space: pre;
  font-family: Consolas, "Courier New", monospace;
  font-weight: 400;
  text-rendering: geometricPrecision;
  background: #000;
  pointer-events: none;
}

.sage-renderer__perf {
  position: absolute;
  top: 18px;
  right: 18px;
  z-index: 4;
  width: min(320px, calc(100vw - 36px));
  padding: 14px;
  color: #eff5ff;
  background: rgba(5, 10, 18, 0.82);
  border: 1px solid rgba(130, 183, 255, 0.18);
  border-radius: 16px;
  box-shadow: 0 18px 60px rgba(0, 0, 0, 0.28);
  backdrop-filter: blur(18px);
  pointer-events: none;
}

.sage-renderer__perf-top {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  margin-bottom: 12px;
}

.sage-renderer__perf-top p,
.sage-renderer__perf-footnote {
  margin: 0;
}

.sage-renderer__perf-top p {
  font-size: 0.72rem;
  font-weight: 700;
  letter-spacing: 0.18em;
  text-transform: uppercase;
  color: rgba(222, 235, 255, 0.88);
}

.sage-renderer__perf-top span {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-width: 28px;
  height: 28px;
  padding: 0 8px;
  font-size: 0.8rem;
  font-weight: 700;
  border-radius: 999px;
  color: rgba(234, 243, 255, 0.92);
  background: rgba(125, 175, 255, 0.12);
  border: 1px solid rgba(125, 175, 255, 0.2);
}

.sage-renderer__perf-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 10px;
}

.sage-renderer__perf-card {
  padding: 10px 12px;
  border-radius: 12px;
  background: rgba(255, 255, 255, 0.04);
  border: 1px solid rgba(255, 255, 255, 0.05);
}

.sage-renderer__perf-card span {
  display: block;
  margin-bottom: 4px;
  font-size: 0.7rem;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  color: rgba(198, 213, 236, 0.72);
}

.sage-renderer__perf-card strong {
  display: block;
  font-size: 1rem;
  line-height: 1.2;
  color: #f5f8ff;
}

.sage-renderer__perf-card strong.is-good {
  color: #87f0a8;
}

.sage-renderer__perf-card strong.is-warning {
  color: #ffd173;
}

.sage-renderer__perf-card strong.is-bad {
  color: #ff8d8d;
}

.sage-renderer__perf-footnote {
  margin-top: 12px;
  font-size: 0.76rem;
  color: rgba(198, 213, 236, 0.74);
}

.style-ascii-bw .sage-renderer__canvas,
.style-ascii-bw .sage-renderer__overlay,
.style-ascii-bw .sage-renderer__fx {
  opacity: 0;
}

.style-bw-jagged .sage-renderer__canvas {
  image-rendering: pixelated;
}

/* Scanline + textura crua */
.style-bw-jagged .sage-renderer__fx {
  opacity: 0.52;
  mix-blend-mode: overlay;
  background:
    repeating-linear-gradient(0deg, rgba(255, 255, 255, 0.16) 0 1px, rgba(0, 0, 0, 0.05) 1px 4px),
    repeating-linear-gradient(90deg, rgba(255, 255, 255, 0.08) 0 2px, rgba(0, 0, 0, 0.08) 2px 7px);
}

/* Reticula de impressao (CMYK fake) */
.style-halftone-cmyk .sage-renderer__fx {
  opacity: 0.86;
  mix-blend-mode: multiply;
  filter: contrast(1.22) saturate(1.14);
  background:
    radial-gradient(circle at center, rgba(0, 0, 0, 0.54) 0 1.25px, transparent 1.4px) 0 0 / 6px 6px,
    radial-gradient(circle at center, rgba(0, 255, 255, 0.26) 0 1.4px, transparent 1.55px) 0.9px -0.7px / 8px 8px,
    radial-gradient(circle at center, rgba(255, 0, 255, 0.24) 0 1.4px, transparent 1.6px) -0.75px 0.9px / 8px 8px,
    radial-gradient(circle at center, rgba(255, 255, 0, 0.22) 0 1.4px, transparent 1.58px) 1px 1.2px / 8px 8px;
}

.style-pixel-brutal .sage-renderer__canvas {
  image-rendering: pixelated;
}

/* Grade dura + contraste para look "8-bit sujo" */
.style-pixel-brutal .sage-renderer__fx {
  opacity: 0.68;
  mix-blend-mode: hard-light;
  background:
    repeating-linear-gradient(0deg, rgba(255, 255, 255, 0.1) 0 1px, transparent 1px 6px),
    repeating-linear-gradient(90deg, rgba(0, 0, 0, 0.2) 0 2px, transparent 2px 6px);
}

.style-pixel-brutal-xl .sage-renderer__canvas {
  image-rendering: pixelated;
}

/* Variante com blocos maiores e grade mais marcada */
.style-pixel-brutal-xl .sage-renderer__fx {
  opacity: 0.82;
  mix-blend-mode: hard-light;
  background:
    repeating-linear-gradient(0deg, rgba(255, 255, 255, 0.16) 0 2px, transparent 2px 12px),
    repeating-linear-gradient(90deg, rgba(0, 0, 0, 0.26) 0 3px, transparent 3px 12px),
    linear-gradient(180deg, rgba(255, 196, 132, 0.06), rgba(24, 10, 0, 0.18));
}

/* CRT quente com scanline e vinheta */
.style-crt-amber .sage-renderer__fx {
  opacity: 0.74;
  mix-blend-mode: screen;
  background:
    radial-gradient(circle at center, rgba(255, 189, 96, 0.2), rgba(255, 130, 36, 0.1) 38%, rgba(0, 0, 0, 0.38) 78%),
    repeating-linear-gradient(0deg, rgba(255, 233, 189, 0.14) 0 1px, rgba(0, 0, 0, 0.18) 1px 3px),
    linear-gradient(180deg, rgba(255, 201, 116, 0.06), rgba(28, 14, 4, 0.24));
}

/* Azul/ciano com cara de duotone frio */
.style-duotone-ice .sage-renderer__fx {
  opacity: 0.64;
  mix-blend-mode: screen;
  background:
    linear-gradient(135deg, rgba(196, 242, 255, 0.12), rgba(57, 156, 255, 0.08) 52%, rgba(5, 17, 36, 0.24)),
    repeating-linear-gradient(135deg, rgba(255, 255, 255, 0.08) 0 2px, transparent 2px 10px),
    radial-gradient(circle at 50% 45%, rgba(118, 228, 255, 0.16), transparent 55%);
}

/* Quente, estourado e com bloom falso */
.style-infrared-bloom .sage-renderer__fx {
  opacity: 0.7;
  mix-blend-mode: color-dodge;
  background:
    radial-gradient(circle at 50% 50%, rgba(255, 125, 76, 0.18), transparent 42%),
    radial-gradient(circle at 50% 50%, rgba(255, 40, 24, 0.12), transparent 62%),
    repeating-linear-gradient(0deg, rgba(255, 214, 196, 0.06) 0 1px, transparent 1px 5px);
}
</style>
