<script setup>
import { computed, onBeforeUnmount, ref, watch } from "vue";
import ProjectionFaceCanvas from "./ProjectionFaceCanvas.vue";

const FACE_SIZE = 360;

const props = defineProps({
  sketches: {
    type: Array,
    default: () => [],
  },
  blink: {
    type: Number,
    default: 1,
  },
  motion: {
    type: Number,
    default: 0,
  },
});
const emit = defineEmits(["state-change"]);

const stageRef = ref(null);
const faces = ref([]);
const selectedFaceId = ref(null);
const dragState = ref(null);
let nextFaceId = 1;
let nextLayerOrder = 1;

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

function lerpPoint(start, end, amount) {
  return {
    x: start.x + (end.x - start.x) * amount,
    y: start.y + (end.y - start.y) * amount,
  };
}

function averagePoint(points) {
  const total = points.reduce((acc, point) => ({ x: acc.x + point.x, y: acc.y + point.y }), { x: 0, y: 0 });
  return {
    x: total.x / points.length,
    y: total.y / points.length,
  };
}

function getStageBounds() {
  const rect = stageRef.value?.getBoundingClientRect?.();
  if (rect) return rect;
  return {
    left: 0,
    top: 0,
    width: window.innerWidth,
    height: window.innerHeight,
  };
}

function createDefaultFace(index = 0) {
  const stage = getStageBounds();
  const offset = index * 36;
  const left = stage.width * 0.24 + offset;
  const top = stage.height * 0.18 + offset;
  return {
    id: nextFaceId++,
    designIndex: 0,
    visualStyle: "default",
    flipX: false,
    flipY: false,
    layerOrder: nextLayerOrder++,
    corners: [
      { x: left, y: top },
      { x: left + FACE_SIZE, y: top },
      { x: left + FACE_SIZE, y: top + FACE_SIZE },
      { x: left, y: top + FACE_SIZE },
    ],
  };
}

function createDefaultCutPoints(corners) {
  const topLeft = corners[0];
  const topRight = corners[1];
  const bottomRight = corners[2];
  const bottomLeft = corners[3];

  return [
    {
      left: lerpPoint(topLeft, bottomLeft, 1 / 3),
      right: lerpPoint(topRight, bottomRight, 1 / 3),
    },
    {
      left: lerpPoint(topLeft, bottomLeft, 2 / 3),
      right: lerpPoint(topRight, bottomRight, 2 / 3),
    },
  ];
}

function bringFaceToFront(faceId) {
  const face = faces.value.find((entry) => entry.id === faceId);
  if (!face) return;
  face.layerOrder = nextLayerOrder++;
}

function selectFace(faceId, options = {}) {
  const { bringToFront = true } = options;
  selectedFaceId.value = faceId;
  if (faceId === null || !bringToFront) return;
  bringFaceToFront(faceId);
}

function clearSelection() {
  selectedFaceId.value = null;
}

function addFace() {
  const face = createDefaultFace(faces.value.length);
  faces.value.push(face);
  selectFace(face.id);
}

function removeSelectedFace() {
  if (selectedFaceId.value === null) return;
  faces.value = faces.value.filter((face) => face.id !== selectedFaceId.value);
  selectedFaceId.value = faces.value[faces.value.length - 1]?.id ?? null;
}

function clearAllFaces() {
  handlePointerUp();
  faces.value = [];
  selectedFaceId.value = null;
}

function resetMapper() {
  clearAllFaces();
  nextFaceId = 1;
  nextLayerOrder = 1;
}

const selectedFace = computed(() => faces.value.find((face) => face.id === selectedFaceId.value) || null);
const orderedFaces = computed(() =>
  [...faces.value].sort((left, right) => Number(left.layerOrder || 0) - Number(right.layerOrder || 0))
);

function resetSelectedFace() {
  if (!selectedFace.value) return;
  const center = averagePoint(selectedFace.value.corners);
  selectedFace.value.corners = [
    { x: center.x - FACE_SIZE / 2, y: center.y - FACE_SIZE / 2 },
    { x: center.x + FACE_SIZE / 2, y: center.y - FACE_SIZE / 2 },
    { x: center.x + FACE_SIZE / 2, y: center.y + FACE_SIZE / 2 },
    { x: center.x - FACE_SIZE / 2, y: center.y + FACE_SIZE / 2 },
  ];
  if (Array.isArray(selectedFace.value.cutPoints) && selectedFace.value.cutPoints.length) {
    selectedFace.value.cutPoints = createDefaultCutPoints(selectedFace.value.corners);
  }
}

function startCutDrag(faceId, cutIndex, side, event) {
  event.preventDefault();
  event.stopPropagation();
  selectFace(faceId);
  dragState.value = { type: "cut", faceId, cutIndex, side };
  window.addEventListener("pointermove", handlePointerMove);
  window.addEventListener("pointerup", handlePointerUp);
}

function startCornerDrag(faceId, cornerIndex, event) {
  event.preventDefault();
  event.stopPropagation();
  selectFace(faceId);
  dragState.value = { type: "corner", faceId, cornerIndex };
  window.addEventListener("pointermove", handlePointerMove);
  window.addEventListener("pointerup", handlePointerUp);
}

function startFaceDrag(faceId, event) {
  if (selectedFaceId.value !== faceId) {
    selectFace(faceId);
  }

  const face = faces.value.find((entry) => entry.id === faceId);
  if (!face) return;

  event.preventDefault();
  event.stopPropagation();
  dragState.value = {
    type: "face",
    faceId,
    startX: event.clientX,
    startY: event.clientY,
    corners: face.corners.map((corner) => ({ ...corner })),
    cutPoints: Array.isArray(face.cutPoints)
      ? face.cutPoints.map((cutPoint) => ({
          left: { ...cutPoint.left },
          right: { ...cutPoint.right },
        }))
      : [],
  };
  window.addEventListener("pointermove", handlePointerMove);
  window.addEventListener("pointerup", handlePointerUp);
}

function handlePointerMove(event) {
  if (!dragState.value) return;
  const face = faces.value.find((entry) => entry.id === dragState.value.faceId);
  if (!face) return;

  const rect = getStageBounds();
  if (dragState.value.type === "corner") {
    face.corners[dragState.value.cornerIndex] = {
      x: clamp(event.clientX - rect.left, 0, rect.width),
      y: clamp(event.clientY - rect.top, 0, rect.height),
    };
    return;
  }

  if (dragState.value.type === "cut") {
    if (!Array.isArray(face.cutPoints) || !face.cutPoints[dragState.value.cutIndex]) return;
    face.cutPoints[dragState.value.cutIndex][dragState.value.side] = {
      x: clamp(event.clientX - rect.left, 0, rect.width),
      y: clamp(event.clientY - rect.top, 0, rect.height),
    };
    return;
  }

  if (dragState.value.type === "face") {
    const deltaX = event.clientX - dragState.value.startX;
    const deltaY = event.clientY - dragState.value.startY;
    face.corners = dragState.value.corners.map((corner) => ({
      x: clamp(corner.x + deltaX, 0, rect.width),
      y: clamp(corner.y + deltaY, 0, rect.height),
    }));
    if (Array.isArray(dragState.value.cutPoints) && dragState.value.cutPoints.length) {
      face.cutPoints = dragState.value.cutPoints.map((cutPoint) => ({
        left: {
          x: clamp(cutPoint.left.x + deltaX, 0, rect.width),
          y: clamp(cutPoint.left.y + deltaY, 0, rect.height),
        },
        right: {
          x: clamp(cutPoint.right.x + deltaX, 0, rect.width),
          y: clamp(cutPoint.right.y + deltaY, 0, rect.height),
        },
      }));
    }
  }
}

function handlePointerUp() {
  dragState.value = null;
  window.removeEventListener("pointermove", handlePointerMove);
  window.removeEventListener("pointerup", handlePointerUp);
}

onBeforeUnmount(() => {
  handlePointerUp();
});

function solveLinearSystem(matrix, values) {
  const size = values.length;
  const augmented = matrix.map((row, rowIndex) => [...row, values[rowIndex]]);

  for (let pivot = 0; pivot < size; pivot += 1) {
    let maxRow = pivot;
    for (let row = pivot + 1; row < size; row += 1) {
      if (Math.abs(augmented[row][pivot]) > Math.abs(augmented[maxRow][pivot])) {
        maxRow = row;
      }
    }

    if (Math.abs(augmented[maxRow][pivot]) < 1e-8) {
      return null;
    }

    if (maxRow !== pivot) {
      [augmented[pivot], augmented[maxRow]] = [augmented[maxRow], augmented[pivot]];
    }

    const pivotValue = augmented[pivot][pivot];
    for (let column = pivot; column <= size; column += 1) {
      augmented[pivot][column] /= pivotValue;
    }

    for (let row = 0; row < size; row += 1) {
      if (row === pivot) continue;
      const factor = augmented[row][pivot];
      for (let column = pivot; column <= size; column += 1) {
        augmented[row][column] -= factor * augmented[pivot][column];
      }
    }
  }

  return augmented.map((row) => row[size]);
}

function buildFaceTransform(corners) {
  const source = [
    [0, 0],
    [FACE_SIZE, 0],
    [FACE_SIZE, FACE_SIZE],
    [0, FACE_SIZE],
  ];
  const destination = corners.map((point) => [point.x, point.y]);
  const matrix = [];
  const values = [];

  for (let index = 0; index < 4; index += 1) {
    const [x, y] = source[index];
    const [u, v] = destination[index];
    matrix.push([x, y, 1, 0, 0, 0, -u * x, -u * y]);
    matrix.push([0, 0, 0, x, y, 1, -v * x, -v * y]);
    values.push(u, v);
  }

  const solved = solveLinearSystem(matrix, values);
  if (!solved) {
    const topLeft = corners[0];
    return `translate(${topLeft.x}px, ${topLeft.y}px)`;
  }

  const [a, b, c, d, e, f, g, h] = solved;
  return `matrix3d(${a}, ${d}, 0, ${g}, ${b}, ${e}, 0, ${h}, 0, 0, 1, 0, ${c}, ${f}, 0, 1)`;
}

function getFaceStyle(face, index) {
  return {
    width: `${FACE_SIZE}px`,
    height: `${FACE_SIZE}px`,
    transformOrigin: "0 0",
    zIndex: selectedFaceId.value === face.id ? 1000 + index : 10 + index,
  };
}

function getFaceSegments(face) {
  const cutPoints = Array.isArray(face.cutPoints) ? face.cutPoints : [];
  if (cutPoints.length < 2) {
    return [
      {
        key: `${face.id}-segment-0`,
        corners: face.corners,
        cropTop: 0,
        cropBottom: 1,
      },
    ];
  }

  const rows = [
    { left: face.corners[0], right: face.corners[1] },
    cutPoints[0],
    cutPoints[1],
    { left: face.corners[3], right: face.corners[2] },
  ];
  const cropStops = [0, 1 / 3, 2 / 3, 1];

  return rows.slice(0, 3).map((row, index) => ({
    key: `${face.id}-segment-${index}`,
    corners: [row.left, row.right, rows[index + 1].right, rows[index + 1].left],
    cropTop: cropStops[index],
    cropBottom: cropStops[index + 1],
  }));
}

function getFaceSegmentStyle(face, segment, faceIndex, segmentIndex) {
  return {
    ...getFaceStyle(face, faceIndex),
    transform: buildFaceTransform(segment.corners),
    zIndex: selectedFaceId.value === face.id ? 1000 + faceIndex * 10 + segmentIndex : 10 + faceIndex * 10 + segmentIndex,
  };
}

function getHandleStyle(point) {
  return {
    left: `${point.x}px`,
    top: `${point.y}px`,
  };
}

function getSegmentPolygonPoints(segment) {
  return segment.corners.map((point) => `${point.x},${point.y}`).join(" ");
}

function getFaceOutlinePoints(face) {
  const cutPoints = Array.isArray(face.cutPoints) ? face.cutPoints : [];
  if (cutPoints.length < 2) {
    return getSegmentPolygonPoints({ corners: face.corners });
  }

  return [
    face.corners[0],
    face.corners[1],
    cutPoints[0].right,
    cutPoints[1].right,
    face.corners[2],
    face.corners[3],
    cutPoints[1].left,
    cutPoints[0].left,
  ]
    .map((point) => `${point.x},${point.y}`)
    .join(" ");
}

function getFaceHandleEntries(face) {
  const entries = face.corners.map((point, cornerIndex) => ({
    key: `corner-${cornerIndex}`,
    point,
    dragType: "corner",
    cornerIndex,
  }));

  if (Array.isArray(face.cutPoints)) {
    face.cutPoints.forEach((cutPoint, cutIndex) => {
      entries.push({
        key: `cut-${cutIndex}-left`,
        point: cutPoint.left,
        dragType: "cut",
        cutIndex,
        side: "left",
      });
      entries.push({
        key: `cut-${cutIndex}-right`,
        point: cutPoint.right,
        dragType: "cut",
        cutIndex,
        side: "right",
      });
    });
  }

  return entries;
}

const faceOptions = computed(() =>
  (props.sketches || []).map((item, index) => ({
    index,
    value: String(index),
    label: `Design ${String(index + 1).padStart(2, "0")} - ${(item?.id || `design-${index + 1}`).replace(/[-_]/g, " ")}`,
  }))
);

function cloneValue(value) {
  return JSON.parse(JSON.stringify(value));
}

function applySnapshot(snapshot) {
  handlePointerUp();

  const nextFaces = Array.isArray(snapshot?.faces) ? cloneValue(snapshot.faces) : [];
  faces.value = nextFaces;

  const selectedFaceIdCandidate = snapshot?.selectedFaceId ?? null;
  selectedFaceId.value = nextFaces.some((face) => face.id === selectedFaceIdCandidate) ? selectedFaceIdCandidate : null;

  const maxFaceId = nextFaces.reduce((highest, face) => Math.max(highest, Number(face?.id) || 0), 0);
  const maxLayerOrder = nextFaces.reduce((highest, face) => Math.max(highest, Number(face?.layerOrder) || 0), 0);
  nextFaceId = Math.max(1, maxFaceId + 1);
  nextLayerOrder = Math.max(1, maxLayerOrder + 1);
}

function getStateSnapshot() {
  return {
    faces: cloneValue([...faces.value].sort((left, right) => Number(right.layerOrder || 0) - Number(left.layerOrder || 0))),
    selectedFaceId: selectedFaceId.value,
    faceOptions: cloneValue(faceOptions.value),
  };
}

function applyCommand(command) {
  const type = String(command?.type || "");

  if (type === "add-face") {
    addFace();
    return;
  }

  if (type === "remove-selected-face") {
    removeSelectedFace();
    return;
  }

  if (type === "clear-all-faces") {
    clearAllFaces();
    return;
  }

  if (type === "reset-mapper") {
    resetMapper();
    return;
  }

  if (type === "select-face") {
    selectFace(command.faceId ?? null);
    return;
  }

  if (type === "clear-selection") {
    clearSelection();
    return;
  }

  if (type === "set-face-design") {
    const face = faces.value.find((entry) => entry.id === Number(command.faceId));
    if (!face) return;
    face.designIndex = Number(command.designIndex || 0);
    return;
  }

  if (type === "set-face-style") {
    const face = faces.value.find((entry) => entry.id === Number(command.faceId));
    if (!face) return;
    face.visualStyle = String(command.visualStyle || "default");
    return;
  }

  if (type === "set-face-flip") {
    const face = faces.value.find((entry) => entry.id === Number(command.faceId));
    if (!face) return;
    if (command.axis === "x") face.flipX = Boolean(command.value);
    if (command.axis === "y") face.flipY = Boolean(command.value);
    return;
  }

  if (type === "toggle-face-transform") {
    const face = faces.value.find((entry) => entry.id === Number(command.faceId));
    if (!face) return;
    selectedFaceId.value = face.id;
    if (Array.isArray(face.cutPoints) && face.cutPoints.length) {
      face.cutPoints = [];
      return;
    }
    face.cutPoints = createDefaultCutPoints(face.corners);
    bringFaceToFront(face.id);
    return;
  }

  if (type === "reset-selected-face") {
    resetSelectedFace();
  }
}

watch(
  [faces, selectedFaceId, faceOptions],
  () => {
    emit("state-change", getStateSnapshot());
  },
  { deep: true, immediate: true }
);

defineExpose({
  applySnapshot,
  getStateSnapshot,
  applyCommand,
  clearAllFaces,
  resetMapper,
});
</script>

<template>
  <section class="mapper">
    <div ref="stageRef" class="mapper__stage" @pointerdown.self="clearSelection">
      <template v-for="(face, index) in orderedFaces" :key="face.id">
        <div
          v-for="(segment, segmentIndex) in getFaceSegments(face)"
          :key="segment.key"
          class="mapper__face"
          :class="{ 'is-selected': face.id === selectedFaceId }"
          :style="getFaceSegmentStyle(face, segment, index, segmentIndex)"
          @click.stop="selectFace(face.id)"
          @pointerdown="startFaceDrag(face.id, $event)"
        >
          <ProjectionFaceCanvas
            :sketch="sketches[face.designIndex]"
            :visual-style="face.visualStyle || 'default'"
            :flip-x="Boolean(face.flipX)"
            :flip-y="Boolean(face.flipY)"
            :blink="blink"
            :motion="motion"
            :width="FACE_SIZE"
            :height="FACE_SIZE"
            :crop-top="segment.cropTop"
            :crop-bottom="segment.cropBottom"
          />
        </div>
      </template>

      <svg class="mapper__overlay" aria-hidden="true">
        <polygon
          v-for="face in orderedFaces"
          :key="`outline-${face.id}`"
          class="mapper__polygon"
          :class="{ 'is-selected': face.id === selectedFaceId }"
          :points="getFaceOutlinePoints(face)"
        />
      </svg>

      <template v-for="face in orderedFaces" :key="`handles-${face.id}`">
        <template v-if="face.id === selectedFaceId">
          <button
            v-for="handle in getFaceHandleEntries(face)"
            :key="`handle-${face.id}-${handle.key}`"
            class="mapper__handle"
            :class="{ 'is-selected': face.id === selectedFaceId }"
            :style="getHandleStyle(handle.point)"
            @pointerdown="
              handle.dragType === 'corner'
                ? startCornerDrag(face.id, handle.cornerIndex, $event)
                : startCutDrag(face.id, handle.cutIndex, handle.side, $event)
            "
          ></button>
        </template>
      </template>
    </div>

  </section>
</template>

<style scoped>
.mapper {
  position: fixed;
  inset: 0;
  z-index: 3;
  background: #000;
}

.mapper__stage {
  position: absolute;
  inset: 0;
  overflow: hidden;
  background:
    radial-gradient(circle at 20% 20%, rgba(255, 255, 255, 0.03), transparent 28%),
    radial-gradient(circle at 80% 10%, rgba(255, 255, 255, 0.02), transparent 24%),
    #000;
}
.mapper__handle {
  position: absolute;
}

.mapper__face {
  position: absolute;
  overflow: hidden;
  background: #000;
  box-shadow: 0 20px 60px rgba(0, 0, 0, 0.42);
}

.mapper__face.is-selected {
  box-shadow: 0 24px 72px rgba(0, 0, 0, 0.54);
}

.mapper__overlay {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
  pointer-events: none;
}

.mapper__polygon {
  fill: none;
  stroke: rgba(255, 255, 255, 0.18);
  stroke-width: 1.5;
  vector-effect: non-scaling-stroke;
}

.mapper__polygon.is-selected {
  stroke: rgba(255, 186, 87, 0.92);
}

.mapper__handle {
  z-index: 9;
  width: 16px;
  height: 16px;
  min-width: 16px;
  padding: 0;
  border-radius: 999px;
  border: 2px solid rgba(0, 0, 0, 0.9);
  background: #fff;
  transform: translate(-50%, -50%);
  cursor: grab;
}

.mapper__handle.is-selected {
  background: #ffb54c;
}
</style>
