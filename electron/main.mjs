import { app, BrowserWindow, desktopCapturer, globalShortcut, ipcMain, session } from "electron";
import path from "node:path";
import { fileURLToPath } from "node:url";

const RANDOM_VISUAL_EVENT = "bass-reactor:random-visual";
const RANDOM_VISUAL_REQUEST = "bass-reactor:trigger-random-visual";
const GLOBAL_RANDOM_ACCELERATORS = ["NumDiv", "CommandOrControl+Q"];

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const isDev = Boolean(process.env.VITE_DEV_SERVER_URL);

function getMainEntry() {
  if (isDev) {
    return new URL("/vue.html", process.env.VITE_DEV_SERVER_URL).toString();
  }
  return path.join(__dirname, "..", "dist", "vue.html");
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

function broadcastRandomVisual(source) {
  for (const win of BrowserWindow.getAllWindows()) {
    if (win.isDestroyed()) continue;
    win.webContents.send(RANDOM_VISUAL_EVENT, {
      source,
      at: Date.now(),
    });
  }
}

function registerGlobalShortcuts() {
  for (const accelerator of GLOBAL_RANDOM_ACCELERATORS) {
    const ok = globalShortcut.register(accelerator, () => {
      broadcastRandomVisual("global-shortcut");
    });
    if (!ok) {
      console.warn(`[BassReactor] Falha ao registrar atalho global: ${accelerator}`);
    }
  }
}

ipcMain.on(RANDOM_VISUAL_REQUEST, () => {
  broadcastRandomVisual("ipc");
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
