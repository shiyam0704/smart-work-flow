import { createFileRoute } from "@tanstack/react-router";
import { createClient } from "@supabase/supabase-js";

export const Route = createFileRoute("/api/public/c/$slug/manifest.webmanifest")({
  server: {
    handlers: {
      GET: async ({ params, request }) => {
        const slug = params.slug;
        const origin = new URL(request.url).origin;

        const toAbsolute = (url: string): string => {
          if (/^(https?:|data:)/i.test(url)) return url;
          if (url.startsWith("/")) return `${origin}${url}`;
          return `${origin}/${url}`;
        };

        const mimeFromUrl = (url: string): string | undefined => {
          const clean = url.split("?")[0].split("#")[0].toLowerCase();
          if (clean.endsWith(".png")) return "image/png";
          if (clean.endsWith(".jpg") || clean.endsWith(".jpeg")) return "image/jpeg";
          if (clean.endsWith(".webp")) return "image/webp";
          if (clean.endsWith(".svg")) return "image/svg+xml";
          if (clean.endsWith(".gif")) return "image/gif";
          if (clean.startsWith("data:image/png")) return "image/png";
          if (clean.startsWith("data:image/jpeg")) return "image/jpeg";
          if (clean.startsWith("data:image/webp")) return "image/webp";
          if (clean.startsWith("data:image/svg")) return "image/svg+xml";
          return undefined;
        };

        let name = "Smart Work Flow";
        let hasLogo = false;

        try {
          const supabase = createClient(
            process.env.SUPABASE_URL!,
            process.env.SUPABASE_PUBLISHABLE_KEY!,
            { auth: { persistSession: false, autoRefreshToken: false } },
          );
          const { data } = await supabase.rpc("get_company_branding", { _slug: slug });
          const branding = Array.isArray(data) ? data[0] : null;
          if (branding?.name) name = branding.name as string;
          if (branding?.logo_url) hasLogo = true;
        } catch {
          // fall through to defaults
        }

        const maskableFallback = {
          src: `${origin}/icon-maskable-512.png`,
          sizes: "512x512",
          type: "image/png",
          purpose: "maskable",
        };

        let icons: Array<Record<string, string>>;
        if (hasLogo) {
          icons = [
            {
              src: `${origin}/api/public/c/${slug}/logo`,
              sizes: "any",
              purpose: "any",
            },
            maskableFallback,
          ];
        } else {
          icons = [
            { src: `${origin}/icon-192.png`, sizes: "192x192", type: "image/png", purpose: "any" },
            { src: `${origin}/icon-512.png`, sizes: "512x512", type: "image/png", purpose: "any" },
            maskableFallback,
          ];
        }

        const manifest = {
          name,
          short_name: name.length > 12 ? name.slice(0, 12) : name,
          description: `${name} — company workspace`,
          start_url: `/c/${slug}/auth`,
          scope: `/c/${slug}/`,
          id: `/c/${slug}`,
          display: "standalone",
          orientation: "portrait",
          background_color: "#0f172a",
          theme_color: "#0f172a",
          icons,
        };

        return new Response(JSON.stringify(manifest), {
          status: 200,
          headers: {
            "Content-Type": "application/manifest+json; charset=utf-8",
            "Cache-Control": "public, max-age=300",
          },
        });
      },
    },
  },
});