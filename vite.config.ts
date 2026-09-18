// @lovable.dev/vite-tanstack-config already includes the following — do NOT add them manually
// or the app will break with duplicate plugins:
//   - tanstackStart, viteReact, tailwindcss, tsConfigPaths, cloudflare (build-only),
//     componentTagger (dev-only), VITE_* env injection, @ path alias, React/TanStack dedupe,
//     error logger plugins, and sandbox detection (port/host/strictPort).
// You can pass additional config via defineConfig({ vite: { ... } }) if needed.
import { defineConfig } from "@lovable.dev/vite-tanstack-config";

if (process.env.NODE_ENV !== "production") {
  process.env.NODE_TLS_REJECT_UNAUTHORIZED = "0";
}

const supabaseTarget =
  (process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL || "http://supabasekong-8o3ujqb0d63iyf3cic4ftk33.200.234.47.192.sslip.io").replace(/^https:/, "http:");

export default defineConfig({
  vite: {
    server: {
      proxy: {
        "/supabase-api": {
          target: supabaseTarget,
          changeOrigin: true,
          secure: false,
          ws: true,
          rewrite: (path) => path.replace(/^\/supabase-api/, ""),
        },
      },
    },
  },
});

