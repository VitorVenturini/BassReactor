import { app, BrowserWindow, desktopCapturer, globalShortcut, ipcMain, session } from "electron";
import path from "node:path";
import { fileURLToPath } from "node:url";

const VISUAL_SHORTCUT_EVENT = "bass-reactor:visual-shortcut";
const VISUAL_SHORTCUT_REQUEST = "bass-reactor:trigger-visual-shortcut";
const RANDOM_VISUAL_EVENT = "bass-reactor:random-visual";
const RANDOM_VISUAL_REQUEST = "bass-reactor:trigger-random-visual";
const OPEN_MAPPER_POPUP_REQUEST = "bass-reactor:open-mapper-popup";
const CLOSE_MAPPER_POPUP_REQUEST = "bass-reactor:close-mapper-popup";
const LIST_DESKTOP_CAPTURE_SOURCES_REQUEST = "bass-reactor:list-desktop-capture-sources";
const SET_DESKTOP_CAPTURE_SOURCE_REQUEST = "bass-reactor:set-desktop-capture-source";
const RELOAD_ALL_WINDOWS_REQUEST = "bass-reactor:reload-all-windows";
const GLOBAL_VISUAL_SHORTCUTS = [
  { accelerator: "NumDiv", family: "random" },
  { accelerator: "CommandOrControl+Q", family: "random" },
  { accelerator: "Alt+Q", family: "random" },
  { accelerator: "Alt+W", family: "kaleido" },
  { accelerator: "Alt+E", family: "black-hole" },
  { accelerator: "Alt+Shift+E", family: "style-ascii" },
  { accelerator: "Alt+T", family: "color-backdrop-filter" },
  { accelerator: "Alt+Y", family: "cell-microscope" },
  { accelerator: "Alt+U", family: "ink-mix" },
  { accelerator: "Alt+I", family: "motion-twin" },
  { accelerator: "Alt+O", family: "bubble-build" },
  { accelerator: "Alt+X", family: "next-order" },
  { accelerator: "Alt+Enter", family: "quality-performance" },
  { accelerator: "Control+Up", family: "style-prev" },
  { accelerator: "Control+Down", family: "style-next" },
];

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const isDev = Boolean(process.env.VITE_DEV_SERVER_URL);
let preferredDesktopCaptureSourceId = "";

function isBrokenPipeError(error) {
  return Boolean(error && typeof error === "object" && "code" in error && error.code === "EPIPE");
}

function guardConsoleStream(stream) {
  if (!stream || typeof stream.on !== "function") return;

  stream.on("error", (error) => {
    if (isBrokenPipeError(error)) {
      return;
    }
    setImmediate(() => {
      throw error;
    });
  });
}

function canWriteToStream(stream) {
  return Boolean(stream?.writable && !stream.destroyed && !stream.writableEnded);
}

function writeConsole(method, args) {
  const targetStream = method === "warn" || method === "error" ? process.stderr : process.stdout;
  if (!canWriteToStream(targetStream)) return;

  try {
    console[method](...args);
  } catch (error) {
    if (!isBrokenPipeError(error)) {
      throw error;
    }
  }
}

function safeLog(...args) {
  writeConsole("log", args);
}

function safeWarn(...args) {
  writeConsole("warn", args);
}

function safeError(...args) {
  writeConsole("error", args);
}

guardConsoleStream(process.stdout);
guardConsoleStream(process.stderr);

function wait(ms) {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

function inferDesktopCaptureKind(sourceId = "") {
  return String(sourceId).startsWith("window:") ? "window" : "screen";
}

async function getDesktopCaptureSources() {
  const sources = await desktopCapturer.getSources({
    types: ["window", "screen"],
    fetchWindowIcons: false,
    thumbnailSize: {
      width: 16,
      height: 16,
    },
  });

  return sources
    .map((source, index) => {
      const kind = inferDesktopCaptureKind(source.id);
      const fallbackName = kind === "screen" ? `Tela ${index + 1}` : `Janela ${index + 1}`;
      const name = source.name || fallbackName;
      return {
        id: source.id,
        name,
        kind,
        label: kind === "screen" ? `Tela · ${name}` : `Aplicativo · ${name}`,
      };
    })
    .sort((left, right) => {
      if (left.kind === right.kind) {
        return left.name.localeCompare(right.name, "pt-BR");
      }
      return left.kind === "screen" ? -1 : 1;
    });
}

function pickDesktopCaptureSource(sources) {
  if (!Array.isArray(sources) || !sources.length) return null;

  if (preferredDesktopCaptureSourceId) {
    const preferredSource = sources.find((source) => source.id === preferredDesktopCaptureSourceId);
    if (preferredSource) return preferredSource;
  }

  return sources.find((source) => inferDesktopCaptureKind(source.id) === "screen") || sources[0] || null;
}

function getMainEntry() {
  if (isDev) {
    return new URL("/vue.html", process.env.VITE_DEV_SERVER_URL).toString();
  }
  return path.join(__dirname, "..", "dist", "vue.html");
}

function getMapperPopupEntry() {
  if (isDev) {
    return new URL("/vue-mapper-popup.html", process.env.VITE_DEV_SERVER_URL).toString();
  }
  return path.join(__dirname, "..", "dist", "vue-mapper-popup.html");
}

function createWindowOptions() {
  return {
    width: 1440,
    height: 900,
    minWidth: 960,
    minHeight: 620,
    autoHideMenuBar: true,
    backgroundColor: "#02040a",
    webPreferences: {
      preload: path.join(__dirname, "preload.mjs"),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false,
      backgroundThrottling: false,
    },
  };
}

async function loadWindowEntry(browserWindow, entryResolver) {
  const maxAttempts = isDev ? 30 : 1;

  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    try {
      if (isDev) {
        await browserWindow.loadURL(entryResolver());
      } else {
        await browserWindow.loadFile(entryResolver());
      }
      return;
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error || "");
      const shouldRetry = isDev && message.includes("ERR_CONNECTION_REFUSED") && attempt < maxAttempts;
      if (!shouldRetry) {
        throw error;
      }
      safeWarn(`[BassReactor] Dev server ainda indisponivel, tentativa ${attempt}/${maxAttempts}.`);
      await wait(1000);
    }
  }
}

function createMainWindow() {
  const mainWindow = new BrowserWindow(createWindowOptions());

  mainWindow.webContents.setWindowOpenHandler(() => {
    return { action: "deny" };
  });

  if (isDev) {
    mainWindow.webContents.on("console-message", (_event, level, message, line, sourceId) => {
      safeLog(`[BassReactor][renderer:${level}] ${message} (${sourceId}:${line})`);
    });
    mainWindow.webContents.on("did-fail-load", (_event, errorCode, errorDescription, validatedURL) => {
      safeError(`[BassReactor] Renderer falhou ao carregar ${validatedURL}: ${errorCode} ${errorDescription}`);
    });
    mainWindow.webContents.on("render-process-gone", (_event, details) => {
      safeError("[BassReactor] Renderer encerrou:", details);
    });
    mainWindow.webContents.on("did-finish-load", () => {
      safeLog("[BassReactor] Renderer carregado.");
    });
  }

  loadWindowEntry(mainWindow, getMainEntry).catch((error) => {
    safeError("[BassReactor] Falha ao abrir a janela principal:", error);
  });

  return mainWindow;
}

let mapperPopupWindow = null;

function createMapperPopupWindow() {
  if (mapperPopupWindow && !mapperPopupWindow.isDestroyed()) {
    mapperPopupWindow.focus();
    return mapperPopupWindow;
  }

  mapperPopupWindow = new BrowserWindow({
    width: 440,
    height: 900,
    minWidth: 360,
    minHeight: 520,
    autoHideMenuBar: true,
    backgroundColor: "#02040a",
    title: "Bass Reactor Mapper",
    webPreferences: {
      preload: path.join(__dirname, "preload.mjs"),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false,
      backgroundThrottling: false,
    },
  });

  loadWindowEntry(mapperPopupWindow, getMapperPopupEntry).catch((error) => {
    safeError("[BassReactor] Falha ao abrir o popup do mapper:", error);
  });

  mapperPopupWindow.on("closed", () => {
    mapperPopupWindow = null;
  });

  return mapperPopupWindow;
}

function closeMapperPopupWindow() {
  if (!mapperPopupWindow || mapperPopupWindow.isDestroyed()) {
    mapperPopupWindow = null;
    return;
  }
  mapperPopupWindow.close();
  mapperPopupWindow = null;
}

function configureDesktopCapture() {
  const defaultSession = session.defaultSession;

  defaultSession.setPermissionRequestHandler((_webContents, permission, callback) => {
    if (permission === "display-capture" || permission === "media") {
      callback(true);
      return;
    }
    callback(false);
  });

  defaultSession.setDisplayMediaRequestHandler(
    async (_request, callback) => {
      try {
        const sources = await desktopCapturer.getSources({
          types: ["window", "screen"],
          fetchWindowIcons: false,
          thumbnailSize: {
            width: 16,
            height: 16,
          },
        });
        const source = pickDesktopCaptureSource(sources);
        if (!source) {
          callback({});
          return;
        }
        callback({
          video: source,
          audio: "loopback",
        });
      } catch (error) {
        safeError("[BassReactor] Falha ao configurar captura de desktop:", error);
        callback({});
      }
    },
    { useSystemPicker: false }
  );
}

function broadcastVisualShortcut(family, source) {
  const safeFamily = typeof family === "string" && family ? family : "random";
  const payload = {
    family: safeFamily,
    source,
    at: Date.now(),
  };

  for (const win of BrowserWindow.getAllWindows()) {
    if (win.isDestroyed()) continue;
    win.webContents.send(VISUAL_SHORTCUT_EVENT, payload);
    // Compatibilidade para listeners antigos.
    if (safeFamily === "random") {
      win.webContents.send(RANDOM_VISUAL_EVENT, payload);
    }
  }
}

function reloadAllWindows() {
  for (const win of BrowserWindow.getAllWindows()) {
    if (win.isDestroyed()) continue;
    win.webContents.reload();
  }
}

function registerGlobalShortcuts() {
  for (const shortcut of GLOBAL_VISUAL_SHORTCUTS) {
    const accelerator = shortcut.accelerator;
    const ok = globalShortcut.register(accelerator, () => {
      broadcastVisualShortcut(shortcut.family, "global-shortcut");
    });
    if (!ok) {
      safeWarn(`[BassReactor] Falha ao registrar atalho global: ${accelerator}`);
    }
  }
}

ipcMain.on(VISUAL_SHORTCUT_REQUEST, (_event, payload) => {
  const family = payload?.family;
  broadcastVisualShortcut(family, "ipc");
});

ipcMain.on(RANDOM_VISUAL_REQUEST, () => {
  broadcastVisualShortcut("random", "ipc-legacy");
});

ipcMain.on(OPEN_MAPPER_POPUP_REQUEST, () => {
  createMapperPopupWindow();
});

ipcMain.on(CLOSE_MAPPER_POPUP_REQUEST, () => {
  closeMapperPopupWindow();
});

ipcMain.on(RELOAD_ALL_WINDOWS_REQUEST, () => {
  reloadAllWindows();
});

ipcMain.handle(LIST_DESKTOP_CAPTURE_SOURCES_REQUEST, async () => {
  try {
    return await getDesktopCaptureSources();
  } catch (error) {
    safeError("[BassReactor] Falha ao listar fontes de captura:", error);
    return [];
  }
});

ipcMain.handle(SET_DESKTOP_CAPTURE_SOURCE_REQUEST, async (_event, payload) => {
  preferredDesktopCaptureSourceId = typeof payload?.sourceId === "string" ? payload.sourceId : "";
  return {
    ok: true,
    sourceId: preferredDesktopCaptureSourceId,
  };
});

app.whenReady().then(() => {
  configureDesktopCapture();
  createMainWindow();
  registerGlobalShortcuts();

  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createMainWindow();
    }
  });
});

app.on("will-quit", () => {
  globalShortcut.unregisterAll();
});
