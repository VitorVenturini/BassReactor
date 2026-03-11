const mainCanvas = document.getElementById("visualizer");
let renderCanvas = mainCanvas;
let ctx = mainCanvas.getContext("2d");

const captureBtn = document.getElementById("captureBtn");
const pauseBtn = document.getElementById("pauseBtn");
const stopBtn = document.getElementById("stopBtn");
const fullscreenBtn = document.getElementById("fullscreenBtn");
const popupBtn = document.getElementById("popupBtn");
const toggleUiBtn = document.getElementById("toggleUiBtn");

const modeSelect = document.getElementById("modeSelect");
const colorModeSelect = document.getElementById("colorModeSelect");
const sensitivityInput = document.getElementById("sensitivity");
const smoothingInput = document.getElementById("smoothing");
const impactInput = document.getElementById("impact");
const trailInput = document.getElementById("trail");
const autoModeSelect = document.getElementById("autoModeSelect");
const smartMixSelect = document.getElementById("smartMixSelect");
const dropBoostInput = document.getElementById("dropBoost");
const fxSelect = document.getElementById("fxSelect");
const statusEl = document.getElementById("status");
const intensityValueEl = document.getElementById("intensityValue");
const presetValueEl = document.getElementById("presetValue");
const sceneValueEl = document.getElementById("sceneValue");

const TAU = Math.PI * 2;
const HORIZONTAL_BIAS_MODES = new Set([
  "mirror",
  "mirrorstorm",
  "mirrorvoid",
  "mirrorpulse",
  "shards",
  "shardbloom",
  "shardnova",
  "starorbit",
  "startrail",
  "starburst",
  "reactor3d",
  "reactorpoly",
  "reactorhelix",
  "reactorlattice",
  "gridflux",
  "gridsun",
  "gridrush",
  "pixeldrive",
  "osc",
  "oscmid",
  "oscmulti",
  "osccolor",
]);
const MODE_ROTATION = [
  "mirror",
  "mirrorstorm",
  "mirrorvoid",
  "mirrorpulse",
  "shards",
  "shardbloom",
  "shardnova",
  "starorbit",
  "startrail",
  "starburst",
  "reactor3d",
  "reactorpoly",
  "reactorhelix",
  "reactorlattice",
  "gridflux",
  "gridsun",
  "gridrush",
  "pixeldrive",
  "osc",
  "oscmid",
  "oscmulti",
  "osccolor",
];

const DEFAULT_VISUAL_PROFILE = Object.freeze({
  density: 1,
  motion: 1,
  turbulence: 1,
  glow: 1,
  line: 1,
  pulse: 1,
  horizon: 0.66,
});

const PROJECTM_PRESETS = [
  {
    name: "MIRROR VEIL",
    mode: "mirror",
    sections: ["steady", "build", "calm"],
    profile: { density: 1.02, motion: 0.96, turbulence: 0.84, glow: 1.12, line: 0.96, pulse: 0.94, horizon: 0.66 },
  },
  {
    name: "MIRROR STORM",
    mode: "mirrorstorm",
    sections: ["drop", "build"],
    profile: { density: 1.3, motion: 1.18, turbulence: 1.24, glow: 1.34, line: 1.14, pulse: 1.24, horizon: 0.65 },
  },
  {
    name: "MIRROR VOID",
    mode: "mirrorvoid",
    sections: ["drop", "steady"],
    profile: { density: 1.22, motion: 1.1, turbulence: 1.08, glow: 1.28, line: 1.08, pulse: 1.08, horizon: 0.65 },
  },
  {
    name: "MIRROR PULSE",
    mode: "mirrorpulse",
    sections: ["build", "drop"],
    profile: { density: 1.34, motion: 1.2, turbulence: 1.22, glow: 1.4, line: 1.16, pulse: 1.28, horizon: 0.65 },
  },
  {
    name: "SHARD CORE",
    mode: "shards",
    sections: ["build", "drop", "steady"],
    profile: { density: 1.24, motion: 1.12, turbulence: 1.08, glow: 1.28, line: 1.1, pulse: 1.2, horizon: 0.67 },
  },
  {
    name: "SHARD BLOOM",
    mode: "shardbloom",
    sections: ["steady", "build"],
    profile: { density: 1.28, motion: 1.14, turbulence: 1.12, glow: 1.34, line: 1.12, pulse: 1.22, horizon: 0.66 },
  },
  {
    name: "SHARD NOVA",
    mode: "shardnova",
    sections: ["drop"],
    profile: { density: 1.42, motion: 1.26, turbulence: 1.34, glow: 1.52, line: 1.24, pulse: 1.38, horizon: 0.66 },
  },
  {
    name: "STAR ORBIT",
    mode: "starorbit",
    sections: ["steady", "calm", "build"],
    profile: { density: 1.08, motion: 1.02, turbulence: 0.92, glow: 1.2, line: 1.02, pulse: 1.06, horizon: 0.66 },
  },
  {
    name: "STAR TRAIL",
    mode: "startrail",
    sections: ["steady", "build"],
    profile: { density: 1.18, motion: 1.12, turbulence: 1.02, glow: 1.28, line: 1.08, pulse: 1.18, horizon: 0.66 },
  },
  {
    name: "STAR BURST",
    mode: "starburst",
    sections: ["drop", "build"],
    profile: { density: 1.3, motion: 1.2, turbulence: 1.22, glow: 1.4, line: 1.16, pulse: 1.32, horizon: 0.66 },
  },
  {
    name: "VOID REACTOR",
    mode: "reactor3d",
    sections: ["steady", "build", "drop"],
    profile: { density: 1.22, motion: 1.12, turbulence: 1.08, glow: 1.3, line: 1.1, pulse: 1.2, horizon: 0.66 },
  },
  {
    name: "HYPER MORPH",
    mode: "reactor3d",
    sections: ["drop", "build"],
    profile: { density: 1.36, motion: 1.22, turbulence: 1.3, glow: 1.46, line: 1.22, pulse: 1.38, horizon: 0.65 },
  },
  {
    name: "HYPER POLY",
    mode: "reactorpoly",
    sections: ["build", "drop"],
    profile: { density: 1.32, motion: 1.2, turbulence: 1.26, glow: 1.42, line: 1.18, pulse: 1.32, horizon: 0.65 },
  },
  {
    name: "HYPER HELIX",
    mode: "reactorhelix",
    sections: ["build", "drop"],
    profile: { density: 1.3, motion: 1.24, turbulence: 1.22, glow: 1.4, line: 1.16, pulse: 1.36, horizon: 0.65 },
  },
  {
    name: "HYPER LATTICE",
    mode: "reactorlattice",
    sections: ["drop", "steady"],
    profile: { density: 1.28, motion: 1.18, turbulence: 1.18, glow: 1.36, line: 1.14, pulse: 1.3, horizon: 0.65 },
  },
  {
    name: "SUNSET CHASE",
    mode: "gridflux",
    sections: ["steady", "build"],
    profile: { density: 1.08, motion: 1.02, turbulence: 0.94, glow: 1.2, line: 1.06, pulse: 1.04, horizon: 0.5 },
  },
  {
    name: "PALM LASER",
    mode: "gridsun",
    sections: ["steady", "build", "calm"],
    profile: { density: 1.14, motion: 1.08, turbulence: 1.04, glow: 1.28, line: 1.1, pulse: 1.08, horizon: 0.5 },
  },
  {
    name: "GRID HYPER",
    mode: "gridrush",
    sections: ["drop", "build"],
    profile: { density: 1.28, motion: 1.22, turbulence: 1.28, glow: 1.36, line: 1.22, pulse: 1.24, horizon: 0.5 },
  },
  {
    name: "PIXEL DRIVE",
    mode: "pixeldrive",
    sections: ["steady", "build", "calm"],
    profile: { density: 0.96, motion: 0.84, turbulence: 0.7, glow: 0.88, line: 0.92, pulse: 0.9, horizon: 0.54 },
  },
  {
    name: "OSC GLASS",
    mode: "osc",
    sections: ["calm", "steady"],
    profile: { density: 0.96, motion: 0.9, turbulence: 0.82, glow: 1, line: 0.95, pulse: 0.88, horizon: 0.67 },
  },
  {
    name: "OSC OVERDRIVE",
    mode: "osc",
    sections: ["drop", "build"],
    profile: { density: 1.18, motion: 1.18, turbulence: 1.12, glow: 1.26, line: 1.12, pulse: 1.3, horizon: 0.66 },
  },
  {
    name: "MIDLINE DRIVE",
    mode: "oscmid",
    sections: ["steady", "build", "drop"],
    profile: { density: 1.02, motion: 1.2, turbulence: 1.04, glow: 1.2, line: 1.1, pulse: 1.28, horizon: 0.67 },
  },
  {
    name: "STACK LINES",
    mode: "oscmulti",
    sections: ["steady", "build", "calm"],
    profile: { density: 1.2, motion: 1.06, turbulence: 0.96, glow: 1.12, line: 1.02, pulse: 1.02, horizon: 0.67 },
  },
  {
    name: "RGB THREADS",
    mode: "osccolor",
    sections: ["build", "drop"],
    profile: { density: 1.28, motion: 1.14, turbulence: 1.06, glow: 1.34, line: 1.08, pulse: 1.22, horizon: 0.66 },
  },
];

let width = 0;
let height = 0;
let centerX = 0;
let centerY = 0;
let baseRadius = 0;

const palettes = {
  inferno: { hueA: 18, hueB: 46, hueC: 356, bg: [4, 8, 15] },
  toxic: { hueA: 96, hueB: 148, hueC: 178, bg: [3, 10, 8] },
  laser: { hueA: 184, hueB: 340, hueC: 266, bg: [3, 5, 15] },
  steel: { hueA: 198, hueB: 215, hueC: 175, bg: [5, 9, 16] },
  sunset: { hueA: 18, hueB: 332, hueC: 284, bg: [7, 6, 14] },
};

const state = {
  stream: null,
  audioContext: null,
  sourceNode: null,
  analyser: null,
  frequencyData: null,
  timeData: null,
  animationId: 0,
  animationTimer: 0,
  animationWindow: window,
  running: false,
  paused: false,
  mode: modeSelect.value,
  colorMode: colorModeSelect.value,
  sensitivity: Number(sensitivityInput.value),
  smoothing: Number(smoothingInput.value),
  impact: Number(impactInput.value),
  trail: Number(trailInput.value),
  autoMode: autoModeSelect.value,
  smartMix: smartMixSelect.value,
  dropBoost: Number(dropBoostInput.value),
  liveSensitivity: Number(sensitivityInput.value),
  liveImpact: Number(impactInput.value),
  liveTrail: Number(trailInput.value),
  fx: fxSelect.value,
  energyHistory: [],
  rawOverallHistory: [],
  overallHistory: [],
  bassHistory: [],
  beatHistory: [],
  particles: [],
  shards: [],
  rings: [],
  phase: 0,
  hueDrift: 0,
  impactPulse: 0,
  flashPulse: 0,
  lastBeatAt: 0,
  lastModeSwitchAt: 0,
  lastAdaptiveSwitchAt: 0,
  lastDropAt: 0,
  lastCalmAt: 0,
  section: "steady",
  calmFrames: 0,
  buildFrames: 0,
  dropHoldUntil: 0,
  lastSceneNoticeAt: 0,
  uiHidden: false,
  popupWindow: null,
  livePalette: null,
  targetPalette: null,
  nextPaletteShiftAt: 0,
  lastPaletteJumpAt: 0,
  autoPilot: true,
  beatCounter: 0,
  bouncePulse: 0,
  intensity: 0,
  presetName: "BOOT",
  visualProfile: { ...DEFAULT_VISUAL_PROFILE },
  targetVisualProfile: { ...DEFAULT_VISUAL_PROFILE },
  nextPresetAt: 0,
  lastPresetAt: 0,
  presetDropLockUntil: 0,
  modeBlend: 1,
  modeBlendFrom: modeSelect.value,
  modeBlendStartedAt: 0,
  modeBlendDuration: 0,
  animationGeneration: 0,
};

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

function lerp(from, to, t) {
  return from + (to - from) * t;
}

function avgLast(values, count) {
  if (!values.length) return 0;
  const size = Math.min(count, values.length);
  let sum = 0;
  for (let i = values.length - size; i < values.length; i += 1) sum += values[i];
  return sum / size;
}

function randomBetween(min, max) {
  return min + Math.random() * (max - min);
}

function randomItem(list) {
  return list[Math.floor(Math.random() * list.length)];
}

function smoothstep(value) {
  const t = clamp(value, 0, 1);
  return t * t * (3 - 2 * t);
}

function cloneVisualProfile(profile = DEFAULT_VISUAL_PROFILE) {
  return {
    density: profile.density,
    motion: profile.motion,
    turbulence: profile.turbulence,
    glow: profile.glow,
    line: profile.line,
    pulse: profile.pulse,
    horizon: profile.horizon,
  };
}

function blendVisualProfiles(from, to, amount) {
  return {
    density: lerp(from.density, to.density, amount),
    motion: lerp(from.motion, to.motion, amount),
    turbulence: lerp(from.turbulence, to.turbulence, amount),
    glow: lerp(from.glow, to.glow, amount),
    line: lerp(from.line, to.line, amount),
    pulse: lerp(from.pulse, to.pulse, amount),
    horizon: lerp(from.horizon, to.horizon, amount),
  };
}

function randomizePresetProfile(baseProfile) {
  return {
    density: clamp(baseProfile.density * (1 + randomBetween(-0.08, 0.1)), 0.82, 1.55),
    motion: clamp(baseProfile.motion * (1 + randomBetween(-0.08, 0.1)), 0.8, 1.45),
    turbulence: clamp(baseProfile.turbulence * (1 + randomBetween(-0.1, 0.12)), 0.75, 1.55),
    glow: clamp(baseProfile.glow * (1 + randomBetween(-0.08, 0.12)), 0.86, 1.65),
    line: clamp(baseProfile.line * (1 + randomBetween(-0.08, 0.08)), 0.84, 1.35),
    pulse: clamp(baseProfile.pulse * (1 + randomBetween(-0.08, 0.12)), 0.82, 1.6),
    horizon: clamp(baseProfile.horizon + randomBetween(-0.02, 0.02), 0.56, 0.74),
  };
}

function getVisualProfile() {
  return state.visualProfile || DEFAULT_VISUAL_PROFILE;
}

function findPresetByMode(mode) {
  return PROJECTM_PRESETS.find((preset) => preset.mode === mode) || null;
}

function applyManualModeProfile(mode) {
  const preset = findPresetByMode(mode);
  if (!preset) {
    state.presetName = mode.toUpperCase();
    state.section = "manual";
    updateAutoHud();
    return;
  }

  state.presetName = preset.name;
  state.section = "manual";
  state.visualProfile = cloneVisualProfile(preset.profile);
  state.targetVisualProfile = cloneVisualProfile(preset.profile);
  updateAutoHud();
}

function setModeWithBlend(nextMode, time, durationMs = 1500) {
  if (!nextMode || nextMode === state.mode) return;
  state.modeBlendFrom = state.mode;
  state.mode = nextMode;
  state.modeBlend = 0;
  state.modeBlendStartedAt = time;
  state.modeBlendDuration = durationMs;
  modeSelect.value = nextMode;
}

function updateModeBlend(time) {
  if (state.modeBlendFrom === state.mode) {
    state.modeBlend = 1;
    return;
  }
  const elapsed = time - state.modeBlendStartedAt;
  const ratio = elapsed / Math.max(260, state.modeBlendDuration);
  state.modeBlend = smoothstep(ratio);
  if (ratio >= 1) {
    state.modeBlend = 1;
    state.modeBlendFrom = state.mode;
  }
}

function pickPreset(section) {
  const pool = PROJECTM_PRESETS.filter((preset) => preset.sections.includes(section));
  const candidates = (pool.length ? pool : PROJECTM_PRESETS).filter((preset) => preset.name !== state.presetName);
  if (!candidates.length) return PROJECTM_PRESETS[0];
  return randomItem(candidates);
}

function queuePreset(section, time, reason = "timer") {
  if (reason !== "boot" && state.lastPresetAt) {
    const elapsed = time - state.lastPresetAt;
    const minGap = reason === "drop" ? 9000 : 14000;
    if (elapsed < minGap) {
      const postpone = minGap + randomBetween(1800, 5200);
      state.nextPresetAt = Math.max(state.nextPresetAt, state.lastPresetAt + postpone);
      return;
    }
  }

  const preset = pickPreset(section);
  if (!preset) return;

  const profile = randomizePresetProfile(preset.profile);
  state.targetVisualProfile = profile;
  state.presetName = preset.name;
  state.lastPresetAt = time;

  const isDrop = section === "drop" || reason === "drop";
  const modeBlendDuration = isDrop ? randomBetween(1200, 1900) : randomBetween(2200, 3600);
  if (preset.mode !== state.mode) {
    setModeWithBlend(preset.mode, time, modeBlendDuration);
    state.lastModeSwitchAt = time;
    state.lastAdaptiveSwitchAt = time;
  }

  if (isDrop) {
    state.presetDropLockUntil = time + 3200;
  }

  const baseGap = isDrop ? randomBetween(14000, 23000) : randomBetween(22000, 36000);
  const intensityBonus = (1 - state.intensity) * 6200;
  state.nextPresetAt = time + baseGap + intensityBonus;
}

function updatePresetEngine(time, levels) {
  if (!state.visualProfile) state.visualProfile = cloneVisualProfile(DEFAULT_VISUAL_PROFILE);
  if (!state.targetVisualProfile) state.targetVisualProfile = cloneVisualProfile(DEFAULT_VISUAL_PROFILE);

  if (!state.lastPresetAt) {
    queuePreset("steady", time, "boot");
  }

  if (state.autoMode === "off") {
    const settle = clamp(0.03 + levels.beat * 0.06, 0.03, 0.1);
    state.visualProfile = blendVisualProfiles(state.visualProfile, state.targetVisualProfile, settle);
    return;
  }

  if (time >= state.nextPresetAt) {
    queuePreset(state.section, time, "timer");
  }

  const dropSpike = state.section === "drop" && levels.fastDropPulse > 0.66 && time >= state.presetDropLockUntil;
  if (dropSpike) {
    queuePreset("drop", time, "drop");
  }

  const chase = clamp(0.028 + levels.beat * 0.11 + levels.fastDropPulse * 0.12 + levels.intensity * 0.06, 0.03, 0.25);
  state.visualProfile = blendVisualProfiles(state.visualProfile, state.targetVisualProfile, chase);
}

function wrapHue(hue) {
  return ((hue % 360) + 360) % 360;
}

function hueLerp(from, to, amount) {
  let delta = ((to - from + 540) % 360) - 180;
  return wrapHue(from + delta * amount);
}

function lerpNumber(from, to, amount) {
  return from + (to - from) * amount;
}

function clampColor(value) {
  return clamp(Math.round(value), 0, 255);
}

function randomPsyPalette() {
  const keys = Object.keys(palettes);
  const keyA = keys[Math.floor(Math.random() * keys.length)];
  const keyB = keys[Math.floor(Math.random() * keys.length)];
  const pA = palettes[keyA];
  const pB = palettes[keyB];
  const mix = Math.random();

  const hueA = wrapHue(lerpNumber(pA.hueA, pB.hueA, mix) + randomBetween(-70, 70));
  const hueB = wrapHue(lerpNumber(pA.hueB, pB.hueB, mix) + randomBetween(-70, 70));
  const hueC = wrapHue(lerpNumber(pA.hueC, pB.hueC, mix) + randomBetween(-70, 70));
  const bg = [
    clampColor(lerpNumber(pA.bg[0], pB.bg[0], mix) + randomBetween(-4, 6)),
    clampColor(lerpNumber(pA.bg[1], pB.bg[1], mix) + randomBetween(-5, 8)),
    clampColor(lerpNumber(pA.bg[2], pB.bg[2], mix) + randomBetween(-6, 9)),
  ];

  return { hueA, hueB, hueC, bg };
}

function getColorModeConfig() {
  if (state.colorMode === "chaos") {
    return { shiftMin: 900, shiftMax: 2400, blend: 0.14, drift: 1.8 };
  }
  if (state.colorMode === "wild") {
    return { shiftMin: 1800, shiftMax: 4200, blend: 0.085, drift: 1.1 };
  }
  return { shiftMin: 3200, shiftMax: 7600, blend: 0.05, drift: 0.75 };
}

function getLivePalette() {
  return state.livePalette || palettes.laser;
}

function initColorEngine(forceReset = false) {
  if (!forceReset && state.livePalette && state.targetPalette) return;
  state.livePalette = randomPsyPalette();
  state.targetPalette = randomPsyPalette();
  state.nextPaletteShiftAt = performance.now() + randomBetween(1200, 4200);
  state.lastPaletteJumpAt = 0;
}

function registerBeat(time) {
  state.lastBeatAt = time;
  state.beatCounter += 1;
  state.bouncePulse = 1;
}

function updateAutoHud() {
  if (intensityValueEl) {
    intensityValueEl.textContent = `${Math.round(state.intensity * 100)}%`;
  }
  if (presetValueEl) {
    presetValueEl.textContent = state.presetName;
  }
  if (sceneValueEl) {
    sceneValueEl.textContent = state.section.toUpperCase();
  }
}

function updateColorEngine(time, levels) {
  initColorEngine();
  const config = getColorModeConfig();

  if (time >= state.nextPaletteShiftAt) {
    state.targetPalette = randomPsyPalette();
    state.nextPaletteShiftAt = time + randomBetween(config.shiftMin, config.shiftMax);
  }

  const dropSpike = levels.fastDropPulse > 0.72 || levels.beat > 0.78;
  if (dropSpike && time - state.lastPaletteJumpAt > 900) {
    state.lastPaletteJumpAt = time;
    state.targetPalette = randomPsyPalette();
  }

  if (state.beatCounter > 0 && state.beatCounter % 4 === 0 && time - state.lastPaletteJumpAt > 360) {
    state.lastPaletteJumpAt = time;
    state.targetPalette = randomPsyPalette();
  }

  const speedBoost = 1 + levels.beat * 1.4 + levels.fastDropPulse * 1.8 + levels.overall * 0.5;
  const blend = clamp(config.blend * speedBoost, 0.03, 0.32);

  state.livePalette.hueA = hueLerp(state.livePalette.hueA, state.targetPalette.hueA, blend);
  state.livePalette.hueB = hueLerp(state.livePalette.hueB, state.targetPalette.hueB, blend * 0.92);
  state.livePalette.hueC = hueLerp(state.livePalette.hueC, state.targetPalette.hueC, blend * 0.88);

  state.livePalette.hueA = wrapHue(
    state.livePalette.hueA + Math.sin(time * 0.00037 + levels.bass * 4) * config.drift
  );
  state.livePalette.hueB = wrapHue(
    state.livePalette.hueB + Math.cos(time * 0.00031 + levels.mids * 3.1) * config.drift * 0.8
  );
  state.livePalette.hueC = wrapHue(
    state.livePalette.hueC + Math.sin(time * 0.00028 + levels.highs * 4.8) * config.drift * 0.65
  );

  for (let i = 0; i < 3; i += 1) {
    const live = state.livePalette.bg[i];
    const target = state.targetPalette.bg[i];
    const tonePulse = Math.sin(time * (0.0002 + i * 0.00006) + levels.overall * 4) * 2.4;
    state.livePalette.bg[i] = clampColor(lerpNumber(live, target, blend * 0.36) + tonePulse);
  }
}

function chooseNextMode(bucket) {
  const pools = {
    drop: [
      "gridrush",
      "shardnova",
      "mirrorstorm",
      "reactorpoly",
      "reactorhelix",
      "osccolor",
      "starburst",
    ],
    build: [
      "gridsun",
      "shardbloom",
      "mirrorpulse",
      "reactor3d",
      "startrail",
      "oscmulti",
      "gridflux",
      "pixeldrive",
    ],
    calm: ["gridflux", "oscmid", "starorbit", "mirror", "gridsun", "pixeldrive"],
    steady: ["mirror", "shards", "starorbit", "gridflux", "reactor3d", "oscmulti", "pixeldrive"],
  };
  const list = pools[bucket] || pools.steady;
  const currentIndex = list.indexOf(state.mode);
  if (currentIndex >= 0) {
    return list[(currentIndex + 1) % list.length];
  }
  const fallback = MODE_ROTATION.indexOf(state.mode);
  const shift = fallback >= 0 ? fallback % list.length : 0;
  return list[shift];
}

function setStatus(text, isError = false) {
  statusEl.textContent = text;
  statusEl.style.color = isError ? "#ff9393" : "#dbe8ff";
}

function setUiHidden(hidden) {
  state.uiHidden = hidden;
  document.body.classList.toggle("ui-hidden", hidden);
  toggleUiBtn.textContent = hidden ? "Mostrar UI" : "Ocultar UI";
}

function hasPopupSurface() {
  return Boolean(state.popupWindow && !state.popupWindow.closed && renderCanvas !== mainCanvas);
}

function syncCanvasVisibility() {
  const popupActive = hasPopupSurface();
  document.body.classList.toggle("popup-active", popupActive);

  if (popupActive) {
    const mainCtx = mainCanvas.getContext("2d");
    if (mainCtx) {
      mainCtx.save();
      mainCtx.setTransform(1, 0, 0, 1, 0, 0);
      mainCtx.clearRect(0, 0, mainCanvas.width, mainCanvas.height);
      mainCtx.restore();
    }
  }
}

function getRenderWindow() {
  if (state.popupWindow && !state.popupWindow.closed && renderCanvas !== mainCanvas) {
    return state.popupWindow;
  }
  return window;
}

function cancelFrameLoop() {
  state.animationGeneration += 1;
  if (state.animationId) {
    try {
      const host = state.animationWindow && !state.animationWindow.closed ? state.animationWindow : window;
      host.cancelAnimationFrame(state.animationId);
    } catch {
      window.cancelAnimationFrame(state.animationId);
    }
    state.animationId = 0;
  }

  if (state.animationTimer) {
    window.clearTimeout(state.animationTimer);
    state.animationTimer = 0;
  }
}

function scheduleFrame() {
  const generation = state.animationGeneration;
  const host = getRenderWindow();
  if (host && typeof host.requestAnimationFrame === "function") {
    state.animationWindow = host;
    state.animationId = host.requestAnimationFrame((time) => {
      animate(time, generation);
    });
    state.animationTimer = 0;
    return;
  }

  state.animationWindow = window;
  state.animationId = 0;
  state.animationTimer = window.setTimeout(() => {
    animate(window.performance.now(), generation);
  }, 16);
}

function detachPopupSurface(showStatus = true) {
  if (renderCanvas === mainCanvas) return;
  const shouldResume = state.running && !state.paused;
  renderCanvas = mainCanvas;
  ctx = mainCanvas.getContext("2d");
  state.popupWindow = null;
  popupBtn.textContent = "Abrir Pop-up";
  syncCanvasVisibility();
  resizeCanvas();
  if (shouldResume) {
    cancelFrameLoop();
    scheduleFrame();
  }
  if (showStatus) {
    setStatus("Pop-up fechado. Visualizer voltou para a aba principal.");
  }
}

function bindPopupSurface(popupWindow) {
  if (!popupWindow || popupWindow.closed) return false;
  const popupCanvas = popupWindow.document.getElementById("visualizerPopup");
  if (!popupCanvas) return false;
  const popupCtx = popupCanvas.getContext("2d");
  if (!popupCtx) return false;

  renderCanvas = popupCanvas;
  ctx = popupCtx;
  popupBtn.textContent = "Fechar Pop-up";
  syncCanvasVisibility();

  popupWindow.addEventListener("beforeunload", () => {
    detachPopupSurface(false);
  });

  popupWindow.addEventListener("resize", () => {
    if (hasPopupSurface()) resizeCanvas();
  });

  resizeCanvas();
  if (state.running && !state.paused) {
    cancelFrameLoop();
    scheduleFrame();
  }
  setStatus("Visualizer ativo no Pop-up. Redimensione como quiser.");
  return true;
}

function openPopupWindow() {
  if (state.popupWindow && !state.popupWindow.closed) {
    if (hasPopupSurface()) {
      state.popupWindow.close();
      detachPopupSurface(false);
      return;
    }
    state.popupWindow.focus();
  }

  const popup = window.open(
    "./visualizer-popup.html",
    "bass_reactor_popup",
    "popup=yes,width=1280,height=720,resizable=yes"
  );

  if (!popup) {
    setStatus("Pop-up bloqueado pelo navegador. Libere pop-ups para este site.", true);
    return;
  }

  state.popupWindow = popup;
  let tries = 0;
  const bindLoop = () => {
    if (!state.popupWindow || state.popupWindow.closed) {
      setStatus("Pop-up fechado antes de iniciar.", true);
      return;
    }
    if (bindPopupSurface(state.popupWindow)) {
      return;
    }
    tries += 1;
    if (tries > 120) {
      setStatus("Nao foi possivel inicializar o canvas no Pop-up.", true);
      return;
    }
    window.setTimeout(bindLoop, 40);
  };
  bindLoop();
}

function resizeCanvas() {
  const renderWindow = getRenderWindow();
  const dpr = renderWindow.devicePixelRatio || 1;
  width = renderWindow.innerWidth;
  height = renderWindow.innerHeight;
  centerX = width * 0.5;
  centerY = height * 0.5;
  baseRadius = Math.min(width, height) * 0.3;

  renderCanvas.width = Math.round(width * dpr);
  renderCanvas.height = Math.round(height * dpr);
  renderCanvas.style.width = `${width}px`;
  renderCanvas.style.height = `${height}px`;
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

  buildMotionMaps();
}

function buildMotionMaps() {
  const particleCount = Math.max(180, Math.min(460, Math.floor((width * height) / 5200)));
  state.particles = Array.from({ length: particleCount }, (_, i) => ({
    angle: (i / particleCount) * TAU,
    orbit: 0.2 + Math.random() * 1.3,
    speed: 0.0007 + Math.random() * 0.0024,
    size: 0.8 + Math.random() * 2.4,
    drift: (Math.random() - 0.5) * 0.009,
    hueShift: Math.random() * 30,
    band: (i * 13) % 420,
  }));

  state.shards = Array.from({ length: 220 }, () => ({
    angle: Math.random() * TAU,
    spread: 0.03 + Math.random() * 0.17,
    depth: 0.24 + Math.random() * 1.3,
    band: Math.floor(Math.random() * 420),
  }));
}

function getLayoutProfile() {
  if (HORIZONTAL_BIAS_MODES.has(state.mode)) {
    return {
      scaleX: 1.06,
      scaleY: 0.96,
    };
  }
  return {
    scaleX: 1,
    scaleY: 1,
  };
}

function getAverage(start, end) {
  if (!state.frequencyData || end <= start) return 0;
  const upper = Math.min(end, state.frequencyData.length);
  let sum = 0;
  for (let i = start; i < upper; i += 1) sum += state.frequencyData[i];
  return sum / Math.max(1, upper - start) / 255;
}

function collectLevels(time) {
  const bass = getAverage(1, 38);
  const lowMid = getAverage(38, 95);
  const mids = getAverage(95, 230);
  const highs = getAverage(230, 620);
  const air = getAverage(620, 1024);
  const rawOverall = bass * 0.52 + lowMid * 0.24 + mids * 0.16 + highs * 0.08;

  const transient = bass * 1.8 + lowMid * 0.8 + highs * 0.25;
  state.energyHistory.push(transient);
  if (state.energyHistory.length > 96) state.energyHistory.shift();

  const mean =
    state.energyHistory.reduce((total, value) => total + value, 0) /
    Math.max(1, state.energyHistory.length);
  const beatRaw = mean > 0 ? transient / mean - 1.03 : 0;
  const beat = clamp(beatRaw * 1.5, 0, 1.8);

  state.rawOverallHistory.push(rawOverall);
  state.bassHistory.push(bass);
  state.beatHistory.push(clamp(beat, 0, 1));
  if (state.rawOverallHistory.length > 220) state.rawOverallHistory.shift();
  if (state.bassHistory.length > 220) state.bassHistory.shift();
  if (state.beatHistory.length > 220) state.beatHistory.shift();

  const shortRawOverall = avgLast(state.rawOverallHistory, 14);
  const longRawOverall = avgLast(state.rawOverallHistory, 84);
  const shortBass = avgLast(state.bassHistory, 14);
  const longBass = avgLast(state.bassHistory, 84);
  const shortBeat = avgLast(state.beatHistory, 12);

  const fastDropPulse = clamp(
    (beat - 0.25) * 1.9 + (shortBass - longBass * 0.9) * 3.3 + (shortRawOverall - longRawOverall) * 2.2,
    0,
    1.6
  );

  const intensityRaw = clamp(rawOverall * 0.72 + bass * 0.32 + beat * 0.35 + fastDropPulse * 0.42, 0, 1.5);
  const intensityTarget = clamp(intensityRaw / 1.22, 0, 1);
  state.intensity = lerp(state.intensity, intensityTarget, clamp(0.06 + beat * 0.1, 0.06, 0.2));

  if (state.autoPilot || state.smartMix === "on") {
    const dropAssist = 1 + fastDropPulse * state.dropBoost * 0.52;
    const targetSensitivity = clamp(1.22 + state.intensity * 2.9, 1, 4.4) * dropAssist;
    const targetImpact = clamp(1 + state.intensity * 2.2 + fastDropPulse * state.dropBoost, 0.9, 4.1);
    const targetTrail = clamp(0.78 - state.intensity * 0.34 - fastDropPulse * 0.11, 0.16, 0.9);
    const chase = clamp(0.08 + state.intensity * 0.12 + fastDropPulse * 0.1, 0.08, 0.28);
    state.liveSensitivity = lerp(state.liveSensitivity, targetSensitivity, chase);
    state.liveImpact = lerp(state.liveImpact, targetImpact, clamp(chase * 0.9, 0.07, 0.24));
    state.liveTrail = lerp(state.liveTrail, targetTrail, clamp(chase * 0.75, 0.06, 0.2));
  } else {
    state.liveSensitivity = state.sensitivity;
    state.liveImpact = state.impact;
    state.liveTrail = state.trail;
  }

  const overall = clamp(rawOverall * state.liveSensitivity, 0, 1.2);
  state.overallHistory.push(overall);
  if (state.overallHistory.length > 220) state.overallHistory.shift();

  if (beat > 0.42 && time - state.lastBeatAt > 120) {
    registerBeat(time);
    state.rings.push({
      bornAt: time,
      strength: clamp(beat * 0.9 + bass * 0.6, 0.3, 2),
    });
  }

  state.rings = state.rings.filter((ring) => time - ring.bornAt < 1900);
  state.impactPulse = Math.max(
    state.impactPulse * 0.88,
    beat * state.liveImpact * 0.78 + bass * 0.38 + overall * 0.1
  );
  state.flashPulse = Math.max(state.flashPulse * 0.86, beat * 0.7 + overall * 0.12);
  state.phase += 0.003 + overall * 0.03;
  state.hueDrift = (state.hueDrift + 0.22 + overall * 1.45 + beat * 2.4) % 360;

  const shortOverall = avgLast(state.overallHistory, 14);
  const longOverall = avgLast(state.overallHistory, 84);

  return {
    bass,
    lowMid,
    mids,
    highs,
    air,
    overall,
    shortOverall,
    longOverall,
    shortBass,
    longBass,
    shortBeat,
    intensity: state.intensity,
    fastDropPulse: clamp(fastDropPulse, 0, 1),
    beat: clamp(beat, 0, 1),
  };
}

function getFxFlags() {
  return {
    flash: state.fx === "flash" || state.fx === "impact" || state.fx === "full",
    shake: state.fx === "impact" || state.fx === "full",
    chroma: state.fx === "full",
    strobe: state.fx === "full",
  };
}

function drawBackdrop(levels, time) {
  const profile = getVisualProfile();
  const palette = getLivePalette();
  const fade = clamp(0.055 + (1 - state.liveTrail) * 0.24 + (profile.turbulence - 1) * 0.06, 0.03, 0.38);
  const hue1 = (palette.hueA + state.hueDrift * 0.9) % 360;
  const hue2 = (palette.hueB + state.hueDrift * 0.5) % 360;
  const hue3 = (palette.hueC + state.hueDrift * 0.35) % 360;

  ctx.globalCompositeOperation = "source-over";
  ctx.fillStyle = `rgba(${palette.bg[0]}, ${palette.bg[1]}, ${palette.bg[2]}, ${fade})`;
  ctx.fillRect(0, 0, width, height);

  const gradA = ctx.createRadialGradient(
    width * (0.16 + Math.sin(time * 0.00016) * 0.04),
    height * (0.22 + Math.cos(time * 0.00015) * 0.05),
    12,
    width * 0.22,
    height * 0.3,
    Math.max(width, height) * 0.65
  );
  gradA.addColorStop(0, `hsla(${hue1}, 94%, ${52 + levels.beat * 25}%, ${0.2 + profile.glow * 0.11})`);
  gradA.addColorStop(1, "transparent");
  ctx.fillStyle = gradA;
  ctx.fillRect(0, 0, width, height);

  const gradB = ctx.createRadialGradient(
    width * (0.82 + Math.sin(time * 0.00011) * 0.04),
    height * (0.75 + Math.cos(time * 0.00013) * 0.03),
    20,
    width * 0.75,
    height * 0.78,
    Math.max(width, height) * 0.68
  );
  gradB.addColorStop(0, `hsla(${hue2}, 92%, ${50 + levels.overall * 30}%, ${0.16 + profile.glow * 0.09})`);
  gradB.addColorStop(1, "transparent");
  ctx.fillStyle = gradB;
  ctx.fillRect(0, 0, width, height);

  const vignette = ctx.createRadialGradient(centerX, centerY, Math.min(width, height) * 0.08, centerX, centerY, Math.max(width, height) * 0.82);
  vignette.addColorStop(0, "transparent");
  vignette.addColorStop(1, "rgba(0, 0, 0, 0.32)");
  ctx.fillStyle = vignette;
  ctx.fillRect(0, 0, width, height);

  ctx.save();
  ctx.globalCompositeOperation = "screen";

  const ribbonCount = 12;
  for (let i = 0; i < ribbonCount; i += 1) {
    const ratio = i / ribbonCount;
    const sway = Math.sin(time * 0.00018 + i * 1.7) * width * 0.06;
    const x = ratio * width + sway;
    const band = 90 + ratio * 180;
    const ribbon = ctx.createLinearGradient(x - band, 0, x + band, height);
    ribbon.addColorStop(0, "transparent");
    ribbon.addColorStop(0.5, `hsla(${(hue1 + i * 14) % 360}, 90%, 64%, ${0.02 + profile.glow * 0.03})`);
    ribbon.addColorStop(1, "transparent");
    ctx.fillStyle = ribbon;
    ctx.fillRect(x - band, 0, band * 2, height);
  }

  const scanStep = Math.max(3, Math.round(height / 150));
  for (let y = 0; y < height; y += scanStep) {
    const alpha = 0.015 + ((y / Math.max(1, height)) % 0.12) * 0.04;
    ctx.fillStyle = `rgba(255, 255, 255, ${alpha})`;
    ctx.fillRect(0, y, width, 1);
  }

  const dustCount = 64;
  for (let i = 0; i < dustCount; i += 1) {
    const seed = i * 97.31;
    const x = ((Math.sin(seed * 1.7 + time * 0.00007) + 1) * 0.5) * width;
    const y = ((Math.cos(seed * 1.13 + time * 0.00005) + 1) * 0.5) * height;
    const r = 0.6 + (i % 3) * 0.55 + levels.highs * 0.7;
    ctx.beginPath();
    ctx.arc(x, y, r, 0, TAU);
    ctx.fillStyle = `hsla(${(hue3 + i * 9) % 360}, 90%, 76%, 0.04)`;
    ctx.fill();
  }

  ctx.restore();
}

function traceRegularPolygonPath(sides, radius) {
  for (let i = 0; i < sides; i += 1) {
    const angle = (i / sides) * TAU - Math.PI / 2;
    const x = Math.cos(angle) * radius;
    const y = Math.sin(angle) * radius;
    if (i === 0) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
  }
  ctx.closePath();
}

function rotatePoint3D(point, rotX, rotY, rotZ) {
  const cosX = Math.cos(rotX);
  const sinX = Math.sin(rotX);
  const cosY = Math.cos(rotY);
  const sinY = Math.sin(rotY);
  const cosZ = Math.cos(rotZ);
  const sinZ = Math.sin(rotZ);

  const y1 = point.y * cosX - point.z * sinX;
  const z1 = point.y * sinX + point.z * cosX;
  const x2 = point.x * cosY + z1 * sinY;
  const z2 = -point.x * sinY + z1 * cosY;
  const x3 = x2 * cosZ - y1 * sinZ;
  const y3 = x2 * sinZ + y1 * cosZ;

  return { x: x3, y: y3, z: z2 };
}

function projectPoint3D(point, cameraZ, zoom) {
  const depth = point.z + cameraZ;
  const inv = zoom / Math.max(56, depth);
  return {
    x: centerX + point.x * inv,
    y: centerY + point.y * inv,
    depth,
    scale: inv,
  };
}

function drawIsoCube(cx, cy, size, topShade, leftShade, rightShade, lineShade) {
  const h = size * 0.55;
  const topY = cy - h;
  const leftX = cx - size;
  const rightX = cx + size;

  ctx.beginPath();
  ctx.moveTo(cx, topY - h);
  ctx.lineTo(rightX, topY - h * 0.45);
  ctx.lineTo(cx, topY + h * 0.1);
  ctx.lineTo(leftX, topY - h * 0.45);
  ctx.closePath();
  ctx.fillStyle = topShade;
  ctx.fill();

  ctx.beginPath();
  ctx.moveTo(leftX, topY - h * 0.45);
  ctx.lineTo(cx, topY + h * 0.1);
  ctx.lineTo(cx, cy + h);
  ctx.lineTo(leftX, cy + h * 0.48);
  ctx.closePath();
  ctx.fillStyle = leftShade;
  ctx.fill();

  ctx.beginPath();
  ctx.moveTo(rightX, topY - h * 0.45);
  ctx.lineTo(cx, topY + h * 0.1);
  ctx.lineTo(cx, cy + h);
  ctx.lineTo(rightX, cy + h * 0.48);
  ctx.closePath();
  ctx.fillStyle = rightShade;
  ctx.fill();

  ctx.strokeStyle = lineShade;
  ctx.lineWidth = 1.05;
  ctx.stroke();
}

function drawKaleido(levels, time) {
  const palette = getLivePalette();
  const baseHue = (palette.hueA + state.hueDrift) % 360;
  const orbRadius = baseRadius * (0.8 + levels.bass * 0.42 + state.impactPulse * 0.1);
  const auraRadius = Math.min(width, height) * (0.86 + levels.overall * 0.34);
  const slices = 18 + Math.floor(levels.bass * 10);
  const waves = 9;

  ctx.save();
  ctx.translate(centerX, centerY);
  ctx.globalCompositeOperation = "lighter";
  ctx.rotate(time * 0.00005);

  const aura = ctx.createRadialGradient(0, 0, orbRadius * 0.3, 0, 0, auraRadius);
  aura.addColorStop(0, `hsla(${baseHue}, 98%, 66%, 0.2)`);
  aura.addColorStop(1, "transparent");
  ctx.beginPath();
  ctx.arc(0, 0, auraRadius, 0, TAU);
  ctx.fillStyle = aura;
  ctx.fill();

  ctx.save();
  ctx.beginPath();
  ctx.arc(0, 0, orbRadius, 0, TAU);
  ctx.clip();

  for (let w = 0; w < waves; w += 1) {
    const hue = (baseHue + w * 14) % 360;
    const band = (w * 67) % Math.max(1, state.frequencyData.length - 1);
    const amp = (state.frequencyData[band] / 255) * state.liveSensitivity;
    const lineY = -orbRadius + (w / (waves - 1)) * orbRadius * 2;
    ctx.beginPath();
    for (let x = -orbRadius * 1.2, i = 0; x <= orbRadius * 1.2; x += orbRadius / 36, i += 1) {
      const wobble =
        Math.sin(x * 0.018 + time * 0.0022 + w * 0.9) * (14 + amp * 56) +
        Math.cos(i * 0.35 + time * 0.0018) * (5 + levels.beat * 14);
      const y = lineY + wobble;
      if (i === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }
    ctx.strokeStyle = `hsla(${hue}, 96%, ${56 + amp * 18}%, ${0.08 + amp * 0.2})`;
    ctx.lineWidth = 1.3 + amp * 3.4;
    ctx.stroke();
  }

  ctx.restore();

  for (let s = 0; s < slices; s += 1) {
    const angle = (s / slices) * TAU;
    ctx.save();
    ctx.rotate(angle);
    for (let mirror = 0; mirror < 2; mirror += 1) {
      ctx.save();
      if (mirror === 1) ctx.scale(1, -1);
      const bin = Math.floor((s / slices) * Math.min(900, state.frequencyData.length - 1));
      const amp = (state.frequencyData[bin] / 255) * state.liveSensitivity;
      const reach = orbRadius + amp * (Math.min(width, height) * 0.58) + levels.beat * 72;
      const spread = 10 + amp * 42;

      ctx.beginPath();
      ctx.moveTo(orbRadius * 0.18, 0);
      ctx.quadraticCurveTo(reach * 0.48, -spread, reach, 0);
      ctx.quadraticCurveTo(reach * 0.48, spread, orbRadius * 0.18, 0);
      ctx.closePath();
      ctx.fillStyle = `hsla(${(baseHue + s * 8.6) % 360}, 98%, ${54 + amp * 22}%, ${0.04 + amp * 0.12})`;
      ctx.fill();
      ctx.restore();
    }
    ctx.restore();
  }

  const coreGlow = ctx.createRadialGradient(0, 0, orbRadius * 0.16, 0, 0, orbRadius * 1.2);
  coreGlow.addColorStop(0, `hsla(${(baseHue + 24) % 360}, 98%, 72%, 0.28)`);
  coreGlow.addColorStop(1, "transparent");
  ctx.beginPath();
  ctx.arc(0, 0, orbRadius * 1.2, 0, TAU);
  ctx.fillStyle = coreGlow;
  ctx.fill();

  ctx.beginPath();
  ctx.arc(0, 0, orbRadius * (0.78 + levels.bass * 0.16), 0, TAU);
  ctx.fillStyle = `hsla(${(baseHue + 12) % 360}, 96%, 66%, 0.16)`;
  ctx.fill();

  ctx.restore();
}

function drawMirrorFamily(levels, time, variant) {
  const profile = getVisualProfile();
  const palette = getLivePalette();
  const baseHue = (palette.hueB + state.hueDrift) % 360;

  const variantMap = {
    veil: { density: 0.92, travel: 0.95, wave: 0.86, glow: 0.9, center: true, symmetry: 2, centerScale: 0.44, centerGlow: 0.7 },
    storm: { density: 1.18, travel: 1.08, wave: 1.1, glow: 1.08, center: false, symmetry: 2, centerScale: 0.32, centerGlow: 0.48 },
    void: { density: 1.1, travel: 1.06, wave: 1.08, glow: 1.14, center: false, symmetry: 2 },
    pulse: { density: 1.16, travel: 1.08, wave: 1.06, glow: 1.04, center: false, symmetry: 3, centerScale: 0.28, centerGlow: 0.42 },
  };
  const cfg = variantMap[variant] || variantMap.veil;

  const orbRadius = baseRadius * (0.52 + levels.bass * 0.18 + state.impactPulse * 0.03);
  const mirrorCount = Math.max(6, Math.floor((8 + levels.bass * 4) * profile.density * cfg.density));
  const ribbons = Math.max(5, Math.floor(7 * profile.density * cfg.density));

  ctx.save();
  ctx.translate(centerX, centerY);
  ctx.globalCompositeOperation = "lighter";
  ctx.rotate(time * 0.00006 * profile.motion * cfg.travel);
  ctx.lineCap = "round";

  for (let m = 0; m < mirrorCount; m += 1) {
    const rot = (m / mirrorCount) * TAU;
    ctx.save();
    ctx.rotate(rot);

    for (let side = 0; side < cfg.symmetry; side += 1) {
      ctx.save();
      if (side === 1) ctx.scale(-1, 1);
      if (side === 2) ctx.scale(1, -1);

      for (let r = 0; r < ribbons; r += 1) {
        const offset = (r / (ribbons - 1) - 0.5) * orbRadius * 0.74;
        const bin = Math.floor(((m * ribbons + r) / (mirrorCount * ribbons)) * Math.min(980, state.frequencyData.length - 1));
        const amp = (state.frequencyData[bin] / 255) * state.liveSensitivity;
        const travel =
          orbRadius +
          amp * (Math.min(width, height) * (0.42 + profile.pulse * 0.2) * cfg.travel) +
          levels.beat * (38 + profile.pulse * 26);
        const wave = (6 + amp * 28) * profile.turbulence * cfg.wave;

        ctx.beginPath();
        for (let i = 0; i <= 44; i += 1) {
          const t = i / 44;
          const x = t * travel;
          const y =
            offset +
            Math.sin(t * (8.4 + cfg.wave) + time * 0.0018 + r * 0.9) * wave * (1 - t * 0.35) +
            Math.cos(t * 5 + m * 0.8) * wave * 0.45;
          if (i === 0) ctx.moveTo(x, y);
          else ctx.lineTo(x, y);
        }
        ctx.strokeStyle = `hsla(${(baseHue + m * 16 + r * 8) % 360}, 96%, ${50 + amp * 20}%, ${0.04 + amp * 0.1 * profile.glow * cfg.glow})`;
        ctx.lineWidth = (1 + amp * 2.5) * profile.line;
        ctx.stroke();
      }
      ctx.restore();
    }

    ctx.restore();
  }

  if (cfg.center) {
    const centerScale = cfg.centerScale || 0.38;
    const centerGlow = cfg.centerGlow || 0.58;
    const orb = ctx.createRadialGradient(0, 0, orbRadius * 0.08, 0, 0, orbRadius * centerGlow);
    orb.addColorStop(0, `hsla(${(baseHue + 24) % 360}, 100%, 66%, ${0.18 * cfg.glow})`);
    orb.addColorStop(1, `hsla(${(baseHue + 214) % 360}, 90%, 42%, 0.03)`);
    ctx.beginPath();
    ctx.arc(0, 0, orbRadius * centerGlow, 0, TAU);
    ctx.fillStyle = orb;
    ctx.fill();

    ctx.beginPath();
    ctx.arc(0, 0, orbRadius * (centerScale + levels.beat * 0.03), 0, TAU);
    ctx.fillStyle = `hsla(${(baseHue + 14) % 360}, 98%, 56%, ${0.08 + levels.beat * 0.05})`;
    ctx.fill();
  }

  ctx.restore();
}

function drawMirror(levels, time) {
  drawMirrorFamily(levels, time, "veil");
}

function drawMirrorStorm(levels, time) {
  drawMirrorFamily(levels, time, "storm");
}

function drawMirrorVoid(levels, time) {
  drawMirrorFamily(levels, time, "void");
}

function drawMirrorPulse(levels, time) {
  drawMirrorFamily(levels, time, "pulse");
}

function drawShardsFamily(levels, time, variant) {
  const profile = getVisualProfile();
  const palette = getLivePalette();
  const baseHue = (palette.hueC + state.hueDrift * 0.9) % 360;

  const variantMap = {
    core: { density: 1, tip: 1, spread: 0.62, glow: 1, colorShift: 1, corePulse: 0.8, whiteCore: true },
    bloom: { density: 1.16, tip: 1.08, spread: 0.74, glow: 1.2, colorShift: 1.34, corePulse: 0.9, whiteCore: true },
    nova: { density: 1.28, tip: 1.16, spread: 0.82, glow: 1.34, colorShift: 1.7, corePulse: 1.02, whiteCore: true },
  };
  const cfg = variantMap[variant] || variantMap.core;
  const stride = profile.density < 0.95 ? 2 : 1;

  ctx.save();
  ctx.translate(centerX, centerY);
  ctx.rotate(time * 0.00011 * profile.motion * cfg.tip);
  ctx.globalCompositeOperation = "lighter";

  for (let i = 0; i < state.shards.length; i += stride) {
    const shard = state.shards[i];
    const bin = shard.band % Math.max(1, state.frequencyData.length - 1);
    const amp = (state.frequencyData[bin] / 255) * state.liveSensitivity;
    const core = baseRadius * (0.09 + shard.depth * 0.16);
    const tip = core + amp * (baseRadius * (1.1 + profile.pulse * 0.66) * cfg.tip) + levels.beat * (28 + profile.pulse * 24);
    const angle = shard.angle + Math.sin(time * 0.00062 * profile.motion + i * 0.07) * (0.11 + profile.turbulence * 0.09 * cfg.spread);

    const widthFactor = shard.spread * cfg.spread;
    const x1 = Math.cos(angle - widthFactor) * core;
    const y1 = Math.sin(angle - widthFactor) * core;
    const x2 = Math.cos(angle + widthFactor) * core;
    const y2 = Math.sin(angle + widthFactor) * core;
    const xt = Math.cos(angle) * tip;
    const yt = Math.sin(angle) * tip;

    const hueA = (baseHue + i * 0.8 * cfg.colorShift) % 360;
    const hueB = (palette.hueA + i * 1.2 * cfg.colorShift) % 360;
    const hueMix = (hueA + hueB) * 0.5;
    ctx.beginPath();
    ctx.moveTo(x1, y1);
    ctx.lineTo(xt, yt);
    ctx.lineTo(x2, y2);
    ctx.closePath();
    ctx.fillStyle = `hsla(${hueMix % 360}, 96%, ${38 + amp * 30}%, ${0.05 + amp * 0.18 * profile.glow * cfg.glow})`;
    ctx.fill();
  }

  const coreRadius = baseRadius * (0.16 + levels.bass * 0.18 + state.impactPulse * 0.04 + profile.pulse * 0.05 * cfg.corePulse);
  const spikeCount = Math.max(26, Math.floor(36 * cfg.density));
  const spikeLen = coreRadius * (0.18 + levels.beat * 0.22 + state.impactPulse * 0.08);

  for (let s = 0; s < spikeCount; s += 1) {
    const a = (s / spikeCount) * TAU + time * 0.0009 * cfg.tip;
    const wobble = Math.sin(time * 0.004 + s * 0.7) * coreRadius * 0.05;
    const inner = coreRadius * 0.9 + wobble;
    const outer = inner + spikeLen * (0.72 + Math.sin(s * 1.8 + time * 0.003) * 0.28);
    ctx.strokeStyle = `hsla(${(baseHue + s * 7 * cfg.colorShift) % 360}, 96%, ${54 + levels.beat * 18}%, ${0.08 + profile.glow * 0.18})`;
    ctx.lineWidth = (1.1 + levels.beat * 1.4) * profile.line;
    ctx.beginPath();
    ctx.moveTo(Math.cos(a) * inner, Math.sin(a) * inner);
    ctx.lineTo(Math.cos(a) * outer, Math.sin(a) * outer);
    ctx.stroke();
  }

  ctx.globalCompositeOperation = "source-over";
  const coreGlow = ctx.createRadialGradient(0, 0, coreRadius * 0.16, 0, 0, coreRadius * 1.35);
  coreGlow.addColorStop(0, cfg.whiteCore ? `rgba(255, 255, 255, ${0.28 + 0.08 * cfg.glow})` : `hsla(${(baseHue + 26) % 360}, 98%, 70%, ${0.24 + 0.08 * cfg.glow})`);
  coreGlow.addColorStop(1, "transparent");
  ctx.beginPath();
  ctx.arc(0, 0, coreRadius * 1.35, 0, TAU);
  ctx.fillStyle = coreGlow;
  ctx.fill();

  ctx.beginPath();
  ctx.arc(0, 0, coreRadius, 0, TAU);
  ctx.fillStyle = cfg.whiteCore ? "rgba(255, 255, 255, 0.94)" : `hsla(${(baseHue + 16) % 360}, 94%, ${44 + levels.beat * 12}%, 0.92)`;
  ctx.fill();

  ctx.beginPath();
  ctx.arc(0, 0, coreRadius * (0.76 + levels.beat * 0.12), 0, TAU);
  ctx.strokeStyle = cfg.whiteCore ? `rgba(255, 255, 255, ${0.24 + levels.beat * 0.18})` : `hsla(${(baseHue + 68) % 360}, 100%, 74%, ${0.2 + levels.beat * 0.26})`;
  ctx.lineWidth = (1.8 + levels.beat * 1.6) * profile.line;
  ctx.stroke();

  ctx.restore();
}

function drawShards(levels, time) {
  drawShardsFamily(levels, time, "core");
}

function drawShardsBloom(levels, time) {
  drawShardsFamily(levels, time, "bloom");
}

function drawShardsNova(levels, time) {
  drawShardsFamily(levels, time, "nova");
}

function drawPrism(levels, time) {
  const palette = getLivePalette();
  const baseHue = (palette.hueA + state.hueDrift * 1.05) % 360;
  const petals = 10 + Math.floor(levels.bass * 8);
  const layers = 6;

  ctx.save();
  ctx.translate(centerX, centerY);
  ctx.rotate(time * 0.00006);
  ctx.globalCompositeOperation = "lighter";
  ctx.lineCap = "round";

  for (let layer = 0; layer < layers; layer += 1) {
    const layerRatio = (layer + 1) / layers;
    const petalRadius = baseRadius * (0.24 + layerRatio * (0.95 + levels.bass * 0.2));
    const spread = 0.18 + layerRatio * 0.2;
    const layerRotate = time * (0.00008 + layerRatio * 0.00006);
    ctx.save();
    ctx.rotate(layerRotate);

    for (let p = 0; p < petals; p += 1) {
      const angle = (p / petals) * TAU;
      const bin = Math.floor(((p + layer * 9) / petals) * Math.min(900, state.frequencyData.length - 1));
      const amp = (state.frequencyData[bin] / 255) * state.liveSensitivity;
      const bloom = 0.38 + amp * 1.1 + levels.beat * 0.3;
      const inner = petalRadius * (0.58 + amp * 0.16);
      const outer = petalRadius * (0.92 + bloom * 0.46);
      const cx = Math.cos(angle) * inner;
      const cy = Math.sin(angle) * inner;

      ctx.beginPath();
      ctx.moveTo(cx, cy);
      ctx.quadraticCurveTo(
        Math.cos(angle - spread) * outer,
        Math.sin(angle - spread) * outer,
        Math.cos(angle) * (outer + 8 + amp * 18),
        Math.sin(angle) * (outer + 8 + amp * 18)
      );
      ctx.quadraticCurveTo(
        Math.cos(angle + spread) * outer,
        Math.sin(angle + spread) * outer,
        cx,
        cy
      );
      ctx.closePath();
      ctx.fillStyle = `hsla(${(baseHue + layer * 18 + p * 4.6) % 360}, 95%, ${52 + amp * 24}%, ${0.06 + amp * 0.14})`;
      ctx.fill();
    }
    ctx.restore();
  }

  const core = baseRadius * (0.2 + levels.bass * 0.4 + state.impactPulse * 0.1);
  const glow = ctx.createRadialGradient(0, 0, core * 0.2, 0, 0, core * 1.5);
  glow.addColorStop(0, `hsla(${baseHue}, 98%, 70%, 0.2)`);
  glow.addColorStop(1, "transparent");
  ctx.beginPath();
  ctx.arc(0, 0, core * 1.5, 0, TAU);
  ctx.fillStyle = glow;
  ctx.fill();

  ctx.restore();
}

function drawCorridor(levels, time) {
  const palette = getLivePalette();
  const baseHue = (palette.hueB + state.hueDrift * 1.1) % 360;
  const segments = 42;
  const travel = (time * (0.00013 + levels.overall * 0.00025)) % 1;
  const spin = time * (0.00022 + levels.mids * 0.00015) + state.impactPulse * 0.14;
  const maxW = width * (0.78 + levels.bass * 0.12);
  const maxH = height * (0.76 + levels.mids * 0.08);
  const minW = Math.max(40, width * 0.04);
  const minH = Math.max(26, height * 0.04);

  ctx.save();
  ctx.translate(centerX, centerY);
  ctx.rotate(spin);
  ctx.globalCompositeOperation = "lighter";

  for (let i = segments - 1; i >= 0; i -= 1) {
    const t = ((i / segments) + travel) % 1;
    const depth = Math.pow(t, 1.85);
    const w = lerp(minW, maxW, depth);
    const h = lerp(minH, maxH, depth);
    const bin = Math.floor(t * Math.min(1000, state.frequencyData.length - 1));
    const amp = (state.frequencyData[bin] / 255) * state.liveSensitivity;
    const pulse = 1 + amp * 0.2 + levels.beat * 0.08;
    const frameAlpha = 0.05 + depth * 0.2 + amp * 0.1;
    const frameHue = (baseHue + i * 3.6 + amp * 48) % 360;

    ctx.save();
    ctx.rotate(i * 0.006 + Math.sin(time * 0.0011 + i * 0.35) * 0.01);
    ctx.scale(pulse, pulse);
    ctx.strokeStyle = `hsla(${frameHue}, 96%, ${54 + amp * 24}%, ${frameAlpha})`;
    ctx.lineWidth = 0.9 + depth * 2.8 + amp * 1.6;
    ctx.strokeRect(-w / 2, -h / 2, w, h);
    ctx.restore();

    const blink = Math.max(0, Math.sin(time * 0.009 + i * 0.95)) ** 2;
    const flash = clamp(blink * 0.75 + levels.beat * 0.55 + amp * 0.3, 0, 1);
    const lightSize = 1.6 + depth * 6 + flash * 3;
    const sideInset = 6 + amp * 8;
    const yOffset = Math.sin(time * 0.0016 + i * 0.22) * h * 0.18 * (1 - depth * 0.45);

    for (let side = -1; side <= 1; side += 2) {
      const x = side * (w * 0.5 - sideInset);
      const y = yOffset * side;
      ctx.beginPath();
      ctx.arc(x, y, lightSize, 0, TAU);
      ctx.fillStyle = `hsla(${(frameHue + side * 16) % 360}, 100%, ${62 + flash * 24}%, ${0.08 + flash * 0.45})`;
      ctx.fill();
    }
  }

  const glow = ctx.createRadialGradient(0, 0, minW * 0.2, 0, 0, minW * 3.2);
  glow.addColorStop(0, `hsla(${baseHue}, 98%, 74%, 0.28)`);
  glow.addColorStop(1, "transparent");
  ctx.beginPath();
  ctx.arc(0, 0, minW * 3.2, 0, TAU);
  ctx.fillStyle = glow;
  ctx.fill();

  ctx.restore();
}

function drawHexCore(levels, time) {
  const palette = getLivePalette();
  const baseHue = (palette.hueA + state.hueDrift * 0.95) % 360;
  const layers = 34;
  const travel = (time * (0.00016 + levels.overall * 0.00032)) % 1;
  const spin = time * (0.00018 + levels.mids * 0.00012);
  const minR = Math.min(width, height) * 0.085;
  const maxR = Math.min(width, height) * 0.68;

  ctx.save();
  ctx.translate(centerX, centerY);
  ctx.rotate(spin);
  ctx.globalCompositeOperation = "lighter";

  for (let i = layers - 1; i >= 0; i -= 1) {
    const t = ((i / layers) + travel) % 1;
    const depth = Math.pow(t, 1.65);
    const radius = lerp(minR, maxR, depth);
    const bin = Math.floor(t * Math.min(980, state.frequencyData.length - 1));
    const amp = (state.frequencyData[bin] / 255) * state.liveSensitivity;
    const hue = (baseHue + i * 4.6 + amp * 48) % 360;
    const alpha = 0.06 + depth * 0.2 + amp * 0.1;

    ctx.save();
    ctx.rotate(i * 0.007 + Math.sin(time * 0.001 + i * 0.43) * 0.03);
    ctx.beginPath();
    traceRegularPolygonPath(6, radius * (1 + amp * 0.08));
    ctx.strokeStyle = `hsla(${hue}, 98%, ${52 + amp * 24}%, ${alpha})`;
    ctx.lineWidth = 0.9 + depth * 3 + amp * 2;
    ctx.stroke();
    ctx.restore();

    const chipCount = 6;
    for (let c = 0; c < chipCount; c += 1) {
      const sideAngle = (c / chipCount) * TAU + i * 0.03;
      const chipAmp = Math.max(0, Math.sin(time * 0.0045 + i * 0.22 + c));
      const chipGlow = clamp(chipAmp * 0.65 + levels.beat * 0.55 + amp * 0.3, 0, 1);
      const chipR = radius * (0.94 + chipGlow * 0.05);
      const x = Math.cos(sideAngle) * chipR;
      const y = Math.sin(sideAngle) * chipR;
      const w = 4 + depth * 18 + chipGlow * 8;
      const h = 2 + depth * 9 + chipGlow * 4;

      ctx.save();
      ctx.translate(x, y);
      ctx.rotate(sideAngle + Math.PI / 2);
      ctx.fillStyle = `hsla(${(hue + 20) % 360}, 100%, ${66 + chipGlow * 18}%, ${0.08 + chipGlow * 0.42})`;
      ctx.fillRect(-w / 2, -h / 2, w, h);
      ctx.restore();
    }
  }

  const coreRadius = minR * (0.7 + levels.bass * 0.25 + state.impactPulse * 0.1);
  const coreGlow = ctx.createRadialGradient(0, 0, coreRadius * 0.2, 0, 0, coreRadius * 3.6);
  coreGlow.addColorStop(0, `hsla(${(baseHue + 320) % 360}, 100%, 68%, 0.42)`);
  coreGlow.addColorStop(1, "transparent");
  ctx.beginPath();
  ctx.arc(0, 0, coreRadius * 3.6, 0, TAU);
  ctx.fillStyle = coreGlow;
  ctx.fill();

  ctx.beginPath();
  traceRegularPolygonPath(6, coreRadius * 1.28);
  ctx.strokeStyle = `hsla(${(baseHue + 320) % 360}, 100%, 70%, ${0.44 + levels.beat * 0.2})`;
  ctx.lineWidth = 2.6 + levels.beat * 3.2;
  ctx.stroke();
  ctx.restore();
}

function drawHexTunnel(levels, time) {
  const palette = getLivePalette();
  const baseHue = (palette.hueC + state.hueDrift * 1.05) % 360;
  const rings = 28;
  const travel = (time * (0.00014 + levels.overall * 0.00026)) % 1;
  const minR = Math.min(width, height) * 0.1;
  const maxR = Math.min(width, height) * 0.78;

  ctx.save();
  ctx.translate(centerX, centerY);
  ctx.rotate(time * 0.00008);
  ctx.globalCompositeOperation = "lighter";

  for (let i = 0; i < rings; i += 1) {
    const t = ((i / rings) + travel) % 1;
    const depth = Math.pow(t, 1.5);
    const radius = lerp(minR, maxR, depth);
    const bin = Math.floor(t * Math.min(900, state.frequencyData.length - 1));
    const amp = (state.frequencyData[bin] / 255) * state.liveSensitivity;
    const lineAlpha = 0.08 + depth * 0.24 + amp * 0.13;
    const hue = (baseHue + i * 6 + amp * 42) % 360;

    ctx.save();
    ctx.rotate(-i * 0.01 + Math.sin(time * 0.0012 + i * 0.3) * 0.025);
    ctx.beginPath();
    traceRegularPolygonPath(6, radius * (1 + amp * 0.05));
    ctx.strokeStyle = `hsla(${hue}, 100%, ${58 + amp * 24}%, ${lineAlpha})`;
    ctx.lineWidth = 1 + depth * 2.4 + amp * 1.6;
    ctx.stroke();

    for (let v = 0; v < 6; v += 1) {
      const a = (v / 6) * TAU - Math.PI / 2;
      const x = Math.cos(a) * radius;
      const y = Math.sin(a) * radius;
      const dot = 1.6 + depth * 4 + amp * 2 + levels.beat * 1.5;
      ctx.beginPath();
      ctx.arc(x, y, dot, 0, TAU);
      ctx.fillStyle = `hsla(${(hue + 22) % 360}, 100%, ${66 + amp * 20}%, ${0.06 + amp * 0.34})`;
      ctx.fill();
    }
    ctx.restore();
  }

  const beamCount = 6;
  for (let b = 0; b < beamCount; b += 1) {
    const a = (b / beamCount) * TAU - Math.PI / 2 + time * 0.00009;
    const beamLen = maxR * (0.96 + levels.bass * 0.1);
    ctx.beginPath();
    ctx.moveTo(Math.cos(a) * minR * 0.7, Math.sin(a) * minR * 0.7);
    ctx.lineTo(Math.cos(a) * beamLen, Math.sin(a) * beamLen);
    ctx.strokeStyle = `hsla(${(baseHue + b * 14) % 360}, 98%, 62%, ${0.08 + levels.highs * 0.18})`;
    ctx.lineWidth = 1.1 + levels.highs * 1.8;
    ctx.stroke();
  }

  ctx.restore();
}

function drawCubeField(levels, time) {
  const palette = getLivePalette();
  const hue = (palette.hueB + state.hueDrift * 0.86) % 360;
  const cols = 9;
  const rows = 7;
  const cellW = width / (cols + 1);
  const cellH = height / (rows + 2.4);
  const baseSize = Math.min(cellW, cellH) * 0.34;

  ctx.save();
  ctx.globalCompositeOperation = "lighter";

  for (let y = 0; y < rows; y += 1) {
    for (let x = 0; x < cols; x += 1) {
      const idx = y * cols + x;
      const px = (x + 1) * cellW + (y % 2 ? cellW * 0.28 : 0);
      const py = (y + 1.1) * cellH;
      const bin = (idx * 17) % Math.max(1, state.frequencyData.length - 1);
      const amp = (state.frequencyData[bin] / 255) * state.liveSensitivity;
      const pulse = Math.sin(time * 0.0018 + idx * 0.42) * 0.35 + 0.65;
      const scale = 0.82 + amp * 0.95 + pulse * 0.16;
      const cubeSize = baseSize * scale;
      const lum = 42 + amp * 34 + levels.beat * 14;
      drawIsoCube(
        px,
        py,
        cubeSize,
        `hsla(${(hue + idx * 1.8) % 360}, 96%, ${lum + 10}%, 0.18)`,
        `hsla(${(hue + idx * 1.8 + 18) % 360}, 92%, ${lum - 8}%, 0.13)`,
        `hsla(${(hue + idx * 1.8 - 12) % 360}, 92%, ${lum - 4}%, 0.14)`,
        `hsla(${(hue + idx * 2.3 + 22) % 360}, 100%, ${lum + 12}%, 0.28)`
      );
    }
  }

  ctx.restore();
}

function drawStarOrbitFamily(levels, time, variant) {
  const profile = getVisualProfile();
  const palette = getLivePalette();
  const baseHue = (palette.hueB + state.hueDrift) % 360;

  const variantMap = {
    orbit: { rings: 5, planets: 30, speed: 1, tail: 0.22, burst: 0.28, coreScale: 0.62 },
    trail: { rings: 6, planets: 20, speed: 1.18, tail: 0.34, burst: 0.52, coreScale: 0.84 },
    burst: { rings: 5, planets: 18, speed: 1.3, tail: 0.28, burst: 0.84, coreScale: 0.9 },
  };
  const cfg = variantMap[variant] || variantMap.orbit;
  const starRadius = baseRadius * (0.12 + levels.bass * 0.14 + state.impactPulse * 0.03) * (cfg.coreScale || 1);

  ctx.save();
  ctx.translate(centerX, centerY);
  ctx.globalCompositeOperation = "lighter";

  for (let r = 1; r <= cfg.rings; r += 1) {
    const rr = starRadius * (1.4 + r * 0.65 + Math.sin(time * 0.0008 * cfg.speed + r) * 0.08);
    ctx.beginPath();
    ctx.ellipse(0, 0, rr, rr * (0.42 + r * 0.05), time * 0.00025 * cfg.speed + r * 0.32, 0, TAU);
    ctx.strokeStyle = `hsla(${(baseHue + r * 16) % 360}, 94%, 58%, ${0.05 + profile.glow * 0.06})`;
    ctx.lineWidth = (0.9 + levels.highs * 1.2) * profile.line;
    ctx.stroke();
  }

  for (let i = 0; i < cfg.planets; i += 1) {
    const band = (i * 17) % Math.max(1, state.frequencyData.length - 1);
    const amp = (state.frequencyData[band] / 255) * state.liveSensitivity;
    const orbit = starRadius * (1.7 + (i % 6) * 0.58 + amp * 1.3);
    const angle = time * (0.00045 + ((i % 5) * 0.00008 + 0.00004) * cfg.speed) + i * (TAU / cfg.planets);
    const tilt = 0.44 + (i % 4) * 0.12;
    const x = Math.cos(angle) * orbit;
    const y = Math.sin(angle * (1.06 + (i % 3) * 0.18)) * orbit * tilt;
    const planetSize = (1.2 + (i % 4) * 0.55 + amp * 2.4) * profile.line;
    const hue = (baseHue + i * 21 + amp * 66) % 360;

    ctx.beginPath();
    ctx.arc(x, y, planetSize * (1 + cfg.tail * 0.4), 0, TAU);
    ctx.fillStyle = `hsla(${hue}, 96%, 62%, ${0.08 + cfg.tail * 0.14})`;
    ctx.fill();

    ctx.beginPath();
    ctx.arc(x, y, planetSize, 0, TAU);
    ctx.fillStyle = `hsla(${(hue + 12) % 360}, 100%, 70%, ${0.26 + amp * 0.36})`;
    ctx.fill();
  }

  const rayCount = 18 + Math.floor(cfg.burst * 12);
  for (let i = 0; i < rayCount; i += 1) {
    const a = (i / rayCount) * TAU + time * 0.0008 * cfg.speed;
    const len = starRadius * (1.4 + cfg.burst * 1.8 + levels.beat * 1.2 + Math.sin(time * 0.006 + i * 0.8) * 0.3);
    ctx.strokeStyle = `hsla(${(baseHue + i * 8) % 360}, 100%, ${56 + levels.beat * 24}%, ${0.05 + cfg.burst * 0.2})`;
    ctx.lineWidth = (0.9 + levels.beat * 1.6) * profile.line;
    ctx.beginPath();
    ctx.moveTo(Math.cos(a) * starRadius * 0.35, Math.sin(a) * starRadius * 0.35);
    ctx.lineTo(Math.cos(a) * len, Math.sin(a) * len);
    ctx.stroke();
  }

  const starGlow = ctx.createRadialGradient(0, 0, starRadius * 0.1, 0, 0, starRadius * 2.3);
  starGlow.addColorStop(0, `hsla(${(baseHue + 24) % 360}, 100%, 74%, ${0.4 + levels.beat * 0.18})`);
  starGlow.addColorStop(1, "transparent");
  ctx.beginPath();
  ctx.arc(0, 0, starRadius * 2.3, 0, TAU);
  ctx.fillStyle = starGlow;
  ctx.fill();

  ctx.beginPath();
  ctx.arc(0, 0, starRadius, 0, TAU);
  ctx.fillStyle = `hsla(${(baseHue + 36) % 360}, 100%, 68%, 0.8)`;
  ctx.fill();

  ctx.restore();
}

function drawVortex(levels, time) {
  drawStarOrbitFamily(levels, time, "orbit");
}

function drawStarTrail(levels, time) {
  drawStarOrbitFamily(levels, time, "trail");
}

function drawStarBurst(levels, time) {
  drawStarOrbitFamily(levels, time, "burst");
}

function drawGridTideFamily(levels, time, variant) {
  const profile = getVisualProfile();
  const palette = getLivePalette();
  const hueA = (palette.hueA + state.hueDrift * 0.9) % 360;
  const hueB = (palette.hueB + state.hueDrift * 0.65) % 360;
  const hueC = (palette.hueC + state.hueDrift * 0.45) % 360;
  const splitY = height * 0.5;

  const variantMap = {
    flux: {
      sunScale: 1,
      floorSpeed: 0.00023,
      rainSpeed: 0.00038,
      pulse: 1,
      laneDensity: 1,
      stripeSpeed: 1,
      drift: 1,
    },
    sun: {
      sunScale: 1.18,
      floorSpeed: 0.0002,
      rainSpeed: 0.00032,
      pulse: 1.12,
      laneDensity: 1.1,
      stripeSpeed: 1.2,
      drift: 1.15,
    },
    rush: {
      sunScale: 0.94,
      floorSpeed: 0.00032,
      rainSpeed: 0.00062,
      pulse: 1.34,
      laneDensity: 1.24,
      stripeSpeed: 1.35,
      drift: 1.6,
    },
  };
  const cfg = variantMap[variant] || variantMap.flux;

  const driftX = Math.sin(time * 0.00055 * profile.motion) * width * 0.015 * cfg.drift;
  const vanishX = centerX + driftX + Math.sin(time * 0.0012 + levels.beat * 6.2) * 8;
  const vanishY = splitY + 1 + levels.beat * 4;
  const sunR = Math.min(width * 0.24, splitY * 0.88) * cfg.sunScale * (0.94 + levels.bass * 0.18);

  ctx.save();
  ctx.globalCompositeOperation = "lighter";

  const skyGrad = ctx.createLinearGradient(0, 0, 0, splitY + 12);
  skyGrad.addColorStop(0, `hsla(${hueA}, 86%, 16%, 0.44)`);
  skyGrad.addColorStop(1, `hsla(${hueB}, 92%, 12%, 0.05)`);
  ctx.fillStyle = skyGrad;
  ctx.fillRect(0, 0, width, splitY + 12);

  ctx.beginPath();
  ctx.moveTo(centerX - sunR, splitY);
  ctx.arc(centerX, splitY, sunR, Math.PI, 0);
  ctx.closePath();
  const sunGrad = ctx.createLinearGradient(0, splitY - sunR, 0, splitY);
  sunGrad.addColorStop(0, `hsla(${hueB}, 100%, ${68 + levels.beat * 14}%, ${0.2 + profile.glow * 0.14})`);
  sunGrad.addColorStop(1, `hsla(${hueC}, 96%, ${56 + levels.bass * 16}%, ${0.14 + profile.glow * 0.1})`);
  ctx.fillStyle = sunGrad;
  ctx.fill();

  const stripeGap = 10 + (1 - levels.intensity) * 7;
  const stripeOffset = (time * 0.03 * cfg.stripeSpeed) % stripeGap;
  for (let y = splitY - sunR + stripeOffset; y < splitY; y += stripeGap) {
    const dy = splitY - y;
    const span = Math.sqrt(Math.max(0, sunR * sunR - dy * dy));
    const flash = 0.5 + Math.sin(time * 0.008 + y * 0.2) * 0.5;
    ctx.strokeStyle = `hsla(${(hueA + 18) % 360}, 100%, 74%, ${(0.08 + flash * 0.2) * profile.glow})`;
    ctx.lineWidth = (1 + levels.beat * 1.8) * profile.line;
    ctx.beginPath();
    ctx.moveTo(centerX - span * 0.92, y);
    ctx.lineTo(centerX + span * 0.92, y);
    ctx.stroke();
  }

  const rainCount = Math.max(18, Math.floor(26 * profile.density * cfg.laneDensity));
  for (let i = 0; i < rainCount; i += 1) {
    const x = (i / Math.max(1, rainCount - 1)) * width + Math.sin(i * 0.8 + time * 0.0006) * 5;
    const flow = ((time * cfg.rainSpeed * (1 + levels.overall * 2.2)) + i * 0.077) % 1;
    const y = flow * splitY;
    const len = 18 + levels.highs * 84 * cfg.pulse;
    const blink = 0.5 + Math.sin(time * 0.01 * cfg.pulse + i * 1.4) * 0.5;
    const hue = (hueC + i * 5.4 + blink * 36) % 360;
    ctx.strokeStyle = `hsla(${hue}, 100%, ${62 + blink * 16}%, ${0.05 + blink * 0.23 * profile.glow})`;
    ctx.lineWidth = Math.max(0.8, (0.9 + levels.beat * 0.9) * profile.line);
    ctx.beginPath();
    ctx.moveTo(x, Math.max(0, y - len));
    ctx.lineTo(x, y);
    ctx.stroke();
  }

  const horizonGlow = ctx.createLinearGradient(0, splitY - 8, 0, splitY + 10);
  horizonGlow.addColorStop(0, "transparent");
  horizonGlow.addColorStop(1, `hsla(${(hueB + 20) % 360}, 100%, 66%, ${0.18 + levels.beat * 0.18})`);
  ctx.fillStyle = horizonGlow;
  ctx.fillRect(0, splitY - 8, width, 18);

  const floorDepth = height - splitY;
  const lineCount = Math.max(15, Math.floor(22 * profile.density));
  const travel = (time * cfg.floorSpeed * (1 + levels.bass * 2.2 + levels.beat * 1.6)) % 1;
  for (let i = 0; i < lineCount; i += 1) {
    const t = ((i / lineCount) + travel) % 1;
    const depth = Math.pow(t, 1.8);
    const y = splitY + depth * (floorDepth + 32);
    const spread = lerp(width * 0.9, width * 0.06, depth);
    const flash = 0.55 + Math.sin(time * 0.006 + i * 0.8) * 0.45;
    ctx.strokeStyle = `hsla(${(hueA + i * 6.4) % 360}, 96%, ${56 + flash * 18}%, ${0.06 + depth * 0.24 * profile.glow})`;
    ctx.lineWidth = Math.max(0.9, (0.9 + depth * 2 + levels.beat * 0.9) * profile.line);
    ctx.beginPath();
    ctx.moveTo(vanishX - spread, y);
    ctx.lineTo(vanishX + spread, y);
    ctx.stroke();
  }

  const rayCount = Math.max(18, Math.floor(26 * profile.density * cfg.laneDensity));
  for (let i = -rayCount; i <= rayCount; i += 1) {
    const norm = i / rayCount;
    const xBottom = centerX + norm * width * 0.7;
    const hue = (hueB + i * 4.6 + Math.sin(time * 0.005 + i) * 18) % 360;
    const pulse = 0.45 + Math.sin(time * 0.008 + i * 0.6) * 0.55;
    ctx.strokeStyle = `hsla(${hue}, 98%, ${58 + pulse * 18}%, ${0.06 + pulse * 0.22 * profile.glow})`;
    ctx.lineWidth = Math.max(0.8, (0.9 + levels.highs * 1.4 + Math.abs(norm) * 0.8) * profile.line);
    ctx.beginPath();
    ctx.moveTo(xBottom, height + 4);
    ctx.lineTo(vanishX + norm * 10, vanishY);
    ctx.stroke();
  }

  const beatBand = 4 + levels.beat * 10 * cfg.pulse;
  ctx.fillStyle = `hsla(${(hueC + 24) % 360}, 100%, 70%, ${0.08 + levels.beat * 0.24})`;
  ctx.fillRect(0, splitY - beatBand * 0.5, width, beatBand);

  ctx.restore();
}

function drawGridFlux(levels, time) {
  const profile = getVisualProfile();
  const palette = getLivePalette();
  const hueA = (palette.hueA + state.hueDrift * 0.5) % 360;
  const hueB = (palette.hueB + state.hueDrift * 0.35) % 360;
  const hueC = (palette.hueC + state.hueDrift * 0.22) % 360;
  const horizonY = height * 0.48;
  const roadTopW = width * 0.1;
  const roadBottomW = width * 0.56;
  const roadTravel = (time * 0.00022) % 1;
  const sideTravel = (time * 0.00018) % 1;

  ctx.save();

  const skyGrad = ctx.createLinearGradient(0, 0, 0, horizonY);
  skyGrad.addColorStop(0, `hsla(${hueA}, 72%, 14%, 0.5)`);
  skyGrad.addColorStop(0.65, `hsla(${hueB}, 76%, 10%, 0.18)`);
  skyGrad.addColorStop(1, `rgba(${palette.bg[0]}, ${palette.bg[1]}, ${palette.bg[2]}, 0)`);
  ctx.fillStyle = skyGrad;
  ctx.fillRect(0, 0, width, horizonY + 4);

  for (let layer = 0; layer < 3; layer += 1) {
    const baseY = horizonY - layer * 16;
    const amp = 34 + layer * 22;
    const speed = 0.00008 + layer * 0.00003;
    ctx.beginPath();
    ctx.moveTo(0, height);
    ctx.lineTo(0, baseY);
    for (let x = 0; x <= width; x += 28) {
      const wave = Math.sin(x * 0.007 + time * speed + layer * 0.8) * amp;
      const detail = Math.cos(x * 0.013 + layer * 1.4) * (12 + layer * 5);
      ctx.lineTo(x, baseY - wave - detail);
    }
    ctx.lineTo(width, height);
    ctx.closePath();
    ctx.fillStyle = `hsla(${(hueC + layer * 12) % 360}, 58%, ${14 + layer * 4}%, ${0.22 + layer * 0.07})`;
    ctx.fill();
  }

  const horizonGlow = ctx.createLinearGradient(0, horizonY - 10, 0, horizonY + 18);
  horizonGlow.addColorStop(0, "transparent");
  horizonGlow.addColorStop(1, `hsla(${(hueB + 18) % 360}, 96%, 68%, ${0.12 + levels.beat * 0.08})`);
  ctx.fillStyle = horizonGlow;
  ctx.fillRect(0, horizonY - 10, width, 28);

  ctx.beginPath();
  ctx.moveTo(centerX - roadTopW * 0.5, horizonY);
  ctx.lineTo(centerX + roadTopW * 0.5, horizonY);
  ctx.lineTo(centerX + roadBottomW * 0.5, height);
  ctx.lineTo(centerX - roadBottomW * 0.5, height);
  ctx.closePath();
  const roadGrad = ctx.createLinearGradient(0, horizonY, 0, height);
  roadGrad.addColorStop(0, "rgba(18, 20, 30, 0.55)");
  roadGrad.addColorStop(1, "rgba(8, 10, 18, 0.94)");
  ctx.fillStyle = roadGrad;
  ctx.fill();

  ctx.strokeStyle = `hsla(${(hueA + 20) % 360}, 98%, 72%, 0.2)`;
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(centerX - roadTopW * 0.6, horizonY);
  ctx.lineTo(centerX - roadBottomW * 0.56, height);
  ctx.moveTo(centerX + roadTopW * 0.6, horizonY);
  ctx.lineTo(centerX + roadBottomW * 0.56, height);
  ctx.stroke();

  const laneCount = 18;
  for (let i = 0; i < laneCount; i += 1) {
    const t = ((i / laneCount) + roadTravel) % 1;
    const depth = Math.pow(t, 1.9);
    const y = lerp(horizonY + 8, height + 80, depth);
    const laneHalf = lerp(roadTopW * 0.08, roadBottomW * 0.08, depth);
    const laneH = lerp(6, 46, depth);
    ctx.fillStyle = `hsla(${(hueB + i * 9) % 360}, 98%, ${62 + depth * 12}%, ${0.08 + depth * 0.26})`;
    ctx.fillRect(centerX - laneHalf, y - laneH, laneHalf * 2, laneH);
  }

  const railCount = 14;
  for (let i = 0; i < railCount; i += 1) {
    const t = i / Math.max(1, railCount - 1);
    const xLeft = lerp(centerX - roadTopW * 0.9, centerX - width * 0.42, t);
    const xRight = lerp(centerX + roadTopW * 0.9, centerX + width * 0.42, t);
    const alpha = 0.05 + t * 0.1;
    ctx.strokeStyle = `hsla(${(hueC + i * 6) % 360}, 92%, 62%, ${alpha})`;
    ctx.lineWidth = 1 + t * 2;
    ctx.beginPath();
    ctx.moveTo(xLeft, horizonY);
    ctx.lineTo(xLeft - width * 0.08, height);
    ctx.moveTo(xRight, horizonY);
    ctx.lineTo(xRight + width * 0.08, height);
    ctx.stroke();
  }

  const objectCount = 20;
  for (let i = 0; i < objectCount; i += 1) {
    const t = ((i / objectCount) + sideTravel) % 1;
    const depth = Math.pow(t, 2.15);
    const y = lerp(horizonY + 6, height + 110, depth);
    const roadEdge = lerp(roadTopW * 0.55, roadBottomW * 0.58, depth);
    const sideGap = lerp(width * 0.06, width * 0.18, depth);
    const size = lerp(5, 54, depth);
    const glow = 0.04 + depth * 0.12;

    for (const side of [-1, 1]) {
      const x = centerX + side * (roadEdge + sideGap);
      if (i % 3 === 0) {
        drawIsoCube(
          x,
          y - size * 0.12,
          size * 0.42,
          `hsla(${(hueA + side * 24 + i * 4) % 360}, 88%, 54%, ${0.12 + glow})`,
          `hsla(${(hueB + side * 18 + i * 5) % 360}, 72%, 28%, ${0.18 + glow})`,
          `hsla(${(hueC + side * 14 + i * 6) % 360}, 82%, 34%, ${0.16 + glow})`,
          `rgba(255,255,255,${0.06 + glow})`
        );
      } else {
        const poleH = size * (1.1 + (i % 4) * 0.18);
        ctx.strokeStyle = `hsla(${(hueC + i * 7) % 360}, 100%, ${64 + depth * 14}%, ${0.08 + glow})`;
        ctx.lineWidth = Math.max(1.2, size * 0.05);
        ctx.beginPath();
        ctx.moveTo(x, y);
        ctx.lineTo(x, y - poleH);
        ctx.stroke();

        ctx.beginPath();
        ctx.moveTo(x, y - poleH);
        ctx.lineTo(x + side * size * 0.26, y - poleH + size * 0.12);
        ctx.lineTo(x + side * size * 0.24, y - poleH + size * 0.36);
        ctx.closePath();
        ctx.fillStyle = `hsla(${(hueA + i * 12) % 360}, 96%, 68%, ${0.1 + glow})`;
        ctx.fill();
      }
    }
  }

  const dashCount = 24;
  for (let i = 0; i < dashCount; i += 1) {
    const t = ((i / dashCount) + roadTravel * 1.8) % 1;
    const depth = Math.pow(t, 2);
    const y = lerp(horizonY + 4, height + 40, depth);
    const widthDash = lerp(3, 22, depth);
    ctx.fillStyle = `rgba(255, 248, 228, ${0.08 + depth * 0.3})`;
    ctx.fillRect(centerX - widthDash * 0.5, y, widthDash, lerp(4, 28, depth));
  }

  ctx.restore();
}

function drawPixelDrive(levels, time) {
  const profile = getVisualProfile();
  const palette = getLivePalette();
  const hueA = (palette.hueA + state.hueDrift * 0.35) % 360;
  const hueB = (palette.hueB + state.hueDrift * 0.28) % 360;
  const hueC = (palette.hueC + state.hueDrift * 0.2) % 360;
  const minDim = Math.min(width, height);
  const cell = Math.max(8, Math.round(minDim / (34 + profile.density * 7)));
  const snap = (value) => Math.round(value / cell) * cell;
  const horizonY = snap(height * 0.54);
  const sunRadius = snap(minDim * (0.12 + levels.bass * 0.025 + profile.glow * 0.015));
  const roadBottomHalf = snap(width * 0.24);
  const roadTopHalf = snap(width * 0.06);
  const laneTravel = (time * (0.011 + levels.intensity * 0.018) * profile.motion) % 1;
  const sideTravel = (time * (0.0048 + levels.overall * 0.006) * profile.motion) % 1;

  ctx.save();
  ctx.globalCompositeOperation = "source-over";

  for (let y = 0; y < horizonY; y += cell) {
    const t = y / Math.max(cell, horizonY);
    const light = 8 + t * 12 + levels.beat * 4;
    ctx.fillStyle = `hsla(${(hueA + t * 18) % 360}, 72%, ${light}%, 0.9)`;
    ctx.fillRect(0, y, width, cell);
  }

  const starCount = Math.max(12, Math.floor(26 * profile.density));
  for (let i = 0; i < starCount; i += 1) {
    const px = snap(((Math.sin(i * 19.17 + time * 0.00006) + 1) * 0.5) * width);
    const py = snap(((Math.cos(i * 13.41 + time * 0.00004) + 1) * 0.5) * horizonY * 0.85);
    const twinkle = 0.4 + Math.sin(time * 0.008 + i * 1.7) * 0.6;
    const size = cell * (twinkle > 0.72 ? 0.7 : 0.4);
    ctx.fillStyle = `hsla(${(hueC + i * 9) % 360}, 92%, ${66 + twinkle * 18}%, ${0.18 + twinkle * 0.3})`;
    ctx.fillRect(px, py, size, size);
  }

  const sunCx = snap(centerX);
  const sunCy = snap(horizonY - sunRadius * 0.62);
  for (let y = -sunRadius; y <= sunRadius; y += cell) {
    const stripeSkip = ((y / cell) + Math.floor(time * 0.01)) % 5 === 0;
    for (let x = -sunRadius; x <= sunRadius; x += cell) {
      const dist = Math.sqrt(x * x + y * y);
      if (dist > sunRadius) continue;
      if (stripeSkip && y > -sunRadius * 0.2) continue;
      const heat = 1 - dist / Math.max(cell, sunRadius);
      ctx.fillStyle = `hsla(${(hueB + heat * 26) % 360}, 96%, ${48 + heat * 26}%, ${0.22 + heat * 0.34})`;
      ctx.fillRect(sunCx + x, sunCy + y, cell, cell);
    }
  }

  const mountainCount = Math.ceil(width / cell);
  for (let i = 0; i <= mountainCount; i += 1) {
    const x = i * cell;
    const ridgeA = Math.sin(i * 0.24 + time * 0.00018) * 0.5 + 0.5;
    const ridgeB = Math.cos(i * 0.12 + 1.7) * 0.5 + 0.5;
    const mountainH = snap((24 + ridgeA * 90 + ridgeB * 34 + levels.bass * 30) * profile.density);
    ctx.fillStyle = `hsla(${(hueA + i * 1.2) % 360}, 58%, 14%, 0.94)`;
    ctx.fillRect(x, horizonY - mountainH, cell, mountainH);
    ctx.fillStyle = `hsla(${(hueB + i * 1.4) % 360}, 52%, 10%, 0.9)`;
    ctx.fillRect(x, horizonY - mountainH * 0.56, cell, mountainH * 0.12 + cell);
  }

  for (let y = horizonY; y < height; y += cell) {
    const depth = (y - horizonY) / Math.max(cell, height - horizonY);
    const roadHalf = snap(roadTopHalf + (roadBottomHalf - roadTopHalf) * depth);
    const center = snap(centerX);
    ctx.fillStyle = depth < 0.45 ? "rgba(20, 15, 28, 0.94)" : "rgba(12, 10, 18, 0.98)";
    ctx.fillRect(center - roadHalf, y, roadHalf * 2, cell);

    const shoulder = snap(cell + depth * cell * 1.6);
    ctx.fillStyle = `hsla(${(hueC + 18) % 360}, 88%, ${26 + depth * 18}%, 0.38)`;
    ctx.fillRect(center - roadHalf - shoulder, y, shoulder, cell);
    ctx.fillRect(center + roadHalf, y, shoulder, cell);

    const laneWidth = snap(Math.max(cell, roadHalf * 0.18));
    const laneGap = snap(cell * 3.5 + depth * cell * 4);
    const offset = ((laneTravel * laneGap * 2) + y * 0.6) % (laneGap * 2);
    if (((y + offset) / cell) % 2 < 1) {
      ctx.fillStyle = `hsla(${(hueB + 32) % 360}, 88%, 74%, ${0.2 + levels.beat * 0.28})`;
      ctx.fillRect(center - laneWidth * 0.5, y, laneWidth, cell);
    }
  }

  const sideCount = Math.max(8, Math.floor(12 * profile.density));
  for (let i = 0; i < sideCount; i += 1) {
    const travel = ((i / sideCount) + sideTravel) % 1;
    const depth = Math.pow(travel, 1.55);
    const y = snap(lerp(horizonY + cell, height + cell * 2, depth));
    const spread = lerp(width * 0.34, width * 0.1, depth);
    const towerW = snap(cell * (1 + depth * 2.4));
    const towerH = snap(cell * (2 + depth * 7 + levels.beat * 2));
    const color = `hsla(${(hueC + i * 14) % 360}, 86%, ${34 + depth * 28}%, ${0.18 + depth * 0.24})`;

    ctx.fillStyle = color;
    ctx.fillRect(snap(centerX - spread) - towerW, y - towerH, towerW, towerH);
    ctx.fillRect(snap(centerX + spread), y - towerH, towerW, towerH);

    const light = `hsla(${(hueB + 40) % 360}, 98%, 76%, ${0.12 + levels.highs * 0.26})`;
    ctx.fillStyle = light;
    ctx.fillRect(snap(centerX - spread) - towerW, y - towerH, towerW, cell);
    ctx.fillRect(snap(centerX + spread), y - towerH, towerW, cell);
  }

  const equalizerBars = Math.max(10, Math.floor(16 * profile.density));
  const barAreaW = equalizerBars * cell * 2;
  const startX = snap(centerX - barAreaW * 0.5);
  for (let i = 0; i < equalizerBars; i += 1) {
    const bin = Math.floor((i / equalizerBars) * Math.min(state.frequencyData.length - 1, 220));
    const amp = (state.frequencyData[bin] / 255) * state.liveSensitivity;
    const barH = snap((2 + amp * 10 + levels.bass * 4) * cell * 0.7);
    const x = startX + i * cell * 2;
    ctx.fillStyle = `hsla(${(hueA + i * 7) % 360}, 90%, ${42 + amp * 24}%, 0.22)`;
    ctx.fillRect(x, horizonY - barH - cell * 2, cell, barH);
  }

  const corePulse = snap(baseRadius * (0.08 + levels.bass * 0.03 + state.impactPulse * 0.02));
  ctx.fillStyle = `hsla(${(hueB + 24) % 360}, 100%, 74%, ${0.16 + levels.beat * 0.18})`;
  ctx.fillRect(snap(centerX - corePulse), snap(horizonY - corePulse * 0.5), corePulse * 2, cell);

  ctx.restore();
}

function drawGridSun(levels, time) {
  drawGridTideFamily(levels, time, "sun");
}

function drawGridRush(levels, time) {
  drawGridTideFamily(levels, time, "rush");
}

function drawOscFamily(levels, time, variant) {
  const profile = getVisualProfile();
  const palette = getLivePalette();
  const baseHue = (palette.hueA + state.hueDrift) % 360;

  const variantMap = {
    scope: { lines: clamp(Math.round(3 + profile.density), 3, 5), spread: 0.54, color: "blend", amp: 0.94, thickness: 1.9, centerCore: false },
    mid: { lines: 1, spread: 0, color: "mono", amp: 1.28, thickness: 1, centerCore: true },
    multi: { lines: clamp(Math.round(8 + profile.density * 6), 8, 16), spread: 0.62, color: "mono", amp: 0.88, thickness: 1, centerCore: true },
    color: { lines: clamp(Math.round(6 + profile.density * 4), 6, 12), spread: 0.54, color: "rainbow", amp: 1.02, thickness: 1, centerCore: true },
  };
  const cfg = variantMap[variant] || variantMap.scope;
  const targetSamples = cfg.lines > 10 ? 720 : 980;
  const sampleStep = Math.max(1, Math.floor(state.timeData.length / targetSamples));
  const pointCount = Math.floor(state.timeData.length / sampleStep);

  const spreadPx = baseRadius * cfg.spread;
  const amplitude = baseRadius * (0.12 + levels.bass * 0.62 + levels.mids * 0.18 + state.impactPulse * 0.14) * cfg.amp;
  const centerMove =
    Math.sin(time * 0.0022 * profile.motion + levels.bass * 6.2) * (8 + levels.bass * 42 + profile.pulse * 16) +
    Math.cos(time * 0.0014 * profile.motion + levels.highs * 4) * (4 + levels.mids * 24);
  const kickMove = Math.sin(time * 0.007 + levels.beat * 8.5) * levels.beat * 22 * profile.pulse;
  const centerYLive = centerY + centerMove + kickMove;

  ctx.save();
  ctx.globalCompositeOperation = "lighter";
  ctx.lineCap = "round";

  for (let line = 0; line < cfg.lines; line += 1) {
    const lineRatio = cfg.lines === 1 ? 0 : line / (cfg.lines - 1) - 0.5;
    const offsetY = lineRatio * spreadPx;
    const layerPhase = line * 0.34 + time * 0.0009 * profile.motion;
    const layerAmp = amplitude * (1 + Math.abs(lineRatio) * 0.32 * profile.pulse);
    const harmonicAmp = (5 + levels.mids * 20 + levels.highs * 16) * (0.7 + profile.turbulence * 0.45);

    let hue = baseHue;
    if (cfg.color === "blend") hue = (baseHue + line * 18) % 360;
    if (cfg.color === "rainbow") hue = (baseHue + line * (360 / cfg.lines) + Math.sin(time * 0.001 + line) * 32) % 360;
    const alphaGlow = clamp((0.09 + levels.intensity * 0.2) * profile.glow, 0.08, 0.46);
    const alphaCore = clamp((0.2 + levels.intensity * 0.34) * profile.glow, 0.16, 0.74);
    const tone = cfg.color === "mono" ? 72 : 64;

    ctx.beginPath();
    for (let sample = 0; sample < pointCount; sample += 1) {
      const idx = sample * sampleStep;
      const xNorm = sample / Math.max(1, pointCount - 1);
      const x = xNorm * width;
      const n = state.timeData[idx] / 128 - 1;
      const harmonic =
        Math.sin(xNorm * TAU * (2.6 + profile.turbulence * 1.5) + layerPhase) * harmonicAmp +
        Math.cos(xNorm * TAU * (8 + levels.highs * 5) + layerPhase * 1.2) * harmonicAmp * 0.46;
      const y = centerYLive + offsetY + n * layerAmp + harmonic;
      if (sample === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }
    ctx.strokeStyle = `hsla(${hue}, 98%, ${tone}%, ${alphaGlow})`;
    ctx.lineWidth = (2.6 + levels.beat * 1.6) * profile.line * cfg.thickness;
    ctx.stroke();

    ctx.beginPath();
    for (let sample = 0; sample < pointCount; sample += 1) {
      const idx = sample * sampleStep;
      const xNorm = sample / Math.max(1, pointCount - 1);
      const x = xNorm * width;
      const n = state.timeData[idx] / 128 - 1;
      const harmonic =
        Math.sin(xNorm * TAU * (2.6 + profile.turbulence * 1.5) + layerPhase) * harmonicAmp +
        Math.cos(xNorm * TAU * (8 + levels.highs * 5) + layerPhase * 1.2) * harmonicAmp * 0.46;
      const y = centerYLive + offsetY + n * layerAmp + harmonic;
      if (sample === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }
    ctx.strokeStyle = `hsla(${hue}, 100%, ${tone + 10}%, ${alphaCore})`;
    ctx.lineWidth = (1 + levels.beat * 1.15) * profile.line * (0.9 + cfg.thickness * 0.12);
    ctx.stroke();
  }

  if (cfg.centerCore) {
    const pulse = 10 + levels.beat * 44 + levels.fastDropPulse * 12 + profile.pulse * 10;
    ctx.beginPath();
    ctx.arc(centerX, centerYLive, pulse, 0, TAU);
    ctx.fillStyle = `hsla(${(baseHue + (cfg.color === "rainbow" ? 90 : 24)) % 360}, 98%, 68%, ${0.1 + profile.glow * 0.12})`;
    ctx.fill();
  }
  ctx.restore();
}

function drawOsc(levels, time) {
  drawOscFamily(levels, time, "scope");
}

function drawOscMid(levels, time) {
  drawOscFamily(levels, time, "mid");
}

function drawOscMulti(levels, time) {
  drawOscFamily(levels, time, "multi");
}

function drawOscColor(levels, time) {
  drawOscFamily(levels, time, "color");
}

function drawReactor3DFamily(levels, time, variant) {
  const profile = getVisualProfile();
  const palette = getLivePalette();
  const baseHue = (palette.hueB + state.hueDrift) % 360;
  const variantMap = {
    morph: { offset: 0, spin: 1, density: 1.12, tunnel: 1, coreScale: 0.56, orbiters: 24 },
    poly: { offset: 36, spin: 1.06, density: 1.06, tunnel: 1.2, coreScale: 0.7, orbiters: 14 },
    helix: { offset: 88, spin: 1.2, density: 1.08, tunnel: 1.14, coreScale: 0.68, orbiters: 16 },
    lattice: { offset: 146, spin: 0.94, density: 0.98, tunnel: 1.3, coreScale: 0.72, orbiters: 12 },
  };
  const cfg = variantMap[variant] || variantMap.morph;
  const minDim = Math.min(width, height);
  const uSegments = Math.round(clamp(20 * profile.density * cfg.density, 16, 36));
  const vSegments = Math.round(clamp(14 * profile.density * cfg.density, 10, 26));
  const nodeCount = uSegments * vSegments;
  const points = new Array(nodeCount);

  const majorRadius = minDim * (0.17 + levels.bass * 0.06 + state.impactPulse * 0.02);
  const tubeRadius = minDim * (0.05 + levels.mids * 0.035 + profile.pulse * 0.014);
  const sphereRadius = majorRadius * (0.96 + levels.overall * 0.2);
  const morph =
    clamp(
      0.5 +
        Math.sin(time * 0.0007 * profile.motion + levels.fastDropPulse * 3.1) * 0.5 +
        levels.beat * 0.22 +
        levels.fastDropPulse * 0.14,
      0,
      1
    );
  const pulseScale = 1 + levels.beat * 0.12 * profile.pulse + state.impactPulse * 0.04;
  const rotX = time * (0.00022 + levels.mids * 0.0002) * profile.motion * cfg.spin + Math.sin(time * 0.0009) * 0.16;
  const rotY = time * (0.00032 + levels.bass * 0.00026) * profile.motion * cfg.spin + Math.cos(time * 0.0007) * 0.2;
  const rotZ = time * (0.00018 + levels.highs * 0.00018) * profile.motion * cfg.spin;
  const cameraZ = minDim * (1.45 + profile.glow * 0.25);
  const zoom = minDim * (1 + profile.pulse * 0.12);

  ctx.save();
  ctx.globalCompositeOperation = "lighter";
  ctx.lineCap = "round";

  for (let u = 0; u < uSegments; u += 1) {
    const uNorm = u / uSegments;
    const angleU = uNorm * TAU;
    for (let v = 0; v < vSegments; v += 1) {
      const vNorm = v / vSegments;
      const angleV = vNorm * TAU;
      const lat = (vNorm - 0.5) * Math.PI;

      const ripple =
        Math.sin(angleV * 3 + time * 0.0016 * profile.motion + u * 0.17) *
        tubeRadius *
        (0.16 + levels.highs * 0.28) *
        profile.turbulence;
      const localTube = tubeRadius + ripple;

      const torusRing = majorRadius + localTube * Math.cos(angleV);
      const torusX = torusRing * Math.cos(angleU);
      const torusY = localTube * Math.sin(angleV) * 1.06;
      const torusZ = torusRing * Math.sin(angleU);

      const sphereX = sphereRadius * Math.cos(lat) * Math.cos(angleU);
      const sphereY = sphereRadius * Math.sin(lat);
      const sphereZ = sphereRadius * Math.cos(lat) * Math.sin(angleU);

      const sphereInv = 1 / Math.max(1, sphereRadius);
      const nx = sphereX * sphereInv;
      const ny = sphereY * sphereInv;
      const nz = sphereZ * sphereInv;

      const cubeM = Math.max(Math.abs(nx), Math.abs(ny), Math.abs(nz), 0.0001);
      const cubeX = (nx / cubeM) * sphereRadius * 0.82;
      const cubeY = (ny / cubeM) * sphereRadius * 0.82;
      const cubeZ = (nz / cubeM) * sphereRadius * 0.82;

      const helixAngle = angleU * (1.8 + levels.bass * 0.2) + angleV * 0.7;
      const helixR = majorRadius * 0.62 + localTube * Math.cos(angleV) * 0.9;
      const helixX = Math.cos(helixAngle) * helixR;
      const helixZ = Math.sin(helixAngle) * helixR;
      const helixY = (vNorm - 0.5) * sphereRadius * 1.55 + Math.sin(angleU * 3 + time * 0.0015) * localTube * 0.8;

      const latticeX = nx * sphereRadius * (0.56 + 0.5 * Math.abs(nx));
      const latticeY = ny * sphereRadius * (0.56 + 0.5 * Math.abs(ny));
      const latticeZ = nz * sphereRadius * (0.56 + 0.5 * Math.abs(nz));

      let point;
      if (variant === "poly") {
        point = {
          x: lerp(torusX, cubeX, morph) * pulseScale,
          y: lerp(torusY, cubeY, morph) * pulseScale,
          z: lerp(torusZ, cubeZ, morph) * pulseScale,
        };
      } else if (variant === "helix") {
        point = {
          x: lerp(helixX, sphereX, 0.34 + morph * 0.42) * pulseScale,
          y: lerp(helixY, sphereY, 0.3 + morph * 0.4) * pulseScale,
          z: lerp(helixZ, sphereZ, 0.34 + morph * 0.42) * pulseScale,
        };
      } else if (variant === "lattice") {
        point = {
          x: lerp(torusX, latticeX, morph) * pulseScale,
          y: lerp(torusY, latticeY, morph) * pulseScale,
          z: lerp(torusZ, latticeZ, morph) * pulseScale,
        };
      } else {
        point = {
          x: lerp(torusX, sphereX, morph) * pulseScale,
          y: lerp(torusY, sphereY, morph) * pulseScale,
          z: lerp(torusZ, sphereZ, morph) * pulseScale,
        };
      }

      const rotated = rotatePoint3D(point, rotX, rotY, rotZ);
      const projected = projectPoint3D(rotated, cameraZ, zoom);
      points[u * vSegments + v] = projected;
    }
  }

  for (let u = 0; u < uSegments; u += 1) {
    for (let v = 0; v < vSegments; v += 1) {
      const idx = u * vSegments + v;
      const idxU = ((u + 1) % uSegments) * vSegments + v;
      const idxV = u * vSegments + ((v + 1) % vSegments);
      const p = points[idx];
      const pU = points[idxU];
      const pV = points[idxV];
      const depthNormU = clamp(1 - (p.depth + pU.depth) / (cameraZ * 2.1), 0, 1);
      const depthNormV = clamp(1 - (p.depth + pV.depth) / (cameraZ * 2.1), 0, 1);
      const blink = 0.75 + Math.sin(time * 0.006 * profile.motion + idx * 0.11) * 0.25;
      const lineAlphaU = clamp((0.04 + depthNormU * 0.2 + levels.beat * 0.12) * profile.glow * blink, 0.02, 0.45);
      const lineAlphaV = clamp((0.04 + depthNormV * 0.2 + levels.beat * 0.12) * profile.glow * blink, 0.02, 0.45);

      ctx.strokeStyle = `hsla(${(baseHue + cfg.offset + u * 7.4 + v * 3.6) % 360}, 96%, ${54 + depthNormU * 24}%, ${lineAlphaU})`;
      ctx.lineWidth = (0.5 + depthNormU * 1.8 + levels.beat * 1.15) * profile.line;
      ctx.beginPath();
      ctx.moveTo(p.x, p.y);
      ctx.lineTo(pU.x, pU.y);
      ctx.stroke();

      ctx.strokeStyle = `hsla(${(baseHue + cfg.offset + 22 + u * 6.1 + v * 4.2) % 360}, 98%, ${56 + depthNormV * 23}%, ${lineAlphaV})`;
      ctx.lineWidth = (0.5 + depthNormV * 1.8 + levels.beat * 1.15) * profile.line;
      ctx.beginPath();
      ctx.moveTo(p.x, p.y);
      ctx.lineTo(pV.x, pV.y);
      ctx.stroke();
    }
  }

  const nodeStep = levels.intensity > 0.68 ? 2 : 3;
  for (let i = 0; i < points.length; i += nodeStep) {
    const p = points[i];
    const depth = clamp(1 - p.depth / (cameraZ * 1.95), 0, 1);
    const sparkle = Math.max(0, Math.sin(time * 0.009 * profile.motion + i * 0.23));
    const radius = (0.66 + depth * 2 + levels.beat * 1.5 + sparkle * 0.9) * profile.line;
    const alpha = clamp((0.1 + depth * 0.22 + sparkle * 0.2) * profile.glow, 0.08, 0.58);
    ctx.beginPath();
    ctx.arc(p.x, p.y, radius, 0, TAU);
    ctx.fillStyle = `hsla(${(baseHue + cfg.offset + 60 + i * 0.27) % 360}, 100%, ${62 + depth * 18}%, ${alpha})`;
    ctx.fill();
  }

  const orbiterCount = cfg.orbiters;
  for (let i = 0; i < orbiterCount; i += 1) {
    const lane = i % 3;
    const orbitRadius = sphereRadius * (1.04 + lane * 0.22);
    const angle = time * (0.00062 + lane * 0.00008) * profile.motion + i * (TAU / orbiterCount);
    const orbiter = {
      x: Math.cos(angle) * orbitRadius,
      y: Math.sin(angle * (1.18 + lane * 0.12)) * orbitRadius * (0.22 + lane * 0.07),
      z: Math.sin(angle) * orbitRadius,
    };
    const projected = projectPoint3D(rotatePoint3D(orbiter, rotX * 0.9, rotY * 1.08, rotZ), cameraZ, zoom);
    const glow = clamp(1 - projected.depth / (cameraZ * 1.8), 0, 1);
    const orbiterRadius = (1.1 + lane * 0.4 + glow * 2.1 + levels.beat * 0.8) * profile.line;
    ctx.beginPath();
    ctx.arc(projected.x, projected.y, orbiterRadius, 0, TAU);
    ctx.fillStyle = `hsla(${(baseHue + cfg.offset + 180 + i * 9) % 360}, 100%, ${66 + glow * 14}%, ${0.12 + glow * 0.26})`;
    ctx.fill();
  }

  const tunnelRings = Math.round(8 + cfg.tunnel * 2);
  ctx.save();
  ctx.translate(centerX, centerY);
  ctx.rotate(rotZ * 1.35);
  for (let i = 0; i < tunnelRings; i += 1) {
    const t = ((i / tunnelRings) + (time * 0.00015 * profile.motion) % 1) % 1;
    const depth = Math.pow(t, 1.8);
    const ringRadius = lerp(majorRadius * 0.72, minDim * (0.88 + cfg.tunnel * 0.06), depth);
    const flatten = 0.48 + depth * 0.36;
    ctx.beginPath();
    ctx.ellipse(0, 0, ringRadius, ringRadius * flatten, 0, 0, TAU);
    ctx.strokeStyle = `hsla(${(baseHue + cfg.offset + 190 + i * 18) % 360}, 98%, ${54 + depth * 22}%, ${0.02 + depth * 0.16 * profile.glow})`;
    ctx.lineWidth = (0.9 + depth * 2.2 + levels.beat * 0.7) * profile.line;
    ctx.stroke();
  }
  ctx.restore();

  const coreRadius = baseRadius * (0.1 + levels.bass * 0.14 + state.impactPulse * 0.03 + profile.pulse * 0.03) * cfg.coreScale;
  const coreGlow = ctx.createRadialGradient(centerX, centerY, coreRadius * 0.12, centerX, centerY, coreRadius * 2.2);
  coreGlow.addColorStop(0, `hsla(${(baseHue + cfg.offset + 18) % 360}, 100%, 74%, ${0.3 + levels.beat * 0.16})`);
  coreGlow.addColorStop(1, "transparent");
  ctx.beginPath();
  ctx.arc(centerX, centerY, coreRadius * 2.2, 0, TAU);
  ctx.fillStyle = coreGlow;
  ctx.fill();

  ctx.beginPath();
  ctx.arc(centerX, centerY, coreRadius, 0, TAU);
  ctx.fillStyle = `hsla(${(baseHue + cfg.offset + 34) % 360}, 100%, 70%, ${0.18 + profile.glow * 0.1})`;
  ctx.fill();

  ctx.restore();
}

function drawReactor3D(levels, time) {
  drawReactor3DFamily(levels, time, "morph");
}

function drawReactorPoly(levels, time) {
  drawReactor3DFamily(levels, time, "poly");
}

function drawReactorHelix(levels, time) {
  drawReactor3DFamily(levels, time, "helix");
}

function drawReactorLattice(levels, time) {
  drawReactor3DFamily(levels, time, "lattice");
}

function drawMode(levels, time, mode = state.mode, alpha = 1) {
  if (alpha <= 0.001) return;

  ctx.save();
  ctx.globalAlpha *= alpha;

  switch (mode) {
    case "mirror":
      drawMirror(levels, time);
      break;
    case "mirrorstorm":
      drawMirrorStorm(levels, time);
      break;
    case "mirrorvoid":
      drawMirrorVoid(levels, time);
      break;
    case "mirrorpulse":
      drawMirrorPulse(levels, time);
      break;
    case "corridor":
      drawCorridor(levels, time);
      break;
    case "hexcore":
      drawHexCore(levels, time);
      break;
    case "hextunnel":
      drawHexTunnel(levels, time);
      break;
    case "cubefield":
      drawCubeField(levels, time);
      break;
    case "prism":
      drawPrism(levels, time);
      break;
    case "shards":
      drawShards(levels, time);
      break;
    case "shardbloom":
      drawShardsBloom(levels, time);
      break;
    case "shardnova":
      drawShardsNova(levels, time);
      break;
    case "reactor3d":
      drawReactor3D(levels, time);
      break;
    case "reactorpoly":
      drawReactorPoly(levels, time);
      break;
    case "reactorhelix":
      drawReactorHelix(levels, time);
      break;
    case "reactorlattice":
      drawReactorLattice(levels, time);
      break;
    case "vortex":
      drawVortex(levels, time);
      break;
    case "starorbit":
      drawVortex(levels, time);
      break;
    case "startrail":
      drawStarTrail(levels, time);
      break;
    case "starburst":
      drawStarBurst(levels, time);
      break;
    case "gridflux":
      drawGridFlux(levels, time);
      break;
    case "gridsun":
      drawGridSun(levels, time);
      break;
    case "gridrush":
      drawGridRush(levels, time);
      break;
    case "pixeldrive":
      drawPixelDrive(levels, time);
      break;
    case "osc":
      drawOsc(levels, time);
      break;
    case "oscmid":
      drawOscMid(levels, time);
      break;
    case "oscmulti":
      drawOscMulti(levels, time);
      break;
    case "osccolor":
      drawOscColor(levels, time);
      break;
    default:
      drawKaleido(levels, time);
      break;
  }

  ctx.restore();
}

function drawFx(levels, time) {
  const profile = getVisualProfile();
  const fx = getFxFlags();
  const palette = getLivePalette();
  const hue = (palette.hueB + state.hueDrift) % 360;

  if (fx.flash) {
    const flash = clamp((state.flashPulse * 0.15 + levels.beat * 0.12) * profile.glow, 0, 0.26);
    if (flash > 0.01) {
      ctx.fillStyle = `rgba(255,255,255,${flash})`;
      ctx.fillRect(0, 0, width, height);
    }
  }

  if (fx.chroma) {
    const split = clamp(state.impactPulse * 6 * profile.turbulence, 0, 10);
    if (split > 0.2) {
      ctx.save();
      ctx.globalCompositeOperation = "screen";
      ctx.lineWidth = 1.3;
      ctx.strokeStyle = `hsla(${(hue + 160) % 360}, 98%, 65%, 0.2)`;
      ctx.strokeRect(split, 0, width - split * 2, height);
      ctx.strokeStyle = `hsla(${(hue + 330) % 360}, 98%, 65%, 0.17)`;
      ctx.strokeRect(0, split, width, height - split * 2);
      ctx.restore();
    }
  }

  if (fx.strobe && levels.beat > 0.55 && Math.floor(time / (85 / profile.motion)) % 2 === 0) {
    ctx.fillStyle = "rgba(255,255,255,0.16)";
    ctx.fillRect(0, 0, width, height);
  }
}

function drawMeter(levels) {
  const meterW = Math.min(320, width * 0.38);
  const meterH = 8;
  const meterGap = 7;
  const x = width - meterW - 22;
  const y = height - 20;
  const hue = (getLivePalette().hueA + state.hueDrift) % 360;

  ctx.fillStyle = "rgba(255,255,255,0.1)";
  ctx.fillRect(x, y, meterW, meterH);
  ctx.fillStyle = `hsla(${hue}, 96%, 60%, 0.92)`;
  ctx.fillRect(x, y, meterW * clamp(levels.overall, 0, 1), meterH);

  const y2 = y - (meterH + meterGap);
  ctx.fillStyle = "rgba(255,255,255,0.1)";
  ctx.fillRect(x, y2, meterW, meterH);
  ctx.fillStyle = `hsla(${(hue + 36) % 360}, 98%, 64%, 0.92)`;
  ctx.fillRect(x, y2, meterW * clamp(state.intensity, 0, 1), meterH);

  ctx.font = "700 12px Space Grotesk, sans-serif";
  ctx.fillStyle = "rgba(223,236,255,0.78)";
  ctx.fillText(`${state.presetName} | ${state.mode.toUpperCase()} | ${state.section.toUpperCase()}`, x, y2 - 8);
}

function maybeTimeSwitchMode(time, levels, intervalMs) {
  if (!intervalMs || intervalMs < 1000) return;
  if (time - state.lastModeSwitchAt < intervalMs) return;
  if (levels.beat < 0.18 && levels.overall < 0.5) return;
  const current = MODE_ROTATION.indexOf(state.mode);
  const next = MODE_ROTATION[(current + 1) % MODE_ROTATION.length];
  setModeWithBlend(next, time, randomBetween(1200, 2200));
  state.lastModeSwitchAt = time;
}

function detectMusicSection(levels, time) {
  if (state.overallHistory.length < 40) {
    return "steady";
  }

  if (time < state.dropHoldUntil) {
    return "drop";
  }

  const dropEase = clamp(1 - (state.dropBoost - 1) * 0.18, 0.68, 1.06);
  const dropByEnergy =
    levels.shortOverall > levels.longOverall * (1.24 * dropEase) &&
    levels.shortBass > levels.longBass * (1.3 * dropEase) &&
    levels.beat > 0.34 * dropEase;
  const dropByHit = levels.beat > 0.55 * dropEase && levels.bass > 0.26 * dropEase;
  const dropDetected =
    (dropByEnergy || dropByHit) &&
    time - state.lastDropAt > 2200 * dropEase &&
    levels.longOverall > 0.16;

  if (dropDetected) {
    state.lastDropAt = time;
    state.dropHoldUntil = time + 1500;
    state.calmFrames = 0;
    state.buildFrames = 0;
    return "drop";
  }

  const calmNow =
    levels.shortOverall < levels.longOverall * 0.66 &&
    levels.shortBass < levels.longBass * 0.7 &&
    levels.shortBeat < 0.12;
  if (calmNow) state.calmFrames += 1;
  else state.calmFrames = Math.max(0, state.calmFrames - 2);

  if (state.calmFrames > 34 && time - state.lastDropAt > 1800) {
    state.lastCalmAt = time;
    state.buildFrames = 0;
    return "calm";
  }

  const building =
    levels.shortOverall > levels.longOverall * 1.06 &&
    levels.shortBass > levels.longBass * 1.08 &&
    levels.shortBeat > 0.14;
  if (building) state.buildFrames += 1;
  else state.buildFrames = Math.max(0, state.buildFrames - 1);

  if (state.buildFrames > 16) return "build";
  return "steady";
}

function maybeAdaptiveSwitch(time, levels) {
  const nextSection = detectMusicSection(levels, time);
  const changed = nextSection !== state.section;
  if (changed) {
    state.section = nextSection;
    queuePreset(nextSection, time, "section");
    state.lastAdaptiveSwitchAt = time;
    state.lastModeSwitchAt = time;
  }
  if (!changed) return;

  if (nextSection === "drop" && state.fx === "raw") {
    state.fx = "impact";
    fxSelect.value = "impact";
  }

  if (time - state.lastSceneNoticeAt > 1200) {
    setStatus(`Cena: ${nextSection.toUpperCase()} | Modo: ${state.mode.toUpperCase()}`);
    state.lastSceneNoticeAt = time;
  }
}

function maybeAutoSwitchMode(time, levels) {
  if (state.autoMode === "off") return;
  if (state.autoMode === "time_16000") {
    maybeTimeSwitchMode(time, levels, 16000);
    return;
  }
  if (state.autoMode === "adaptive") {
    maybeAdaptiveSwitch(time, levels);
    return;
  }
  if (state.autoMode === "hybrid") {
    maybeAdaptiveSwitch(time, levels);
    maybeTimeSwitchMode(time, levels, 22000);
  }
}

function animate(time, generation = state.animationGeneration) {
  if (generation !== state.animationGeneration) {
    return;
  }

  if (!state.running || state.paused || !state.analyser || !state.frequencyData || !state.timeData) {
    return;
  }

  if (renderCanvas !== mainCanvas && (!state.popupWindow || state.popupWindow.closed)) {
    detachPopupSurface(false);
  }

  state.analyser.getByteFrequencyData(state.frequencyData);
  state.analyser.getByteTimeDomainData(state.timeData);

  const levels = collectLevels(time);
  updateColorEngine(time, levels);
  maybeAutoSwitchMode(time, levels);
  updatePresetEngine(time, levels);
  updateModeBlend(time);
  drawBackdrop(levels, time);

  const layout = getLayoutProfile();
  const fx = getFxFlags();
  const lockCamera = state.mode === "gridflux";
  state.bouncePulse *= 0.88;
  const bounce = lockCamera ? 0 : clamp(state.bouncePulse * (0.038 + state.intensity * 0.018), 0, 0.08);
  const shake = !lockCamera && fx.shake ? clamp(state.impactPulse * 7.2, 0, 18) : 0;
  const shakeX = Math.sin(time * 0.049) * shake * 0.5 + (Math.random() - 0.5) * shake * 0.28;
  const shakeY = Math.cos(time * 0.043) * shake * 0.4 + (Math.random() - 0.5) * shake * 0.3;
  const zoom = 1 + bounce + (!lockCamera && fx.shake ? state.impactPulse * 0.01 : 0);

  ctx.save();
  ctx.translate(centerX + shakeX, centerY + shakeY);
  ctx.scale(zoom * layout.scaleX, zoom * layout.scaleY);
  ctx.translate(-centerX, -centerY);
  if (state.modeBlendFrom !== state.mode && state.modeBlend < 1) {
    drawMode(levels, time, state.modeBlendFrom, 1 - state.modeBlend);
    drawMode(levels, time, state.mode, state.modeBlend);
  } else {
    drawMode(levels, time, state.mode, 1);
  }
  ctx.restore();

  drawFx(levels, time);
  drawMeter(levels);
  updateAutoHud();

  if (generation === state.animationGeneration) {
    scheduleFrame();
  }
}

function stopAnimationAndAudio({ stopTracks }) {
  cancelFrameLoop();
  state.running = false;
  state.paused = false;
  pauseBtn.textContent = "Pausar";

  if (state.sourceNode) {
    state.sourceNode.disconnect();
    state.sourceNode = null;
  }
  if (state.analyser) {
    state.analyser.disconnect();
    state.analyser = null;
  }

  if (state.audioContext && state.audioContext.state !== "closed") {
    state.audioContext.close().catch(() => {});
  }
  state.audioContext = null;

  if (stopTracks && state.stream) {
    state.stream.getTracks().forEach((track) => track.stop());
  }
  state.stream = null;
  state.frequencyData = null;
  state.timeData = null;
  state.energyHistory.length = 0;
  state.rawOverallHistory.length = 0;
  state.overallHistory.length = 0;
  state.bassHistory.length = 0;
  state.beatHistory.length = 0;
  state.rings.length = 0;
  state.impactPulse = 0;
  state.flashPulse = 0;
  state.bouncePulse = 0;
  state.beatCounter = 0;
  state.intensity = 0;
  state.presetName = "BOOT";
  state.visualProfile = cloneVisualProfile(DEFAULT_VISUAL_PROFILE);
  state.targetVisualProfile = cloneVisualProfile(DEFAULT_VISUAL_PROFILE);
  state.nextPresetAt = 0;
  state.lastPresetAt = 0;
  state.presetDropLockUntil = 0;
  state.modeBlend = 1;
  state.modeBlendFrom = state.mode;
  state.modeBlendStartedAt = 0;
  state.modeBlendDuration = 0;
  state.section = "steady";
  state.calmFrames = 0;
  state.buildFrames = 0;
  state.dropHoldUntil = 0;
  updateAutoHud();
}

async function attachStream(stream, sourceLabel) {
  const [audioTrack] = stream.getAudioTracks();
  if (!audioTrack) {
    stream.getTracks().forEach((track) => track.stop());
    setStatus("Nenhum audio detectado. Repita e marque 'Compartilhar audio'.", true);
    return;
  }

  state.stream = stream;
  const context = new AudioContext();
  await context.resume();

  const analyser = context.createAnalyser();
  analyser.fftSize = 2048;
  analyser.smoothingTimeConstant = state.smoothing;

  const source = context.createMediaStreamSource(stream);
  source.connect(analyser);

  state.audioContext = context;
  state.sourceNode = source;
  state.analyser = analyser;
  state.frequencyData = new Uint8Array(analyser.frequencyBinCount);
  state.timeData = new Uint8Array(analyser.fftSize);
  state.running = true;
  state.paused = false;
  state.autoPilot = true;
  state.autoMode = "adaptive";
  state.smartMix = "on";
  state.colorMode = "wild";
  state.dropBoost = 1.9;
  state.liveSensitivity = state.sensitivity;
  state.liveImpact = state.impact;
  state.liveTrail = state.trail;
  state.lastModeSwitchAt = performance.now();
  state.lastAdaptiveSwitchAt = performance.now();
  state.lastDropAt = 0;
  state.lastCalmAt = 0;
  state.section = "steady";
  state.calmFrames = 0;
  state.buildFrames = 0;
  state.dropHoldUntil = 0;
  state.beatCounter = 0;
  state.bouncePulse = 0;
  state.intensity = 0;
  const startupPreset = PROJECTM_PRESETS.find((preset) => preset.mode === "gridflux") || PROJECTM_PRESETS[0];
  state.mode = startupPreset.mode;
  modeSelect.value = startupPreset.mode;
  state.presetName = startupPreset.name;
  state.visualProfile = cloneVisualProfile(startupPreset.profile);
  state.targetVisualProfile = randomizePresetProfile(startupPreset.profile);
  state.nextPresetAt = performance.now() + randomBetween(18000, 29000);
  state.lastPresetAt = performance.now();
  state.presetDropLockUntil = 0;
  state.modeBlend = 1;
  state.modeBlendFrom = state.mode;
  state.modeBlendStartedAt = 0;
  state.modeBlendDuration = 0;
  if (autoModeSelect) autoModeSelect.value = "adaptive";
  if (smartMixSelect) smartMixSelect.value = "on";
  if (colorModeSelect) colorModeSelect.value = "wild";
  if (dropBoostInput) dropBoostInput.value = "1.9";
  pauseBtn.textContent = "Pausar";

  stream.getTracks().forEach((track) => {
    track.addEventListener("ended", () => {
      stopAnimationAndAudio({ stopTracks: false });
      setStatus("Captura encerrada.");
    });
  });

  setStatus(`Captura ativa: ${sourceLabel}. Auto Pilot ligado (drop, cor e intensidade).`);
  scheduleFrame();
}

async function captureDesktopAudio() {
  if (!navigator.mediaDevices?.getDisplayMedia) {
    setStatus("Seu navegador nao suporta captura de audio por compartilhamento.", true);
    return;
  }

  try {
    stopAnimationAndAudio({ stopTracks: true });

    let stream;
    try {
      stream = await navigator.mediaDevices.getDisplayMedia({
        video: true,
        audio: {
          autoGainControl: false,
          echoCancellation: false,
          noiseSuppression: false,
        },
        systemAudio: "include",
      });
    } catch (error) {
      if (error instanceof TypeError) {
        stream = await navigator.mediaDevices.getDisplayMedia({
          video: true,
          audio: {
            autoGainControl: false,
            echoCancellation: false,
            noiseSuppression: false,
          },
        });
      } else {
        throw error;
      }
    }

    await attachStream(stream, "Desktop/Aba");
  } catch (error) {
    const message = error instanceof Error ? error.message : "Erro desconhecido";
    setStatus(`Falha ao iniciar captura: ${message}`, true);
  }
}

function togglePause() {
  if (!state.running) {
    setStatus("Inicie uma captura primeiro.");
    return;
  }
  state.paused = !state.paused;
  pauseBtn.textContent = state.paused ? "Retomar" : "Pausar";
  if (!state.paused) {
    cancelFrameLoop();
    scheduleFrame();
  } else {
    cancelFrameLoop();
  }
}

async function toggleFullscreen() {
  try {
    if (!document.fullscreenElement) await document.documentElement.requestFullscreen();
    else await document.exitFullscreen();
  } catch {
    setStatus("Nao foi possivel alternar tela cheia.", true);
  }
}

captureBtn.addEventListener("click", captureDesktopAudio);
pauseBtn.addEventListener("click", togglePause);
stopBtn.addEventListener("click", () => {
  stopAnimationAndAudio({ stopTracks: true });
  setStatus("Captura parada.");
});
fullscreenBtn.addEventListener("click", toggleFullscreen);
popupBtn.addEventListener("click", openPopupWindow);
toggleUiBtn.addEventListener("click", () => {
  setUiHidden(!state.uiHidden);
  if (state.uiHidden) setStatus("UI oculta. Pressione H para mostrar.");
});

modeSelect.addEventListener("change", (event) => {
  const now = performance.now();
  const nextMode = event.target.value;
  state.autoMode = "off";
  autoModeSelect.value = "off";
  applyManualModeProfile(nextMode);
  setModeWithBlend(nextMode, now, 720);
  state.lastModeSwitchAt = now;
  state.lastAdaptiveSwitchAt = now;
  setStatus(`Teste manual: ${nextMode.toUpperCase()} | Auto modo OFF`);
});
colorModeSelect.addEventListener("change", (event) => {
  state.colorMode = event.target.value;
  state.targetPalette = randomPsyPalette();
  state.nextPaletteShiftAt = performance.now() + randomBetween(800, 2200);
});
sensitivityInput.addEventListener("input", (event) => {
  state.sensitivity = Number(event.target.value);
  if (state.smartMix !== "on") state.liveSensitivity = state.sensitivity;
});
smoothingInput.addEventListener("input", (event) => {
  state.smoothing = Number(event.target.value);
  if (state.analyser) state.analyser.smoothingTimeConstant = state.smoothing;
});
impactInput.addEventListener("input", (event) => {
  state.impact = Number(event.target.value);
  if (state.smartMix !== "on") state.liveImpact = state.impact;
});
trailInput.addEventListener("input", (event) => {
  state.trail = Number(event.target.value);
  if (state.smartMix !== "on") state.liveTrail = state.trail;
});
autoModeSelect.addEventListener("change", (event) => {
  state.autoMode = event.target.value;
  state.lastModeSwitchAt = performance.now();
  state.lastAdaptiveSwitchAt = performance.now();
});
smartMixSelect.addEventListener("change", (event) => {
  state.smartMix = event.target.value;
  if (state.smartMix !== "on") {
    state.liveSensitivity = state.sensitivity;
    state.liveImpact = state.impact;
    state.liveTrail = state.trail;
    setStatus("Mix inteligente: OFF");
  } else {
    setStatus("Mix inteligente: ON");
  }
});
dropBoostInput.addEventListener("input", (event) => {
  state.dropBoost = Number(event.target.value);
});
fxSelect.addEventListener("change", (event) => {
  state.fx = event.target.value;
});

window.addEventListener("resize", resizeCanvas);
window.addEventListener("beforeunload", () => {
  stopAnimationAndAudio({ stopTracks: true });
  if (state.popupWindow && !state.popupWindow.closed) {
    state.popupWindow.close();
  }
});
window.addEventListener("keydown", (event) => {
  if (event.key.toLowerCase() === "h") {
    setUiHidden(!state.uiHidden);
  }
  if (event.key === "Escape" && state.uiHidden) {
    setUiHidden(false);
  }
});

initColorEngine(true);
setStatus("Pronto. Cores psicodelicas automaticas ativas.");
updateAutoHud();
resizeCanvas();

