const { spawn } = require("node:child_process");
const path = require("node:path");

const electronPath = require("electron");
const projectRoot = path.resolve(__dirname, "..");

const env = {
  ...process.env,
  VITE_DEV_SERVER_URL: process.env.VITE_DEV_SERVER_URL || "http://127.0.0.1:5173",
};

delete env.ELECTRON_RUN_AS_NODE;

const child = spawn(electronPath, ["."], {
  cwd: projectRoot,
  env,
  stdio: "inherit",
  windowsHide: false,
});

child.on("close", (code) => {
  process.exit(code ?? 0);
});

