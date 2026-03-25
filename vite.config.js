import { resolve } from "node:path";
import { defineConfig } from "vite";
import { createSageConfig } from "@wearesage/vue/vite";

export default defineConfig(async () => {
  const baseConfig = await createSageConfig();

  return {
    ...baseConfig,
    base: "./",
    resolve: {
      ...(baseConfig.resolve || {}),
      alias: {
        ...((baseConfig.resolve && baseConfig.resolve.alias) || {}),
        debug: resolve(__dirname, "src/shims/debug.js"),
      },
    },
    build: {
      ...(baseConfig.build || {}),
      rollupOptions: {
        ...((baseConfig.build && baseConfig.build.rollupOptions) || {}),
        input: {
          home: resolve(__dirname, "index.html"),
          legacy: resolve(__dirname, "legacy.html"),
          vue: resolve(__dirname, "vue.html"),
          vuePopup: resolve(__dirname, "vue-popup.html"),
          vueMapperPopup: resolve(__dirname, "vue-mapper-popup.html"),
        },
      },
    },
  };
});
