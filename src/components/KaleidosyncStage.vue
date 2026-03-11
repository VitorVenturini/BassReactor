<script setup>
import { computed, onBeforeUnmount, onMounted, ref, shallowRef, watch } from "vue";
import ShaderScroll from "@wearesage/vue/components/webgl/ShaderScroll.vue";
import { useSketches } from "@wearesage/vue/stores/sketches";
import { useViewport } from "@wearesage/vue/stores/viewport";
import { useUI } from "@wearesage/vue/stores/ui";
import { useAnimation, useRAF } from "@wearesage/vue";
import StageSketchMesh from "./StageSketchMesh.vue";

const DESIGN_TRANSITION_MS = 900;

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
});

const emit = defineEmits(["select"]);

const raf = useRAF();
const sketches = useSketches();
const viewport = useViewport();
const ui = useUI();
const context = shallowRef();
const activeSketchMesh = shallowRef();
const scroll = shallowRef();
const activeRenderIndex = shallowRef(0);
const renderTime = ref(window.performance.now());
const transitionStartAt = ref(0);
const transitionProgress = ref(1);

const width = computed(() => viewport.width);
const height = computed(() => viewport.height);
const dpr = computed(() => {
  if (props.visualStyle === "pixel-brutal") return 0.35;
  if (props.visualStyle === "bw-jagged") return 0.7;
  return 1;
});
const styles = computed(() => ({
  width: `${width.value}px`,
  height: `${height.value}px`,
  filter: [
    `saturate(${(props.visualStyle === "bw-jagged" ? 0 : 1 + props.colorIntensity * 1.85).toFixed(3)})`,
    `brightness(${(0.92 + props.colorIntensity * 0.34 + props.blink * 0.18).toFixed(3)})`,
    `contrast(${(1 + props.colorIntensity * 0.16 + (props.visualStyle === "bw-jagged" ? 0.36 : 0)).toFixed(3)})`,
    props.visualStyle === "bw-jagged" ? "grayscale(1)" : "grayscale(0)",
  ].join(" "),
}));
const transitionActive = computed(() => transitionProgress.value < 1);
const stageScale = computed(() => 1 + Math.sin(transitionProgress.value * Math.PI) * 0.018);
const overlayOpacity = computed(() => {
  const transitionGlow = transitionActive.value ? Math.sin(transitionProgress.value * Math.PI) * 0.22 : 0;
  const liveFlash = Math.min(0.3, props.blink * (0.1 + props.colorIntensity * 0.16));
  return transitionGlow + liveFlash;
});
const overlayStyle = computed(() => ({
  opacity: overlayOpacity.value.toFixed(3),
  "--flash-alpha": (0.08 + props.blink * 0.24).toFixed(3),
  "--color-alpha": (props.visualStyle === "bw-jagged" ? 0 : 0.06 + props.colorIntensity * 0.18).toFixed(3),
}));

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

function selectSketch(sketchValue) {
  sketches.selectSketch(sketchValue);
  ui.showShaderScroll = false;
  emit("select", sketchValue);
}

watch(
  () => sketches.shader,
  (nextShader) => {
    if (!nextShader) return;
    if (transitionProgress.value === 1) {
      activeRenderIndex.value += 1;
    }
    transitionStartAt.value = window.performance.now();
    transitionProgress.value = 0;
  },
  { immediate: true }
);

watch(
  () => sketches.uniformKeysSerialized,
  () => {
    if (!sketches.shader) return;
    activeRenderIndex.value += 1;
  },
  { immediate: true }
);

useAnimation((now) => {
  const frameNow = resolveFrameTime(now);
  renderTime.value = frameNow;

  if (transitionStartAt.value) {
    const elapsed = frameNow - transitionStartAt.value;
    const linear = Math.min(1, elapsed / DESIGN_TRANSITION_MS);
    transitionProgress.value = easeOutCubic(linear);
    if (linear >= 1) {
      transitionStartAt.value = 0;
      transitionProgress.value = 1;
    }
  }

  if (!context.value?.context) {
    return;
  }
  const { renderer, scene, camera } = context.value.context;
  if (!renderer?.value || !scene?.value || !camera?.value) {
    return;
  }
  activeSketchMesh.value?.update?.(frameNow);
  scroll.value?.update?.(frameNow);
  renderer.value.render(scene.value, camera.value);
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

  document.body.addEventListener("wheel", handleWheel, { passive: true });
});

onBeforeUnmount(() => {
  document.body.removeEventListener("wheel", handleWheel);
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
        :key="`active-${activeRenderIndex}`"
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
    <div class="sage-renderer__fx"></div>
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
    radial-gradient(circle at 50% 50%, rgba(255, 255, 255, var(--flash-alpha, 0.12)), transparent 42%),
    radial-gradient(circle at 50% 50%, rgba(101, 224, 255, var(--color-alpha, 0.08)), transparent 58%);
  mix-blend-mode: screen;
  filter: blur(28px);
}

.sage-renderer__fx {
  position: absolute;
  inset: 0;
  pointer-events: none;
  opacity: 0;
}

.style-bw-jagged .sage-renderer__canvas {
  image-rendering: pixelated;
}

.style-bw-jagged .sage-renderer__fx {
  opacity: 0.52;
  mix-blend-mode: overlay;
  background:
    repeating-linear-gradient(0deg, rgba(255, 255, 255, 0.16) 0 1px, rgba(0, 0, 0, 0.05) 1px 4px),
    repeating-linear-gradient(90deg, rgba(255, 255, 255, 0.08) 0 2px, rgba(0, 0, 0, 0.08) 2px 7px);
}

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

.style-pixel-brutal .sage-renderer__fx {
  opacity: 0.68;
  mix-blend-mode: hard-light;
  background:
    repeating-linear-gradient(0deg, rgba(255, 255, 255, 0.1) 0 1px, transparent 1px 6px),
    repeating-linear-gradient(90deg, rgba(0, 0, 0, 0.2) 0 2px, transparent 2px 6px);
}
</style>
