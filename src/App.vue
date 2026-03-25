<script setup>
import { computed, onBeforeUnmount, onMounted, ref, watch } from "vue";
import { useSketches } from "@wearesage/vue/stores/sketches";
import { useUI } from "@wearesage/vue/stores/ui";
import { useViewport } from "@wearesage/vue/stores/viewport";
import KaleidosyncStage from "./components/KaleidosyncStage.vue";
import ProjectionMapper from "./components/ProjectionMapper.vue";
import { useDesktopAudio } from "./composables/useDesktopAudio.js";
import { MAPPER_POPUP_CHANNEL, MAPPER_POPUP_FEATURES } from "./mapperPopupShared.js";
import {
  DESIGN_51_ID,
  DESIGN_51_LAYOUT_VERSION,
  createDesign51Sketch,
  ensureDesign51,
  getDesign51DefaultVariant,
} from "./designs/design51.js";

const PLAY_INTERVAL_MS = 30000;
// Estilos "filtro" de tela inteira (pos-processo CSS).
// Para criar/editar estilo visual, mexa em `src/components/KaleidosyncStage.vue`:
// - computed `styles` (saturate/brightness/contrast/grayscale)
// - classes CSS `.style-*` (scanline, halftone, pixel, etc.)
const VISUAL_STYLES = [
  { id: "default", label: "Original" },
  { id: "ascii-bw", label: "ASCII PB" },
  { id: "bw-jagged", label: "PB Serrilhado" },
  { id: "halftone-cmyk", label: "Halftone CMYK" },
  { id: "pixel-brutal", label: "Pixel Brutal" },
  { id: "pixel-brutal-xl", label: "Pixel Brutal XL" },
  { id: "crt-amber", label: "CRT Ambar" },
  { id: "duotone-ice", label: "Duotone Ice" },
  { id: "infrared-bloom", label: "Infra Bloom" },
];
const DESIGN_FAMILIES = {
  // Familia citada por voce para "efeito kaleido".
  kaleido: [2, 17, 19, 22, 25, 26, 33, 40],
  // Familia citada por voce para "efeito buraco negro".
  blackHole: [49, 5, 14, 15, 24, 35, 39, 43, 45],
  // Formato colorido no fundo com filtro em cima.
  colorBackdropFilter: [3, 5, 6, 8, 12, 13, 32, 44, 45],
  // Parece celula / zoom de microscopio.
  cellMicroscope: [16, 18, 41, 46],
  // Tintas se misturando.
  inkMix: [10, 37],
  // Mesmo "motor" de movimento.
  motionTwin: [3, 8, 9, 11, 45],
  // Bolhas se formando.
  bubbleBuild: [1, 4, 7, 20, 21, 27, 28, 29, 47, 48, 50],
  // Reservadas para mapear depois em outras teclas.
  miamiVibesLines: [38, 42, 25],
  sunBlotch: [39, 43],
};

const audio = useDesktopAudio();
const sketches = useSketches();
const ui = useUI();
const viewport = useViewport();
ensureDesign51(sketches);

const uiHidden = ref(false);
const playMode = ref(false);
const playCountdown = ref(30);
const visualStyle = ref("default");
const audioInputPickerOpen = ref(false);
const projectionMapperOpen = ref(false);
const projectionMapperInstanceKey = ref(0);
const projectionMapperRef = ref(null);
const projectionMapperPopupReady = ref(false);
const projectionMapperPopupWindow = ref(null);
const projectionMapperState = ref(createProjectionMapperEmptyState());
const design51EditorOpen = ref(false);
const designInspectorOpen = ref(false);
const design51ImportInput = ref(null);
const design51ImportStatus = ref("");
const design51ImportStatusKind = ref("idle");
const design51TemplateSketch = createDesign51Sketch();
const design51BaseVariant = ref(cloneValue(getDesign51DefaultVariant()));
const design51SourceIndex = ref(null);
const design51SourceDraft = ref("");

let playTimer = 0;
let playCountdownTimer = 0;
let nextPlayAt = 0;
let unsubscribeElectronShortcut = null;
let autoConnectTriggered = false;
let mapperPopupChannel = null;

function cloneValue(value) {
  return JSON.parse(JSON.stringify(value));
}

function createProjectionMapperEmptyState() {
  return {
    faces: [],
    selectedFaceId: null,
    faceOptions: [],
  };
}

const sketchOptions = computed(() =>
  (sketches.iterations || []).map((item, index) => {
    const fallback = `Design ${String(index + 1).padStart(2, "0")}`;
    const rawName = item?.id ? item.id.replace(/[-_]/g, " ").slice(0, 36) : fallback;
    return {
      index,
      label: rawName,
      code: fallback,
    };
  })
);

function resolveSketchIndex(sketchValue) {
  if (!sketchValue) return -1;
  const iterations = sketches.iterations || [];
  const sketchId = sketchValue.id;

  if (sketchId) {
    const indexById = iterations.findIndex((item) => item?.id === sketchId);
    if (indexById !== -1) return indexById;
  }

  const shader = sketchValue.shader;
  if (!shader) return -1;
  return iterations.findIndex((item) => item?.shader === shader);
}

const currentSketchIndex = computed(() => {
  return resolveSketchIndex(sketches.sketch);
});
const currentSketch = computed(() => sketches.sketch || null);
const isDesign51Active = computed(() => sketches.sketch?.id === DESIGN_51_ID);
const design51EditorVisible = computed(() => isDesign51Active.value && design51EditorOpen.value && !projectionMapperOpen.value && !uiHidden.value && !ui.showShaderScroll);
const designInspectorVisible = computed(() => designInspectorOpen.value && !projectionMapperOpen.value && !uiHidden.value && !ui.showShaderScroll);
const baseDesignOptions = computed(() =>
  (sketches.iterations || []).slice(0, 50).map((item, index) => ({
    index,
    value: String(index),
    code: `Design ${String(index + 1).padStart(2, "0")}`,
    label: item?.id ? item.id.replace(/[-_]/g, " ").slice(0, 42) : `Design ${index + 1}`,
  }))
);

watch(
  design51SourceIndex,
  (nextValue) => {
    design51SourceDraft.value = Number.isInteger(nextValue) ? String(nextValue) : "";
  },
  { immediate: true }
);

const sketchName = computed(() => {
  const option = sketchOptions.value[currentSketchIndex.value];
  if (!option) return "Sem design";
  if (option.label === option.code) return option.code;
  return `${option.code} - ${option.label}`;
});

watch(
  isDesign51Active,
  (active) => {
    design51EditorOpen.value = active;
  },
  { immediate: true }
);

function getDesign51StoredSketch() {
  return (sketches.iterations || []).find((item) => item?.id === DESIGN_51_ID) || null;
}

function setDesign51Sketch(nextSketch, sourceIndex = null) {
  const iterations = sketches.iterations || [];
  const clonedSketch = cloneValue({
    ...nextSketch,
    id: DESIGN_51_ID,
    variants: Array.isArray(nextSketch?.variants) && nextSketch.variants.length ? cloneValue(nextSketch.variants) : [cloneValue(getDesign51DefaultVariant())],
  });

  if (iterations.length <= 50) {
    iterations.push(clonedSketch);
  } else {
    iterations.splice(50, 1, clonedSketch);
  }

  design51BaseVariant.value = cloneValue(clonedSketch.variants?.[0] || getDesign51DefaultVariant());
  design51SourceIndex.value = Number.isInteger(sourceIndex) ? sourceIndex : null;

  if (isDesign51Active.value) {
    sketches.selectSketch(cloneValue(clonedSketch), "pointer");
    if (playMode.value) schedulePlayCycle();
  }

  return clonedSketch;
}

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

function isStrictPositiveUniformKey(key) {
  return /zoom|contrast|orb|ball|radius|size|thickness|divider|divide|div|multiplier|split|shape|brightness|outer|inner|center|sides|iterations|iterator|orbs|count/i.test(
    key
  );
}

function isIntegerUniformKey(key) {
  return /sides|iterations|iterator|orbs|count/i.test(key);
}

function buildZeroValueForUniform(key, value) {
  if (typeof value === "boolean") return false;
  if (Array.isArray(value)) {
    if (/col|color|rgb|red|green|blue/i.test(key)) {
      return value.map(() => 1);
    }
    return value.map(() => 0);
  }
  if (typeof value !== "number" || !Number.isFinite(value)) return value;
  if (isIntegerUniformKey(key)) return 1;
  if (/zoom|contrast|brightness/i.test(key)) return 1;
  if (isStrictPositiveUniformKey(key)) return 1;
  return 0;
}

function buildZeroVariantFromSketch(sourceSketch) {
  const sourceVariant = sourceSketch?.variants?.[0] || {};
  return Object.fromEntries(
    Object.entries(sourceVariant).map(([key, entry]) => [key, { value: buildZeroValueForUniform(key, entry?.value) }])
  );
}

function useDesign51Template() {
  setDesign51Sketch(createDesign51Sketch(), null);
  setDesign51ImportStatus("Design 51 voltou para o template original.", "success");
}

function applyBaseDesignTo51(sourceIndex) {
  const nextIndex = Number(sourceIndex);
  if (!Number.isInteger(nextIndex) || nextIndex < 0 || nextIndex >= 50) {
    useDesign51Template();
    return;
  }

  const sourceSketch = cloneValue((sketches.iterations || [])[nextIndex]);
  if (!sourceSketch) return;

  setDesign51Sketch(sourceSketch, nextIndex);

  const option = baseDesignOptions.value.find((item) => item.index === nextIndex);
  if (option) {
    setDesign51ImportStatus(`${option.code} copiado fielmente para o 51.`, "success");
    return;
  }
  setDesign51ImportStatus(`Design ${String(nextIndex + 1).padStart(2, "0")} copiado fielmente para o 51.`, "success");
}

function getSelectedDesign51SourceIndex() {
  const rawValue = String(design51SourceDraft.value || "");
  if (rawValue === "") return null;
  const nextIndex = Number(rawValue);
  if (!Number.isInteger(nextIndex) || nextIndex < 0 || nextIndex >= 50) return null;
  return nextIndex;
}

function startDesign51FromSelectedShader(mode = "clone") {
  const nextIndex = getSelectedDesign51SourceIndex();
  if (nextIndex === null) {
    useDesign51Template();
    return;
  }

  if (mode === "clone") {
    applyBaseDesignTo51(nextIndex);
    return;
  }

  const sourceSketch = cloneValue((sketches.iterations || [])[nextIndex]);
  if (!sourceSketch) return;

  setDesign51Sketch(
    {
      ...sourceSketch,
      variants: [buildZeroVariantFromSketch(sourceSketch)],
    },
    nextIndex
  );

  const option = baseDesignOptions.value.find((item) => item.index === nextIndex);
  if (option) {
    setDesign51ImportStatus(`${option.code} carregado no 51 em modo do zero.`, "success");
    return;
  }
  setDesign51ImportStatus(`Design ${String(nextIndex + 1).padStart(2, "0")} carregado no 51 em modo do zero.`, "success");
}

function handleDesign51SourceDraftChange(event) {
  design51SourceDraft.value = String(event.target.value || "");
}

design51BaseVariant.value = cloneValue(getDesign51StoredSketch()?.variants?.[0] || getDesign51DefaultVariant());

function inferInspectorFieldMeta(key, value) {
  const label = key
    .replace(/([a-z0-9])([A-Z])/g, "$1 $2")
    .replace(/[_-]/g, " ")
    .replace(/\s+/g, " ")
    .trim();

  if (typeof value === "boolean") {
    return { key, label, type: "boolean", defaultValue: value };
  }

  if (Array.isArray(value)) {
    const maxMagnitude = Math.max(1, ...value.map((entry) => Math.abs(Number(entry) || 0)));
    return {
      key,
      label,
      type: "vector",
      step: maxMagnitude <= 2 ? 0.01 : maxMagnitude <= 20 ? 0.1 : 1,
      min: value.some((entry) => Number(entry) < 0) ? -maxMagnitude * 4 : 0,
      max: maxMagnitude * 4,
      defaultValue: value,
    };
  }

  const numericValue = Number(value || 0);
  const integer = /sides|iterations|iterator|orbs|count|divider|div$/i.test(key);
  const maxMagnitude = Math.max(1, Math.abs(numericValue), integer ? Math.abs(numericValue) + 2 : 0);

  return {
    key,
    label,
    type: "number",
    integer,
    step: integer ? 1 : maxMagnitude <= 2 ? 0.01 : maxMagnitude <= 20 ? 0.1 : 1,
    min: numericValue < 0 ? -maxMagnitude * 4 : 0,
    max: maxMagnitude * 4,
    defaultValue: numericValue,
  };
}

function getActiveVariantIndex() {
  const rawIndex = Number(sketches.variant);
  return Number.isInteger(rawIndex) && rawIndex >= 0 ? rawIndex : 0;
}

const inspectorFields = computed(() => {
  const activeVariantIndex = getActiveVariantIndex();
  const uniforms = sketches.uniforms || currentSketch.value?.variants?.[activeVariantIndex] || currentSketch.value?.variants?.[0] || {};
  return Object.keys(uniforms)
    .sort((a, b) => a.localeCompare(b))
    .map((key) => inferInspectorFieldMeta(key, uniforms[key]?.value));
});

const inspectorShaderDraft = ref(currentSketch.value?.shader || "");

watch(
  () => currentSketch.value?.shader,
  (shader) => {
    inspectorShaderDraft.value = shader || "";
  },
  { immediate: true }
);

function normalizeInspectorValue(field, rawValue) {
  if (field.type === "boolean") {
    return Boolean(rawValue);
  }

  if (field.type === "vector") {
    const source = Array.isArray(rawValue) ? rawValue : [];
    return source.map((entry) => {
      let nextEntry = Number(entry);
      if (!Number.isFinite(nextEntry)) nextEntry = 0;
      if (typeof field.min === "number") nextEntry = Math.max(field.min, nextEntry);
      if (typeof field.max === "number") nextEntry = Math.min(field.max, nextEntry);
      return Number(nextEntry.toFixed(4));
    });
  }

  let nextValue = Number(rawValue);
  if (!Number.isFinite(nextValue)) {
    nextValue = Number(field.defaultValue ?? 0);
  }
  if (typeof field.min === "number") nextValue = Math.max(field.min, nextValue);
  if (typeof field.max === "number") nextValue = Math.min(field.max, nextValue);
  if (field.integer) nextValue = Math.round(nextValue);
  return Number(nextValue.toFixed(4));
}

function updateCurrentSketchUniform(key, nextValue) {
  if (!currentSketch.value) return;
  const activeVariantIndex = getActiveVariantIndex();

  if (!currentSketch.value.variants?.[activeVariantIndex]) {
    currentSketch.value.variants ||= [];
    currentSketch.value.variants[activeVariantIndex] = {};
  }
  currentSketch.value.variants[activeVariantIndex][key] = { value: nextValue };

  if (!sketches.uniforms?.[key]) {
    sketches.uniforms[key] = { value: nextValue };
  } else {
    sketches.uniforms[key].value = nextValue;
  }

  const activeIndex = currentSketchIndex.value;
  if (activeIndex >= 0 && sketches.iterations?.[activeIndex]) {
    if (!sketches.iterations[activeIndex].variants?.[activeVariantIndex]) {
      sketches.iterations[activeIndex].variants ||= [];
      sketches.iterations[activeIndex].variants[activeVariantIndex] = {};
    }
    sketches.iterations[activeIndex].variants[activeVariantIndex][key] = { value: nextValue };
  }
}

function updateInspectorField(field, rawValue) {
  updateCurrentSketchUniform(field.key, normalizeInspectorValue(field, rawValue));
}

function getInspectorFieldValue(key) {
  return sketches.uniforms?.[key]?.value ?? currentSketch.value?.variants?.[0]?.[key]?.value;
}

function formatInspectorFieldValue(field) {
  const value = getInspectorFieldValue(field.key);
  if (field.type === "boolean") return value ? "On" : "Off";
  if (field.type === "vector") return (Array.isArray(value) ? value : []).map((entry) => Number(entry || 0).toFixed(2)).join(", ");
  if (field.integer) return String(Math.round(Number(value || 0)));
  return Number(value || 0).toFixed(2);
}

function getInspectorVectorValues(field) {
  const value = getInspectorFieldValue(field.key);
  return Array.isArray(value) ? value : [];
}

function updateInspectorVectorField(field, componentIndex, rawValue) {
  const nextValues = [...getInspectorVectorValues(field)];
  nextValues[componentIndex] = rawValue;
  updateInspectorField(field, nextValues);
}

function applyInspectorShader() {
  if (!currentSketch.value) return;
  const nextShader = String(inspectorShaderDraft.value || "");
  currentSketch.value.shader = nextShader;
  sketches.shader = nextShader;
  const activeIndex = currentSketchIndex.value;
  if (activeIndex >= 0 && sketches.iterations?.[activeIndex]) {
    sketches.iterations[activeIndex].shader = nextShader;
  }
}

function downloadCurrentSketchJson() {
  if (!currentSketch.value) return;
  const payload = {
    index: currentSketchIndex.value,
    sketch: cloneValue(currentSketch.value),
    uniforms: cloneValue(sketches.uniforms || {}),
    exportedAt: new Date().toISOString(),
  };
  const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `bass-reactor-design-${String(currentSketchIndex.value + 1).padStart(2, "0")}-snapshot.json`;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

function cloneCurrentSketchTo51() {
  if (!currentSketch.value || currentSketch.value.id === DESIGN_51_ID) return;
  setDesign51Sketch(currentSketch.value, currentSketchIndex.value >= 0 && currentSketchIndex.value < 50 ? currentSketchIndex.value : null);
  sketches.selectSketchByIndex(50, "pointer");
  designInspectorOpen.value = false;
  design51EditorOpen.value = true;
  setDesign51ImportStatus("Clone fiel aplicado no Design 51. Continue editando no Editor 51.", "success");
}

function setDesign51ImportStatus(message, kind = "idle") {
  design51ImportStatus.value = message;
  design51ImportStatusKind.value = kind;
}

function getDesign51FieldValue(key) {
  if (isDesign51Active.value && sketches.uniforms?.[key]) {
    return sketches.uniforms[key].value;
  }

  const storedValue = getDesign51StoredSketch()?.variants?.[0]?.[key]?.value;
  if (storedValue !== undefined) {
    return storedValue;
  }

  return design51BaseVariant.value[key]?.value ?? design51TemplateSketch.variants[0]?.[key]?.value;
}

function normalizeDesign51Value(field, rawValue) {
  if (field.type === "boolean") {
    return Boolean(rawValue);
  }

  let nextValue = Number(rawValue);
  if (!Number.isFinite(nextValue)) {
    nextValue = Number(field.defaultValue ?? 0);
  }

  if (typeof field.min === "number") {
    nextValue = Math.max(field.min, nextValue);
  }
  if (typeof field.max === "number") {
    nextValue = Math.min(field.max, nextValue);
  }
  if (field.integer) {
    nextValue = Math.round(nextValue);
  }

  return Number(nextValue.toFixed(4));
}

function applyDesign51FieldValue(key, nextValue) {
  const storedSketch = getDesign51StoredSketch();
  if (!storedSketch) return;

  if (!storedSketch.variants?.[0]) {
    storedSketch.variants = [cloneValue(design51BaseVariant.value)];
  }
  storedSketch.variants[0][key] = { value: nextValue };

  if (!isDesign51Active.value) return;

  if (!sketches.sketch?.variants?.[0]) {
    sketches.sketch.variants = [cloneValue(design51BaseVariant.value)];
  }
  sketches.sketch.variants[0][key] = { value: nextValue };

  if (!sketches.uniforms?.[key]) {
    sketches.uniforms[key] = { value: nextValue };
    return;
  }

  sketches.uniforms[key].value = nextValue;
}

function updateDesign51Field(field, rawValue) {
  applyDesign51FieldValue(field.key, normalizeDesign51Value(field, rawValue));
}

function resetDesign51Editor() {
  Object.entries(design51BaseVariant.value || {}).forEach(([key, entry]) => {
    applyDesign51FieldValue(key, entry.value);
  });
  setDesign51ImportStatus("Layout resetado para a base atual.", "success");
}

function formatDesign51FieldValue(field) {
  const value = getDesign51FieldValue(field.key);
  if (field.type === "boolean") {
    return value ? "On" : "Off";
  }
  if (field.integer) {
    return String(Math.round(Number(value || 0)));
  }
  return Number(value || 0).toFixed(2);
}

function toggleDesign51Editor() {
  if (!isDesign51Active.value) return;
  if (projectionMapperOpen.value) {
    closeProjectionMapper();
  }
  designInspectorOpen.value = false;
  design51EditorOpen.value = !design51EditorOpen.value;
}

function toggleDesignInspector() {
  if (!currentSketch.value) return;
  if (projectionMapperOpen.value) {
    closeProjectionMapper();
  }
  design51EditorOpen.value = false;
  designInspectorOpen.value = !designInspectorOpen.value;
}

function closeProjectionMapper() {
  setWorkspaceMode("visualizer");
}

function setWorkspaceMode(mode) {
  const shouldOpenMapper = String(mode || "visualizer") === "mapper";
  if (projectionMapperOpen.value === shouldOpenMapper) return;
  projectionMapperOpen.value = shouldOpenMapper;
  if (projectionMapperOpen.value) {
    design51EditorOpen.value = false;
    designInspectorOpen.value = false;
    ui.showShaderScroll = false;
    openProjectionMapperPopup();
    return;
  }
  projectionMapperPopupReady.value = false;
  closeProjectionMapperPopup();
  projectionMapperState.value = createProjectionMapperEmptyState();
}

function toggleAudioInputPicker() {
  audioInputPickerOpen.value = !audioInputPickerOpen.value;
  if (audioInputPickerOpen.value) {
    audio.refreshInputDevices();
  }
}

function handleAudioInputDeviceChange(event) {
  audio.selectedInputDeviceId.value = String(event.target.value || "");
}

function connectSelectedAudioInput() {
  audio.connectInputDevice(audio.selectedInputDeviceId.value);
}

function ensureMapperPopupChannel() {
  if (mapperPopupChannel || typeof BroadcastChannel === "undefined") return;
  mapperPopupChannel = new BroadcastChannel(MAPPER_POPUP_CHANNEL);
  mapperPopupChannel.onmessage = (event) => {
    const message = event.data || {};
    if (message.type === "mapper-popup-ready") {
      projectionMapperPopupReady.value = true;
      syncMapperPopupState();
      return;
    }
    if (message.type === "mapper-popup-closing") {
      projectionMapperPopupReady.value = false;
      projectionMapperPopupWindow.value = null;
      return;
    }
    if (message.type === "mapper-command") {
      projectionMapperRef.value?.applyCommand?.(message.payload || {});
    }
  };
}

function syncMapperPopupState() {
  if (!mapperPopupChannel || !projectionMapperPopupReady.value) return;
  mapperPopupChannel.postMessage({
    type: "mapper-state-sync",
    payload: cloneValue(projectionMapperState.value),
  });
}

function handleProjectionMapperStateChange(nextState) {
  projectionMapperState.value = cloneValue(nextState || createProjectionMapperEmptyState());
  syncMapperPopupState();
}

function openProjectionMapperPopup() {
  ensureMapperPopupChannel();

  if (window.bassReactorElectron?.openMapperPopup) {
    window.bassReactorElectron.openMapperPopup();
    return;
  }

  if (projectionMapperPopupWindow.value && !projectionMapperPopupWindow.value.closed) {
    projectionMapperPopupWindow.value.focus();
    return;
  }

  const popup = window.open("./vue-mapper-popup.html", "bass_reactor_mapper_popup", MAPPER_POPUP_FEATURES);
  if (!popup) return;
  projectionMapperPopupWindow.value = popup;
  projectionMapperPopupReady.value = false;
  popup.addEventListener("beforeunload", () => {
    projectionMapperPopupReady.value = false;
    projectionMapperPopupWindow.value = null;
  });
}

function closeProjectionMapperPopup() {
  if (window.bassReactorElectron?.closeMapperPopup) {
    window.bassReactorElectron.closeMapperPopup();
  }
  if (projectionMapperPopupWindow.value && !projectionMapperPopupWindow.value.closed) {
    projectionMapperPopupWindow.value.close();
  }
  projectionMapperPopupWindow.value = null;
}

function collectDesign51Values() {
  return Object.fromEntries(
    Object.keys(getDesign51StoredSketch()?.variants?.[0] || {}).map((key) => [key, getDesign51FieldValue(key)])
  );
}

function buildDesign51LayoutPayload() {
  const storedSketch = getDesign51StoredSketch() || design51TemplateSketch;
  return {
    kind: "bass-reactor-design51-layout",
    version: DESIGN_51_LAYOUT_VERSION,
    designId: DESIGN_51_ID,
    exportedAt: new Date().toISOString(),
    visualStyle: visualStyle.value,
    sourceDesignIndex: design51SourceIndex.value,
    shader: storedSketch.shader,
    values: collectDesign51Values(),
  };
}

function downloadDesign51Layout() {
  const payload = buildDesign51LayoutPayload();
  const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const stamp = new Date().toISOString().replace(/[:.]/g, "-");
  const link = document.createElement("a");
  link.href = url;
  link.download = `bass-reactor-design51-${stamp}.json`;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
  setDesign51ImportStatus("Layout exportado em JSON.", "success");
}

function triggerDesign51Import() {
  design51ImportInput.value?.click?.();
}

function applyImportedDesign51Values(values) {
  let appliedCount = 0;

  Object.entries(values || {}).forEach(([key, rawValue]) => {
    const field = inferInspectorFieldMeta(key, rawValue);
    applyDesign51FieldValue(key, normalizeInspectorValue(field, rawValue));
    appliedCount += 1;
  });

  return appliedCount;
}

async function importDesign51Layout(event) {
  const file = event.target?.files?.[0];
  if (!file) return;

  try {
    const text = await file.text();
    const parsed = JSON.parse(text);
    const values =
      parsed?.kind === "bass-reactor-design51-layout" && parsed?.values && typeof parsed.values === "object"
        ? parsed.values
        : parsed;

    if (!values || typeof values !== "object" || Array.isArray(values)) {
      throw new Error("Formato invalido.");
    }

    if (parsed?.visualStyle && VISUAL_STYLES.some((style) => style.id === parsed.visualStyle)) {
      visualStyle.value = parsed.visualStyle;
    }

    if (Number.isInteger(parsed?.sourceDesignIndex) && parsed.sourceDesignIndex >= 0 && parsed.sourceDesignIndex < 50) {
      applyBaseDesignTo51(parsed.sourceDesignIndex);
    } else if (typeof parsed?.shader === "string" && parsed.shader.trim()) {
      setDesign51Sketch(
        {
          id: DESIGN_51_ID,
          shader: parsed.shader,
          variants: [Object.fromEntries(Object.entries(values).map(([key, rawValue]) => [key, { value: rawValue }]))],
        },
        null
      );
    } else {
      useDesign51Template();
    }

    const appliedCount = applyImportedDesign51Values(values);
    if (!appliedCount) {
      throw new Error("Nenhum campo reconhecido.");
    }

    setDesign51ImportStatus(`Layout importado com ${appliedCount} campos aplicados.`, "success");
  } catch (error) {
    setDesign51ImportStatus(`Falha ao importar JSON: ${error?.message || "arquivo invalido"}.`, "error");
  } finally {
    if (event.target) {
      event.target.value = "";
    }
  }
}

function clearPlayTimers() {
  window.clearTimeout(playTimer);
  window.clearInterval(playCountdownTimer);
  playTimer = 0;
  playCountdownTimer = 0;
}

function isElectronRuntime() {
  return Boolean(window.bassReactorElectron?.isElectron);
}

function tryAutoConnectAudio() {
  if (autoConnectTriggered) return;
  autoConnectTriggered = true;
  if (audio.running.value || audio.busy.value) return;
  audio.connectDesktop();
}

function syncPlayCountdown() {
  if (!playMode.value || !nextPlayAt) {
    playCountdown.value = 30;
    return;
  }
  playCountdown.value = Math.max(1, Math.ceil((nextPlayAt - Date.now()) / 1000));
}

function schedulePlayCycle() {
  clearPlayTimers();
  if (!playMode.value) {
    playCountdown.value = 30;
    nextPlayAt = 0;
    return;
  }

  nextPlayAt = Date.now() + PLAY_INTERVAL_MS;
  syncPlayCountdown();
  playCountdownTimer = window.setInterval(syncPlayCountdown, 250);
  playTimer = window.setTimeout(() => {
    nextSketch("autoplay");
  }, PLAY_INTERVAL_MS);
}

function togglePlayMode() {
  playMode.value = !playMode.value;
  schedulePlayCycle();
}

function toggleUiHidden() {
  uiHidden.value = !uiHidden.value;
  if (uiHidden.value) {
    ui.showShaderScroll = false;
  }
}

function toggleDesigns() {
  ui.showShaderScroll = !ui.showShaderScroll;
  if (ui.showShaderScroll) {
    uiHidden.value = false;
  }
}

function selectSketchAtIndex(nextIndex, source = "keyboard") {
  const total = sketchOptions.value.length;
  if (!Number.isInteger(nextIndex) || nextIndex < 0 || nextIndex >= total) return;
  sketches.selectSketchByIndex(nextIndex, source);
  if (playMode.value) schedulePlayCycle();
}

function nextSketch(source = "keyboard") {
  const total = sketchOptions.value.length;
  if (!total) return;
  const currentIndex = currentSketchIndex.value;
  const nextIndex = currentIndex < 0 ? 0 : (currentIndex + 1) % total;
  selectSketchAtIndex(nextIndex, source);
}

function previousSketch(source = "keyboard") {
  const total = sketchOptions.value.length;
  if (!total) return;
  const currentIndex = currentSketchIndex.value;
  const nextIndex = currentIndex < 0 ? total - 1 : (currentIndex - 1 + total) % total;
  selectSketchAtIndex(nextIndex, source);
}

function randomSketch(source = "keyboard") {
  const total = sketchOptions.value.length;
  if (!total) return;

  let nextIndex = Math.floor(Math.random() * total);
  const currentIndex = currentSketchIndex.value;

  if (total > 1 && currentIndex >= 0 && nextIndex === currentIndex) {
    nextIndex = (currentIndex + 1 + Math.floor(Math.random() * (total - 1))) % total;
  }

  selectSketchAtIndex(nextIndex, source);
}

function getFamilyIndexes(familyName) {
  const designNumbers = DESIGN_FAMILIES[familyName];
  if (!Array.isArray(designNumbers)) return [];
  const total = sketchOptions.value.length;
  return [...new Set(designNumbers.map((n) => Number(n) - 1).filter((index) => index >= 0 && index < total))];
}

function randomSketchFromIndexes(indexes, source = "keyboard") {
  if (!Array.isArray(indexes) || !indexes.length) return;

  const currentIndex = currentSketchIndex.value;
  let pool = indexes;
  if (indexes.length > 1 && currentIndex >= 0 && indexes.includes(currentIndex)) {
    pool = indexes.filter((index) => index !== currentIndex);
  }

  const nextIndex = pool[Math.floor(Math.random() * pool.length)];
  selectSketchAtIndex(nextIndex, source);
}

function randomSketchFromFamily(familyName, source = "keyboard") {
  const indexes = getFamilyIndexes(familyName);
  if (!indexes.length) {
    randomSketch(source);
    return;
  }
  randomSketchFromIndexes(indexes, source);
}

function isRandomSketchShortcut(event) {
  if (event.code === "NumpadDivide") return true;
  if (event.key === "/" && event.location === 3) return true;
  if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "q") return true;
  return false;
}

function isAltLetterShortcut(event, letter) {
  return event.altKey && !event.ctrlKey && !event.metaKey && !event.shiftKey && event.key.toLowerCase() === letter;
}

function handleVisualShortcutPayload(payload, source = "global-shortcut") {
  const familyRaw = String(payload?.family || "random");
  const family = familyRaw.toLowerCase();

  if (family === "next" || family === "next-order" || family === "next-sketch") {
    nextSketch();
    return;
  }
  if (family === "kaleido") {
    randomSketchFromFamily("kaleido", source);
    return;
  }
  if (family === "black-hole" || family === "blackhole" || family === "black_hole") {
    randomSketchFromFamily("blackHole", source);
    return;
  }
  if (family === "rosette" || family === "rosette-balls" || family === "balls-rosette") {
    randomSketchFromFamily("bubbleBuild", source);
    return;
  }
  if (
    family === "color-backdrop-filter" ||
    family === "color-backdrop" ||
    family === "orbital" ||
    family === "orbital-trig" ||
    family === "orbitaltrig"
  ) {
    randomSketchFromFamily("colorBackdropFilter", source);
    return;
  }
  if (family === "cell" || family === "microscope" || family === "cell-microscope") {
    randomSketchFromFamily("cellMicroscope", source);
    return;
  }
  if (family === "ink" || family === "ink-mix") {
    randomSketchFromFamily("inkMix", source);
    return;
  }
  if (family === "motion" || family === "motion-twin") {
    randomSketchFromFamily("motionTwin", source);
    return;
  }
  if (family === "bubble" || family === "bubble-build") {
    randomSketchFromFamily("bubbleBuild", source);
    return;
  }

  randomSketch(source);
}

function selectSketchByIndex(event) {
  const nextIndex = Number(event.target.value);
  selectSketchAtIndex(nextIndex, "pointer");
}

function selectVisualStyle(event) {
  const nextStyle = String(event.target.value || "default");
  if (!VISUAL_STYLES.some((style) => style.id === nextStyle)) return;
  visualStyle.value = nextStyle;
}

function handleKeydown(event) {
  const target = event.target;
  const editable =
    target instanceof HTMLInputElement ||
    target instanceof HTMLTextAreaElement ||
    target instanceof HTMLSelectElement ||
    target?.isContentEditable;

  // Em desktop (Electron) os Alt+letra sao globais via main.mjs.
  // Em web, mantemos fallback local.
  if (!editable && !isElectronRuntime()) {
    if (isAltLetterShortcut(event, "q")) {
      event.preventDefault();
      randomSketch("keyboard");
      return;
    }
    if (isAltLetterShortcut(event, "w")) {
      event.preventDefault();
      randomSketchFromFamily("kaleido", "keyboard-family");
      return;
    }
    if (isAltLetterShortcut(event, "e")) {
      event.preventDefault();
      randomSketchFromFamily("blackHole", "keyboard-family");
      return;
    }
    if (isAltLetterShortcut(event, "y")) {
      event.preventDefault();
      randomSketchFromFamily("cellMicroscope", "keyboard-family");
      return;
    }
    if (isAltLetterShortcut(event, "u")) {
      event.preventDefault();
      randomSketchFromFamily("inkMix", "keyboard-family");
      return;
    }
    if (isAltLetterShortcut(event, "i")) {
      event.preventDefault();
      randomSketchFromFamily("motionTwin", "keyboard-family");
      return;
    }
    if (isAltLetterShortcut(event, "o")) {
      event.preventDefault();
      randomSketchFromFamily("bubbleBuild", "keyboard-family");
      return;
    }
    if (isAltLetterShortcut(event, "t")) {
      event.preventDefault();
      randomSketchFromFamily("colorBackdropFilter", "keyboard-family");
      return;
    }
    if (isAltLetterShortcut(event, "x")) {
      event.preventDefault();
      nextSketch();
      return;
    }
  }

  if (!editable && !isElectronRuntime() && isRandomSketchShortcut(event)) {
    event.preventDefault();
    randomSketch("keyboard");
    return;
  }
  if (!editable && event.key === "Backspace") {
    event.preventDefault();
    toggleDesignInspector();
    return;
  }
  if (event.key === "ArrowRight" || event.key === "ArrowDown") {
    event.preventDefault();
    nextSketch();
  }
  if (event.key === "ArrowLeft" || event.key === "ArrowUp") {
    event.preventDefault();
    previousSketch();
  }
  if (event.key.toLowerCase() === "d") {
    event.preventDefault();
    toggleDesigns();
  }
  if (event.key.toLowerCase() === "f") {
    event.preventDefault();
    viewport.toggleFullscreen();
  }
  if (event.key.toLowerCase() === "h") {
    event.preventDefault();
    toggleUiHidden();
  }
  if (event.key.toLowerCase() === "m") {
    event.preventDefault();
    togglePlayMode();
  }
  if (event.key === "Escape") {
    ui.showShaderScroll = false;
    uiHidden.value = false;
    if (design51EditorOpen.value) {
      design51EditorOpen.value = false;
    }
    if (designInspectorOpen.value) {
      designInspectorOpen.value = false;
    }
    if (projectionMapperOpen.value) {
      closeProjectionMapper();
    }
  }
}

onMounted(() => {
  ensureMapperPopupChannel();
  if (window.bassReactorElectron?.onVisualShortcut) {
    unsubscribeElectronShortcut = window.bassReactorElectron.onVisualShortcut((payload) => {
      handleVisualShortcutPayload(payload, "global-shortcut");
    });
  } else if (window.bassReactorElectron?.onRandomVisualShortcut) {
    unsubscribeElectronShortcut = window.bassReactorElectron.onRandomVisualShortcut(() => {
      randomSketch("global-shortcut");
    });
  }

  if (isElectronRuntime()) {
    window.setTimeout(tryAutoConnectAudio, 280);
  }

  window.addEventListener("keydown", handleKeydown);
});

onBeforeUnmount(() => {
  clearPlayTimers();
  closeProjectionMapperPopup();
  if (mapperPopupChannel) {
    mapperPopupChannel.close();
    mapperPopupChannel = null;
  }
  if (typeof unsubscribeElectronShortcut === "function") {
    unsubscribeElectronShortcut();
    unsubscribeElectronShortcut = null;
  }
  window.removeEventListener("keydown", handleKeydown);
});
</script>

<template>
  <div class="ks-app">
    <KaleidosyncStage
      v-if="!projectionMapperOpen"
      :blink="audio.blink.value"
      :motion="audio.motionStream.value"
      :color-intensity="audio.colorIntensity.value"
      :visual-style="visualStyle"
    />
    <ProjectionMapper
      v-else
      :key="projectionMapperInstanceKey"
      ref="projectionMapperRef"
      :sketches="sketches.iterations || []"
      :blink="audio.blink.value"
      :motion="audio.motionStream.value"
      @state-change="handleProjectionMapperStateChange"
    />

    <div v-if="!projectionMapperOpen" class="ks-gradient"></div>

    <aside class="ks-panel ks-panel--compact" :class="{ 'is-hidden': uiHidden || ui.showShaderScroll }">
      <div class="ks-panel__top">
        <div>
          <p class="eyebrow">Kaleidosync Mode</p>
          <h1>Kaleido Reactor</h1>
        </div>
        <button class="ghost" @click="toggleUiHidden">Hide UI</button>
      </div>

      <p class="hint">Modo desktop com captura automatica do audio do sistema e popup separado para o mapper.</p>

      <nav class="ks-mode-tabs" aria-label="Modo da tela">
        <button class="ks-mode-tabs__tab" :class="{ 'is-active': !projectionMapperOpen }" @click="setWorkspaceMode('visualizer')">
          Visualizacoes
        </button>
        <button class="ks-mode-tabs__tab" :class="{ 'is-active': projectionMapperOpen }" @click="setWorkspaceMode('mapper')">
          Mapper
        </button>
      </nav>

      <div class="ks-actions">
        <button @click="toggleAudioInputPicker">{{ audioInputPickerOpen ? "Fechar entradas" : "Entradas de audio" }}</button>
        <button v-if="isDesign51Active" :class="{ 'is-active': design51EditorOpen }" @click="toggleDesign51Editor">Editor 51</button>
        <button :class="{ 'is-active': playMode }" @click="togglePlayMode">
          {{ playMode ? `Play ${playCountdown}s` : "Play" }}
        </button>
        <button @click="previousSketch">Anterior</button>
        <button @click="nextSketch">Proximo</button>
        <button @click="viewport.toggleFullscreen">Fullscreen</button>
        <button @click="audio.stop" :disabled="!audio.running.value">Parar</button>
      </div>

      <label v-if="audioInputPickerOpen" class="ks-select">
        <span>Entrada manual do PC</span>
        <select :value="audio.selectedInputDeviceId.value" @change="handleAudioInputDeviceChange">
          <option v-for="device in audio.inputDevices.value" :key="device.deviceId" :value="device.deviceId">
            {{ device.label }}
          </option>
        </select>
      </label>
      <div v-if="audioInputPickerOpen" class="ks-actions">
        <button class="ghost" @click="connectSelectedAudioInput" :disabled="audio.busy.value || !audio.selectedInputDeviceId.value">
          Usar entrada selecionada
        </button>
      </div>

      <section class="ks-section">
        <div class="section-header">
          <h2>Sketch</h2>
          <span class="section-chip">{{ playMode ? `${sketchName} | Play ${playCountdown}s` : sketchName }}</span>
        </div>
        <label class="ks-select">
          <span>Selecionar design</span>
          <select :value="currentSketchIndex" @change="selectSketchByIndex">
            <option v-for="option in sketchOptions" :key="option.index" :value="option.index">
              {{ option.code }}{{ option.label !== option.code ? ` - ${option.label}` : "" }}
            </option>
          </select>
        </label>
        <label class="ks-select">
          <span>Estilo visual</span>
          <select :value="visualStyle" @change="selectVisualStyle">
            <option v-for="style in VISUAL_STYLES" :key="style.id" :value="style.id">
              {{ style.label }}
            </option>
          </select>
        </label>
        <div class="level-list">
          <div class="level-row">
            <span>Grave / movimento</span>
            <div class="level-bar">
              <div
                class="level-bar__fill"
                :style="{ transform: `scaleX(${Math.max(0.04, Math.min(1, audio.motionAmount.value))})` }"
              ></div>
            </div>
            <strong>{{ Math.round(audio.motionAmount.value * 100) }}%</strong>
          </div>
          <div class="level-row">
            <span>Medio / pisca</span>
            <div class="level-bar">
              <div
                class="level-bar__fill level-bar__fill--hot"
                :style="{ transform: `scaleX(${Math.max(0.04, Math.min(1, audio.blink.value))})` }"
              ></div>
            </div>
            <strong>{{ Math.round(audio.blink.value * 100) }}%</strong>
          </div>
          <div class="level-row">
            <span>Agudo / cor</span>
            <div class="level-bar">
              <div
                class="level-bar__fill level-bar__fill--cool"
                :style="{ transform: `scaleX(${Math.max(0.04, Math.min(1, audio.colorIntensity.value))})` }"
              ></div>
            </div>
            <strong>{{ Math.round(audio.colorIntensity.value * 100) }}%</strong>
          </div>
        </div>
      </section>

    </aside>

    <aside v-if="isDesign51Active" class="ks-editor" :class="{ 'is-hidden': !design51EditorVisible }">
      <div class="ks-editor__top">
        <div>
          <p class="eyebrow">Design 51</p>
          <h2>Live Builder</h2>
        </div>
        <div class="ks-editor__actions">
          <button class="ghost" @click="downloadDesign51Layout">Salvar JSON</button>
          <button class="ghost" @click="triggerDesign51Import">Importar JSON</button>
          <button class="ghost" @click="resetDesign51Editor">Resetar</button>
          <button class="ghost" @click="toggleDesign51Editor">Fechar</button>
        </div>
      </div>

      <p class="ks-editor__hint">Escolha um shader base e decida como quer começar: copia fiel ou do zero. No modo do zero, o shader e mantido, mas os uniforms voltam para uma base neutra para voce construir manualmente.</p>
      <input ref="design51ImportInput" class="ks-editor__file" type="file" accept=".json,application/json" @change="importDesign51Layout" />
      <p v-if="design51ImportStatus" class="ks-editor__status" :class="`is-${design51ImportStatusKind}`">{{ design51ImportStatus }}</p>

      <section class="ks-editor__section">
        <div class="section-header">
          <h3>Shader base</h3>
          <span class="section-chip">{{ design51SourceIndex === null ? "Template 51" : `Origem ${String(design51SourceIndex + 1).padStart(2, "0")}` }}</span>
        </div>

        <label class="ks-select ks-select--editor">
          <span>Escolher shader base</span>
          <select :value="design51SourceDraft" @change="handleDesign51SourceDraftChange">
            <option value="">Template original do 51</option>
            <option v-for="option in baseDesignOptions" :key="option.index" :value="option.value">
              {{ option.code }}{{ option.label ? ` - ${option.label}` : "" }}
            </option>
          </select>
        </label>
        <div class="ks-editor__actions ks-editor__actions--inline">
          <button class="ghost" @click="startDesign51FromSelectedShader('clone')">Copiar fiel</button>
          <button class="ghost" @click="startDesign51FromSelectedShader('zero')">Comecar do zero</button>
        </div>
      </section>

      <section class="ks-editor__section">
        <div class="section-header">
          <h3>Uniforms do shader</h3>
          <span class="section-chip">{{ inspectorFields.length }} campos</span>
        </div>

        <div class="ks-editor__grid">
          <div
            v-for="field in inspectorFields"
            :key="field.key"
            class="ks-editor__field"
            :class="{ 'is-boolean': field.type === 'boolean' }"
          >
            <div class="ks-editor__field-top">
              <span>{{ field.label }}</span>
              <strong>{{ formatInspectorFieldValue(field) }}</strong>
            </div>

            <label v-if="field.type === 'boolean'" class="ks-toggle">
              <input
                type="checkbox"
                :checked="Boolean(getInspectorFieldValue(field.key))"
                @change="updateInspectorField(field, $event.target.checked)"
              />
              <span>{{ getInspectorFieldValue(field.key) ? "Ligado" : "Desligado" }}</span>
            </label>

            <div v-else-if="field.type === 'vector'" class="ks-editor__vector">
              <div v-for="(entry, componentIndex) in getInspectorVectorValues(field)" :key="`${field.key}-${componentIndex}`" class="ks-editor__vector-row">
                <span>Valor {{ componentIndex + 1 }}</span>
                <input
                  type="range"
                  :min="field.min"
                  :max="field.max"
                  :step="field.step"
                  :value="Number(entry)"
                  @input="updateInspectorVectorField(field, componentIndex, $event.target.value)"
                />
                <input
                  class="ks-editor__number"
                  type="number"
                  :min="field.min"
                  :max="field.max"
                  :step="field.step"
                  :value="Number(entry)"
                  @input="updateInspectorVectorField(field, componentIndex, $event.target.value)"
                />
              </div>
            </div>

            <template v-else>
              <input
                type="range"
                :min="field.min"
                :max="field.max"
                :step="field.step"
                :value="Number(getInspectorFieldValue(field.key))"
                @input="updateInspectorField(field, $event.target.value)"
              />
              <input
                class="ks-editor__number"
                type="number"
                :min="field.min"
                :max="field.max"
                :step="field.step"
                :value="Number(getInspectorFieldValue(field.key))"
                @input="updateInspectorField(field, $event.target.value)"
              />
            </template>
          </div>
        </div>
      </section>
    </aside>

    <aside v-if="currentSketch" class="ks-editor ks-editor--inspector" :class="{ 'is-hidden': !designInspectorVisible }">
      <div class="ks-editor__top">
        <div>
          <p class="eyebrow">Inspector</p>
          <h2>{{ sketchName }}</h2>
        </div>
        <div class="ks-editor__actions">
          <button class="ghost" @click="downloadCurrentSketchJson">Baixar JSON</button>
          <button v-if="!isDesign51Active" class="ghost" @click="cloneCurrentSketchTo51">Clonar no 51</button>
          <button class="ghost" @click="toggleDesignInspector">Fechar</button>
        </div>
      </div>

      <p class="ks-editor__hint">Aqui voce acessa o shader real e todos os uniforms do design selecionado. Esse e o caminho certo para estudar a tela de forma fiel.</p>

      <section class="ks-editor__section">
        <div class="section-header">
          <h3>Shader</h3>
          <span class="section-chip">{{ currentSketch.shader?.length || 0 }} chars</span>
        </div>
        <textarea class="ks-editor__textarea" v-model="inspectorShaderDraft"></textarea>
        <div class="ks-editor__actions ks-editor__actions--inline">
          <button class="ghost" @click="applyInspectorShader">Aplicar shader</button>
        </div>
      </section>

      <section class="ks-editor__section">
        <div class="section-header">
          <h3>Uniforms</h3>
          <span class="section-chip">{{ inspectorFields.length }} campos</span>
        </div>

        <div class="ks-editor__grid">
          <div v-for="field in inspectorFields" :key="field.key" class="ks-editor__field" :class="{ 'is-boolean': field.type === 'boolean' }">
            <div class="ks-editor__field-top">
              <span>{{ field.label }}</span>
              <strong>{{ formatInspectorFieldValue(field) }}</strong>
            </div>

            <label v-if="field.type === 'boolean'" class="ks-toggle">
              <input
                type="checkbox"
                :checked="Boolean(getInspectorFieldValue(field.key))"
                @change="updateInspectorField(field, $event.target.checked)"
              />
              <span>{{ getInspectorFieldValue(field.key) ? "Ligado" : "Desligado" }}</span>
            </label>

            <div v-else-if="field.type === 'vector'" class="ks-editor__vector">
              <div v-for="(entry, componentIndex) in getInspectorVectorValues(field)" :key="`${field.key}-${componentIndex}`" class="ks-editor__vector-row">
                <span>Valor {{ componentIndex + 1 }}</span>
                <input
                  type="range"
                  :min="field.min"
                  :max="field.max"
                  :step="field.step"
                  :value="Number(entry)"
                  @input="updateInspectorVectorField(field, componentIndex, $event.target.value)"
                />
                <input
                  class="ks-editor__number"
                  type="number"
                  :min="field.min"
                  :max="field.max"
                  :step="field.step"
                  :value="Number(entry)"
                  @input="updateInspectorVectorField(field, componentIndex, $event.target.value)"
                />
              </div>
            </div>

            <template v-else>
              <input
                type="range"
                :min="field.min"
                :max="field.max"
                :step="field.step"
                :value="Number(getInspectorFieldValue(field.key))"
                @input="updateInspectorField(field, $event.target.value)"
              />
              <input
                class="ks-editor__number"
                type="number"
                :min="field.min"
                :max="field.max"
                :step="field.step"
                :value="Number(getInspectorFieldValue(field.key))"
                @input="updateInspectorField(field, $event.target.value)"
              />
            </template>
          </div>
        </div>
      </section>
    </aside>
  </div>
</template>
