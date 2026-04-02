import { onBeforeUnmount, ref } from "vue";

const AUDIO_ANALYSIS_FRAME_MS = 1000 / 45;

function clamp(value, min = 0, max = 1) {
  return Math.min(max, Math.max(min, value));
}

function roundLevel(value) {
  return Number(value.toFixed(3));
}

export function useDesktopAudio() {
  const streamHandle = ref(null);
  const audioContext = ref(null);
  const analyserNode = ref(null);
  const sourceNode = ref(null);
  const desktopSources = ref([]);
  const inputDevices = ref([]);
  const selectedDesktopSourceId = ref("");
  const selectedInputDeviceId = ref("");
  const sourceMode = ref("desktop");
  const running = ref(false);
  const busy = ref(false);
  const status = ref("Conecte o audio do sistema, de um aplicativo ou de um microfone.");
  const error = ref(false);
  const bass = ref(0);
  const mids = ref(0);
  const highs = ref(0);
  const motionAmount = ref(0);
  const motionStream = ref(0);
  const blink = ref(0);
  const colorIntensity = ref(0);
  let frequencyData = null;
  let lastTickAt = 0;
  let previousBass = 0;
  let previousMids = 0;
  let previousHighs = 0;
  let rafId = 0;

  function isElectronRuntime() {
    return Boolean(window.bassReactorElectron?.isElectron);
  }

  function normalizeDeviceLabel(device, index) {
    if (device?.label) return device.label;
    return `Entrada ${index + 1}`;
  }

  function inferDesktopSourceKind(sourceId = "") {
    return String(sourceId).startsWith("window:") ? "window" : "screen";
  }

  function normalizeDesktopSourceLabel(source, index) {
    const kind = String(source?.kind || inferDesktopSourceKind(source?.id || ""));
    const name = source?.name || (kind === "window" ? `Janela ${index + 1}` : `Tela ${index + 1}`);
    if (source?.label) return source.label;
    return kind === "window" ? `Aplicativo · ${name}` : `Tela · ${name}`;
  }

  async function refreshInputDevices() {
    if (!navigator.mediaDevices?.enumerateDevices) return;

    try {
      const devices = await navigator.mediaDevices.enumerateDevices();
      inputDevices.value = devices
        .filter((device) => device.kind === "audioinput")
        .map((device, index) => ({
          deviceId: device.deviceId,
          label: normalizeDeviceLabel(device, index),
        }));

      if (!selectedInputDeviceId.value && inputDevices.value.length) {
        selectedInputDeviceId.value = inputDevices.value[0].deviceId;
      }
    } catch {
      inputDevices.value = [];
    }
  }

  async function refreshDesktopSources() {
    if (!isElectronRuntime() || typeof window.bassReactorElectron?.listDesktopCaptureSources !== "function") {
      desktopSources.value = [];
      selectedDesktopSourceId.value = "";
      return;
    }

    try {
      const sources = await window.bassReactorElectron.listDesktopCaptureSources();
      desktopSources.value = (Array.isArray(sources) ? sources : [])
        .map((source, index) => ({
          id: String(source?.id || ""),
          kind: String(source?.kind || inferDesktopSourceKind(source?.id || "")),
          name: String(source?.name || ""),
          label: normalizeDesktopSourceLabel(source, index),
        }))
        .filter((source) => source.id);

      if (!desktopSources.value.length) {
        selectedDesktopSourceId.value = "";
        return;
      }

      const hasSelectedSource = desktopSources.value.some((source) => source.id === selectedDesktopSourceId.value);
      if (hasSelectedSource) return;

      const preferredSource = desktopSources.value.find((source) => source.kind === "screen") || desktopSources.value[0];
      selectedDesktopSourceId.value = preferredSource?.id || "";
    } catch {
      desktopSources.value = [];
      selectedDesktopSourceId.value = "";
    }
  }

  function stop(stopTracks = true) {
    cancelTickLoop();

    if (stopTracks && streamHandle.value) {
      streamHandle.value.getTracks().forEach((track) => track.stop());
    }

    if (sourceNode.value) {
      try {
        sourceNode.value.disconnect();
      } catch {}
    }

    if (analyserNode.value) {
      try {
        analyserNode.value.disconnect();
      } catch {}
    }

    if (audioContext.value && audioContext.value.state !== "closed") {
      audioContext.value.close().catch(() => {});
    }

    sourceNode.value = null;
    analyserNode.value = null;
    audioContext.value = null;
    streamHandle.value = null;
    running.value = false;
    bass.value = 0;
    mids.value = 0;
    highs.value = 0;
    motionAmount.value = 0;
    motionStream.value = 0;
    blink.value = 0;
    colorIntensity.value = 0;
    frequencyData = null;
    lastTickAt = 0;
    previousBass = 0;
    previousMids = 0;
    previousHighs = 0;
  }

  function stripUnusedVideoTracks(stream) {
    if (!(stream instanceof MediaStream)) return stream;

    stream.getVideoTracks().forEach((track) => {
      try {
        stream.removeTrack(track);
      } catch {}

      try {
        track.stop();
      } catch {}
    });

    return stream;
  }

  function cancelTickLoop() {
    if (!rafId) return;
    window.cancelAnimationFrame(rafId);
    rafId = 0;
  }

  function scheduleTickLoop() {
    if (rafId || !running.value) return;
    lastTickAt = 0;
    rafId = window.requestAnimationFrame(tick);
  }

  async function connectStream(nextStream, nextMode = "desktop", successStatus = "Captura ativa.") {
    const [audioTrack] = nextStream.getAudioTracks();
    if (!audioTrack) {
      nextStream.getTracks().forEach((track) => track.stop());
      if (nextMode === "desktop") {
        if (isElectronRuntime()) {
          throw new Error("Nenhum audio do sistema foi capturado. Confirme se existe som sendo reproduzido na saida padrao do Windows.");
        }
        throw new Error("Nenhum audio foi compartilhado. Ative 'Compartilhar audio' na janela do navegador.");
      }
      if (nextMode === "application") {
        throw new Error("Nenhum audio foi capturado do aplicativo ou janela selecionada.");
      }
      throw new Error("Nenhum audio foi capturado da entrada selecionada.");
    }

    const ctx = new AudioContext();
    await ctx.resume();

    const nextAnalyser = ctx.createAnalyser();
    nextAnalyser.fftSize = 1024;
    nextAnalyser.smoothingTimeConstant = 0;

    const nextSource = ctx.createMediaStreamSource(nextStream);
    nextSource.connect(nextAnalyser);

    stripUnusedVideoTracks(nextStream);

    streamHandle.value = nextStream;
    audioContext.value = ctx;
    analyserNode.value = nextAnalyser;
    sourceNode.value = nextSource;
    frequencyData = new Uint8Array(nextAnalyser.frequencyBinCount);
    running.value = true;
    sourceMode.value = nextMode;
    status.value = successStatus;

    nextStream.getAudioTracks().forEach((track) => {
      track.addEventListener("ended", () => {
        stop(false);
        status.value = "A captura foi encerrada.";
      });
    });

    scheduleTickLoop();
    await Promise.all([refreshInputDevices(), refreshDesktopSources()]);
  }

  async function connectDesktop(sourceId = "") {
    if (!navigator.mediaDevices?.getDisplayMedia) {
      error.value = true;
      status.value = "Este navegador nao suporta captura de audio do desktop.";
      return;
    }

    busy.value = true;
    error.value = false;
    status.value = "Aguardando permissao de captura...";

    try {
      stop(true);

      const requestedSourceId = String(sourceId || "");
      if (isElectronRuntime() && typeof window.bassReactorElectron?.setDesktopCaptureSource === "function") {
        await window.bassReactorElectron.setDesktopCaptureSource(requestedSourceId);
      }

      const selectedSource =
        desktopSources.value.find((source) => source.id === requestedSourceId) ||
        desktopSources.value.find((source) => source.id === selectedDesktopSourceId.value) ||
        null;
      const captureLabel = selectedSource?.label || "audio do sistema";
      const captureMode = selectedSource?.kind === "window" ? "application" : "desktop";

      let nextStream;
      if (isElectronRuntime()) {
        status.value =
          requestedSourceId && selectedSource
            ? `Capturando audio via ${captureLabel}...`
            : "Capturando audio do sistema via Electron...";
        nextStream = await navigator.mediaDevices.getDisplayMedia({
          video: true,
          audio: true,
        });
      } else {
        try {
          nextStream = await navigator.mediaDevices.getDisplayMedia({
            video: true,
            audio: {
              autoGainControl: false,
              echoCancellation: false,
              noiseSuppression: false,
            },
            systemAudio: "include",
          });
        } catch {
          nextStream = await navigator.mediaDevices.getDisplayMedia({
            video: true,
            audio: true,
          });
        }
      }
      if (requestedSourceId) {
        selectedDesktopSourceId.value = requestedSourceId;
      }
      await connectStream(
        nextStream,
        captureMode,
        captureMode === "application" ? `Captura ativa via ${captureLabel}.` : "Captura ativa. O renderer Vue agora usa o stack visual do Kaleidosync com audio do desktop."
      );
    } catch (caughtError) {
      const message = caughtError instanceof Error ? caughtError.message : "Falha ao iniciar a captura.";
      stop(true);
      error.value = true;
      status.value = message;
    } finally {
      busy.value = false;
    }
  }

  async function connectInputDevice(deviceId = selectedInputDeviceId.value) {
    if (!navigator.mediaDevices?.getUserMedia) {
      error.value = true;
      status.value = "Este navegador nao suporta captura de entrada de audio.";
      return;
    }

    busy.value = true;
    error.value = false;
    status.value = "Conectando entrada de audio...";

    try {
      stop(true);
      const constraints = deviceId
        ? {
            audio: {
              deviceId: { exact: deviceId },
              autoGainControl: false,
              echoCancellation: false,
              noiseSuppression: false,
            },
            video: false,
          }
        : {
            audio: true,
            video: false,
          };

      const nextStream = await navigator.mediaDevices.getUserMedia(constraints);
      selectedInputDeviceId.value = deviceId || "";
      await connectStream(nextStream, "input", "Entrada de audio conectada para alimentar o visualizer.");
    } catch (caughtError) {
      const message = caughtError instanceof Error ? caughtError.message : "Falha ao conectar a entrada de audio.";
      stop(true);
      error.value = true;
      status.value = message;
    } finally {
      busy.value = false;
    }
  }

  function getBandAverage(startHz, endHz) {
    if (!analyserNode.value || !audioContext.value || !frequencyData) return 0;

    const nyquist = audioContext.value.sampleRate / 2;
    const binCount = frequencyData.length;
    const startBin = Math.max(0, Math.floor((startHz / nyquist) * binCount));
    const endBin = Math.min(binCount, Math.ceil((endHz / nyquist) * binCount));
    if (endBin <= startBin) return 0;

    let sum = 0;
    for (let index = startBin; index < endBin; index += 1) {
      sum += frequencyData[index];
    }

    return sum / Math.max(1, endBin - startBin) / 255;
  }

  function tick(now) {
    rafId = 0;
    if (!running.value) return;

    try {
      const frameNow = typeof now === "number" && Number.isFinite(now) ? now : window.performance.now();
      const frameDelta = lastTickAt ? frameNow - lastTickAt : AUDIO_ANALYSIS_FRAME_MS;

      if (frameDelta < AUDIO_ANALYSIS_FRAME_MS * 0.9) {
        rafId = window.requestAnimationFrame(tick);
        return;
      }

      lastTickAt = frameNow;

      if (analyserNode.value && frequencyData) {
        analyserNode.value.getByteFrequencyData(frequencyData);
        bass.value = roundLevel(getBandAverage(20, 160));
        mids.value = roundLevel(getBandAverage(160, 2200));
        highs.value = roundLevel(getBandAverage(2200, 12000));

        const bassAttack = Math.max(0, bass.value - previousBass);
        const midsAttack = Math.max(0, mids.value - previousMids);
        const highsAttack = Math.max(0, highs.value - previousHighs);
        const frameScale = frameDelta / (1000 / 60);
        const nextMotionAmount = clamp(bass.value * 0.56 + bassAttack * 1.08, 0, 0.72);
        const nextBlink = clamp(mids.value * 0.86 + midsAttack * 1.75, 0, 1.15);
        const nextColor = clamp(highs.value * 0.94 + highsAttack * 1.4, 0, 1.2);

        motionAmount.value = roundLevel(clamp(motionAmount.value * 0.72 + nextMotionAmount * 0.28, 0, 0.72));
        motionStream.value = roundLevel(motionStream.value + motionAmount.value * (0.14 + bass.value * 0.42) * frameScale);
        blink.value = roundLevel(clamp(blink.value * 0.48 + nextBlink * 0.72, 0, 1.15));
        colorIntensity.value = roundLevel(clamp(colorIntensity.value * 0.72 + nextColor * 0.4, 0, 1.2));

        previousBass = bass.value;
        previousMids = mids.value;
        previousHighs = highs.value;
      }
    } catch (caughtError) {
      running.value = false;
      error.value = true;
      status.value = caughtError instanceof Error ? caughtError.message : "Falha ao processar o audio do desktop.";
      cancelTickLoop();
      return;
    }

    rafId = window.requestAnimationFrame(tick);
  }

  if (typeof window !== "undefined") {
    refreshInputDevices();
    refreshDesktopSources();
  }

  onBeforeUnmount(() => {
    cancelTickLoop();
    stop(true);
  });

  return {
    bass,
    mids,
    highs,
    motionAmount,
    motionStream,
    blink,
    colorIntensity,
    running,
    busy,
    status,
    error,
    desktopSources,
    inputDevices,
    selectedDesktopSourceId,
    selectedInputDeviceId,
    sourceMode,
    connectDesktop,
    connectInputDevice,
    refreshDesktopSources,
    refreshInputDevices,
    stop,
  };
}
