import { defineConfig } from "@lovable.dev/vite-tanstack-config";

export default defineConfig({
  vite: {
    optimizeDeps: {
      exclude: ["@ffmpeg/ffmpeg", "@ffmpeg/util"],
    },
    build: {
      target: "esnext",
      cssCodeSplit: true,
      chunkSizeWarningLimit: 800,
      rollupOptions: {
        output: {
          manualChunks: (id) => {
            if (id.includes("node_modules")) {
              if (id.includes("recharts")) return "vendor-charts";
              if (id.includes("jszip")) return "vendor-zip";
              if (id.includes("@supabase")) return "vendor-supabase";
              if (id.includes("@radix-ui") || id.includes("lucide-react")) return "vendor-ui";
            }
            return undefined;
          },
        },
      },
    },
  },
  tanstackStart: {
    server: { entry: "server" },
  },
});
