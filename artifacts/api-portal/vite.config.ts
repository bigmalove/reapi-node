import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import path from "path";
import runtimeErrorOverlay from "@replit/vite-plugin-runtime-error-modal";

const isBuild = process.argv.includes("build");

const rawPort = process.env.PORT;

if (!rawPort && !isBuild) {
  throw new Error(
    "PORT environment variable is required but was not provided.",
  );
}

const port = rawPort ? Number(rawPort) : 0;

if (rawPort && (Number.isNaN(port) || port <= 0)) {
  throw new Error(`Invalid PORT value: "${rawPort}"`);
}

const basePath = process.env.BASE_PATH ?? "/";

if (!process.env.BASE_PATH && !isBuild) {
  throw new Error(
    "BASE_PATH environment variable is required but was not provided.",
  );
}

// API Server 监听端口；门户的 /api、/modelfarm 请求会被代理到这里。
// 默认 8080，与 artifacts/api-server/.replit-artifact/artifact.toml 保持一致。
const apiServerPort = Number(process.env.API_SERVER_PORT ?? "8080");

if (Number.isNaN(apiServerPort) || apiServerPort <= 0) {
  throw new Error(
    `Invalid API_SERVER_PORT value: "${process.env.API_SERVER_PORT}"`,
  );
}

const apiServerTarget = `http://localhost:${apiServerPort}`;

export default defineConfig({
  base: basePath,
  plugins: [
    react(),
    tailwindcss(),
    runtimeErrorOverlay(),
    ...(process.env.NODE_ENV !== "production" &&
    process.env.REPL_ID !== undefined
      ? [
          await import("@replit/vite-plugin-cartographer").then((m) =>
            m.cartographer({
              root: path.resolve(import.meta.dirname, ".."),
            }),
          ),
          await import("@replit/vite-plugin-dev-banner").then((m) =>
            m.devBanner(),
          ),
        ]
      : []),
  ],
  resolve: {
    alias: {
      "@": path.resolve(import.meta.dirname, "src"),
      "@assets": path.resolve(import.meta.dirname, "..", "..", "attached_assets"),
    },
    dedupe: ["react", "react-dom"],
  },
  root: path.resolve(import.meta.dirname),
  build: {
    outDir: path.resolve(import.meta.dirname, "dist/public"),
    emptyOutDir: true,
  },
  server: {
    port,
    host: "0.0.0.0",
    allowedHosts: true,
    fs: {
      strict: true,
      deny: ["**/.*"],
    },
    // 开发环境必须把跨服务前缀代理到 API Server。
    // 否则 Vite 会按 SPA 默认行为返回 index.html，前端 res.json() 会抛
    // "Unexpected token '<', \"<!DOCTYPE \"... is not valid JSON"。
    // 新增任何由 API Server 处理的前缀（例如 /api、/modelfarm）时，都要在这里同步加上。
    proxy: {
      "/api": apiServerTarget,
      "/modelfarm": apiServerTarget,
    },
  },
  preview: {
    port,
    host: "0.0.0.0",
    allowedHosts: true,
  },
});
