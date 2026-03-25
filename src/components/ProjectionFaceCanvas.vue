<script setup>
import { computed, onBeforeUnmount, ref, shallowRef } from "vue";
import { useAnimation } from "@wearesage/vue";
import StageSketchMesh from "./StageSketchMesh.vue";

const ASCII_STYLE_ID = "ascii-bw";
const ASCII_CHARS = " .,:;irsXA253hMHGS#9B&@";

const props = defineProps({
  sketch: {
    type: Object,
    default: null,
  },
  blink: {
    type: Number,
    default: 1,
  },
  motion: {
    type: Number,
    default: 0,
  },
  width: {
    type: Number,
    default: 360,
  },
  height: {
    type: Number,
    default: 360,
  },
  visualStyle: {
    type: String,
    default: "default",
  },
  flipX: {
    type: Boolean,
    default: false,
  },
  flipY: {
    type: Boolean,
    default: false,
  },
  cropTop: {
    type: Number,
    default: 0,
  },
  cropBottom: {
    type: Number,
    default: 1,
  },
});

const context = shallowRef();
const mesh = shallowRef();
const renderTime = ref(window.performance.now());
const asciiFrame = ref("");
let asciiCanvas = null;
let asciiContext = null;
let asciiMeasureCanvas = null;
let asciiMeasureContext = null;
let lastAsciiFrameAt = 0;

function cloneValue(value) {
  return JSON.parse(JSON.stringify(value));
}

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
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
  if (!asciiMeasureContext) return fontSize * 0.6;
  asciiMeasureContext.font = `${fontSize}px Consolas, "Courier New", monospace`;
  return asciiMeasureContext.measureText("M").width || fontSize * 0.6;
}

function getAsciiMetrics() {
  const lineHeight = 0.92;
  const rows = clamp(Math.floor(props.height / 12), 18, 60);
  const fontSize = clamp(props.height / (rows * lineHeight), 5, 16);
  const charWidth = measureAsciiCharWidth(fontSize);
  const columns = clamp(Math.floor(props.width / charWidth), 24, 96);
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
  lastAsciiFrameAt = 0;
}

function updateAsciiFrame(now) {
  if (props.visualStyle !== ASCII_STYLE_ID) {
    if (asciiFrame.value) resetAsciiFrame();
    return;
  }

  if (now - lastAsciiFrameAt < 95) return;

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

  asciiFrame.value = lines.join("\n");
  lastAsciiFrameAt = now;
}

const visualStylePreset = computed(() => {
  switch (props.visualStyle) {
    case "ascii-bw":
      return {
        dpr: 0.55,
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
      };
    case "bw-jagged":
      return {
        dpr: 0.7,
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
      };
    case "halftone-cmyk":
      return {
        dpr: 1,
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
      };
    case "pixel-brutal":
      return {
        dpr: 0.35,
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
      };
    case "pixel-brutal-xl":
      return {
        dpr: 0.18,
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
      };
    case "crt-amber":
      return {
        dpr: 1,
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
      };
    case "duotone-ice":
      return {
        dpr: 1,
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
      };
    case "infrared-bloom":
      return {
        dpr: 1,
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
      };
    default:
      return {
        dpr: 1,
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
        flashRgb: "101, 224, 255",
        colorRgb: "101, 224, 255",
      };
  }
});

const faceUniforms = computed(() => cloneValue(props.sketch?.variants?.[0] || {}));
const meshKey = computed(() => `${props.sketch?.id || "empty"}-${props.sketch?.shader?.length || 0}`);
const faceDpr = computed(() => visualStylePreset.value.dpr);
const faceStyle = computed(() => ({
  filter: [
    `saturate(${(visualStylePreset.value.saturationBoost + props.blink * 0.2).toFixed(3)})`,
    `brightness(${(visualStylePreset.value.brightnessBase + props.blink * visualStylePreset.value.brightnessBlinkBoost).toFixed(3)})`,
    `contrast(${visualStylePreset.value.contrastBase.toFixed(3)})`,
    `grayscale(${visualStylePreset.value.grayscale.toFixed(3)})`,
    `sepia(${visualStylePreset.value.sepia.toFixed(3)})`,
    `hue-rotate(${visualStylePreset.value.hueRotate}deg)`,
  ].join(" "),
  transform: `scale(${props.flipX ? -1 : 1}, ${props.flipY ? -1 : 1})`,
}));
const viewportStyle = computed(() => {
  const cropTop = clamp(Number(props.cropTop || 0), 0, 1);
  const cropBottom = clamp(Number(props.cropBottom || 1), cropTop + 0.001, 1);
  const cropHeight = cropBottom - cropTop;
  return {
    bottom: "auto",
    top: `${((-cropTop / cropHeight) * 100).toFixed(4)}%`,
    height: `${((1 / cropHeight) * 100).toFixed(4)}%`,
  };
});
const overlayStyle = computed(() => ({
  "--flash-alpha": (0.08 + props.blink * 0.24).toFixed(3),
  "--color-alpha": (visualStylePreset.value.colorAlphaBase + props.blink * visualStylePreset.value.colorAlphaBoost).toFixed(3),
  "--flash-rgb": visualStylePreset.value.flashRgb,
  "--color-rgb": visualStylePreset.value.colorRgb,
}));
const asciiStyle = computed(() => {
  const metrics = getAsciiMetrics();
  return {
    fontSize: `${metrics.fontSize.toFixed(2)}px`,
    lineHeight: metrics.lineHeight.toFixed(2),
    letterSpacing: `${metrics.letterSpacing}px`,
  };
});

useAnimation((now) => {
  renderTime.value = typeof now === "number" ? now : window.performance.now();

  const renderer = context.value?.context?.renderer?.value;
  const scene = context.value?.context?.scene?.value;
  const camera = context.value?.context?.camera?.value;
  if (!renderer || !scene || !camera) return;

  mesh.value?.update?.(renderTime.value);
  renderer.render(scene, camera);
  updateAsciiFrame(renderTime.value);
});

onBeforeUnmount(() => {
  resetAsciiFrame();
});
</script>

<template>
  <div class="projection-face-canvas" :class="`style-${visualStyle}`" :style="faceStyle">
    <div class="projection-face-canvas__viewport" :style="viewportStyle">
      <TresCanvas
        ref="context"
        :width="width"
        :height="height"
        :dpr="faceDpr"
        class="projection-face-canvas__canvas"
        render-mode="manual"
        :antialias="false"
        :alpha="false"
        :premultiplied-alpha="false"
        :preserve-drawing-buffer="false"
        power-preference="high-performance"
      >
        <TresPerspectiveCamera :position="[0, 0, 1]" />

        <StageSketchMesh
          ref="mesh"
          :key="meshKey"
          :width="width"
          :height="height"
          :dpr="faceDpr"
          :shader="sketch?.shader || ''"
          :uniforms="faceUniforms"
          :volume="blink"
          :stream="motion"
          :time="renderTime"
          :opacity="1"
          :scale="1"
          :position="[0, 0, 0]"
        />
      </TresCanvas>
      <div class="projection-face-canvas__overlay" :style="overlayStyle"></div>
      <div class="projection-face-canvas__fx"></div>
      <pre v-if="visualStyle === ASCII_STYLE_ID" class="projection-face-canvas__ascii" :style="asciiStyle" aria-hidden="true">{{ asciiFrame }}</pre>
    </div>
  </div>
</template>

<style scoped>
.projection-face-canvas,
.projection-face-canvas__viewport,
.projection-face-canvas__canvas {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
  background: #000;
}

.projection-face-canvas {
  overflow: hidden;
  transform-origin: center;
}

.projection-face-canvas__viewport {
  overflow: hidden;
}

.projection-face-canvas__overlay,
.projection-face-canvas__fx,
.projection-face-canvas__ascii {
  position: absolute;
  inset: 0;
  pointer-events: none;
}

.projection-face-canvas__overlay {
  background:
    radial-gradient(circle at 50% 50%, rgba(var(--flash-rgb, 255, 255, 255), var(--flash-alpha, 0.12)), transparent 42%),
    radial-gradient(circle at 50% 50%, rgba(var(--color-rgb, 101, 224, 255), var(--color-alpha, 0.08)), transparent 58%);
  mix-blend-mode: screen;
  filter: blur(18px);
}

.projection-face-canvas__fx {
  opacity: 0;
}

.projection-face-canvas__ascii {
  margin: 0;
  overflow: hidden;
  color: #f6f6f6;
  white-space: pre;
  font-family: Consolas, "Courier New", monospace;
  font-weight: 400;
  text-rendering: geometricPrecision;
  background: #000;
}

.style-ascii-bw .projection-face-canvas__canvas,
.style-ascii-bw .projection-face-canvas__overlay,
.style-ascii-bw .projection-face-canvas__fx {
  opacity: 0;
}

.style-bw-jagged .projection-face-canvas__canvas,
.style-pixel-brutal .projection-face-canvas__canvas,
.style-pixel-brutal-xl .projection-face-canvas__canvas {
  image-rendering: pixelated;
}

.style-bw-jagged .projection-face-canvas__fx {
  opacity: 0.52;
  mix-blend-mode: overlay;
  background:
    repeating-linear-gradient(0deg, rgba(255, 255, 255, 0.16) 0 1px, rgba(0, 0, 0, 0.05) 1px 4px),
    repeating-linear-gradient(90deg, rgba(255, 255, 255, 0.08) 0 2px, rgba(0, 0, 0, 0.08) 2px 7px);
}

.style-halftone-cmyk .projection-face-canvas__fx {
  opacity: 0.86;
  mix-blend-mode: multiply;
  filter: contrast(1.22) saturate(1.14);
  background:
    radial-gradient(circle at center, rgba(0, 0, 0, 0.54) 0 1.25px, transparent 1.4px) 0 0 / 6px 6px,
    radial-gradient(circle at center, rgba(0, 255, 255, 0.26) 0 1.4px, transparent 1.55px) 0.9px -0.7px / 8px 8px,
    radial-gradient(circle at center, rgba(255, 0, 255, 0.24) 0 1.4px, transparent 1.6px) -0.75px 0.9px / 8px 8px,
    radial-gradient(circle at center, rgba(255, 255, 0, 0.22) 0 1.4px, transparent 1.58px) 1px 1.2px / 8px 8px;
}

.style-pixel-brutal .projection-face-canvas__fx {
  opacity: 0.68;
  mix-blend-mode: hard-light;
  background:
    repeating-linear-gradient(0deg, rgba(255, 255, 255, 0.1) 0 1px, transparent 1px 6px),
    repeating-linear-gradient(90deg, rgba(0, 0, 0, 0.2) 0 2px, transparent 2px 6px);
}

.style-pixel-brutal-xl .projection-face-canvas__fx {
  opacity: 0.82;
  mix-blend-mode: hard-light;
  background:
    repeating-linear-gradient(0deg, rgba(255, 255, 255, 0.16) 0 2px, transparent 2px 12px),
    repeating-linear-gradient(90deg, rgba(0, 0, 0, 0.26) 0 3px, transparent 3px 12px),
    linear-gradient(180deg, rgba(255, 196, 132, 0.06), rgba(24, 10, 0, 0.18));
}

.style-crt-amber .projection-face-canvas__fx {
  opacity: 0.74;
  mix-blend-mode: screen;
  background:
    radial-gradient(circle at center, rgba(255, 189, 96, 0.2), rgba(255, 130, 36, 0.1) 38%, rgba(0, 0, 0, 0.38) 78%),
    repeating-linear-gradient(0deg, rgba(255, 233, 189, 0.14) 0 1px, rgba(0, 0, 0, 0.18) 1px 3px),
    linear-gradient(180deg, rgba(255, 201, 116, 0.06), rgba(28, 14, 4, 0.24));
}

.style-duotone-ice .projection-face-canvas__fx {
  opacity: 0.64;
  mix-blend-mode: screen;
  background:
    linear-gradient(135deg, rgba(196, 242, 255, 0.12), rgba(57, 156, 255, 0.08) 52%, rgba(5, 17, 36, 0.24)),
    repeating-linear-gradient(135deg, rgba(255, 255, 255, 0.08) 0 2px, transparent 2px 10px),
    radial-gradient(circle at 50% 45%, rgba(118, 228, 255, 0.16), transparent 55%);
}

.style-infrared-bloom .projection-face-canvas__fx {
  opacity: 0.7;
  mix-blend-mode: color-dodge;
  background:
    radial-gradient(circle at 50% 50%, rgba(255, 125, 76, 0.18), transparent 42%),
    radial-gradient(circle at 50% 50%, rgba(255, 40, 24, 0.12), transparent 62%),
    repeating-linear-gradient(0deg, rgba(255, 214, 196, 0.06) 0 1px, transparent 1px 5px);
}
</style>
