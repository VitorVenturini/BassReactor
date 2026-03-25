import { app, BrowserWindow, desktopCapturer, globalShortcut, ipcMain, session } from "electron";
import path from "node:path";
import { fileURLToPath } from "node:url";

const VISUAL_SHORTCUT_EVENT = "bass-reactor:visual-shortcut";
const VISUAL_SHORTCUT_REQUEST = "bass-reactor:trigger-visual-shortcut";
const RANDOM_VISUAL_EVENT = "bass-reactor:random-visual";
const RANDOM_VISUAL_REQUEST = "bass-reactor:trigger-random-visual";
const OPEN_MAPPER_POPUP_REQUEST = "bass-reactor:open-mapper-popup";
const CLOSE_MAPPER_POPUP_REQUEST = "bass-reactor:close-mapper-popup";
const GLOBAL_VISUAL_SHORTCUTS = [
  { accelerator: "NumDiv", family: "random" },
  { accelerator: "CommandOrControl+Q", family: "random" },
  { accelerator: "Alt+Q", family: "random" },
  { accelerator: "Alt+W", family: "kaleido" },
  { accelerator: "Alt+E", family: "black-hole" },
  { accelerator: "Alt+T", family: "color-backdrop-filter" },
  { accelerator: "Alt+Y", family: "cell-microscope" },
  { accelerator: "Alt+U", family: "ink-mix" },
  { accelerator: "Alt+I", family: "motion-twin" },
  { accelerator: "Alt+O", family: "bubble-build" },
  { accelerator: "Alt+X", family: "next-order" },
];

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const isDev = Boolean(process.env.VITE_DEV_SERVER_URL);

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
    },
  };
}

function createMainWindow() {
  const mainWindow = new BrowserWindow(createWindowOptions());

  mainWindow.webContents.setWindowOpenHandler(() => {
    return { action: "deny" };
  });

  if (isDev) {
    mainWindow.loadURL(getMainEntry());
  } else {
    mainWindow.loadFile(getMainEntry());
  }

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
    },
  });

  if (isDev) {
    mapperPopupWindow.loadURL(getMapperPopupEntry());
  } else {
    mapperPopupWindow.loadFile(getMapperPopupEntry());
  }

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
        const sources = await desktopCapturer.getSources({ types: ["screen"] });
        const source = sources[0];
        if (!source) {
          callback({});
          return;
        }
        callback({
          video: source,
          audio: "loopback",
        });
      } catch (error) {
        console.error("[BassReactor] Falha ao configurar captura de desktop:", error);
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

function registerGlobalShortcuts() {
  for (const shortcut of GLOBAL_VISUAL_SHORTCUTS) {
    const accelerator = shortcut.accelerator;
    const ok = globalShortcut.register(accelerator, () => {
      broadcastVisualShortcut(shortcut.family, "global-shortcut");
    });
    if (!ok) {
      console.warn(`[BassReactor] Falha ao registrar atalho global: ${accelerator}`);
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
