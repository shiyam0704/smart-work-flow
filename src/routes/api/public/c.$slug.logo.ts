import { createFileRoute } from "@tanstack/react-router";
import { createClient } from "@supabase/supabase-js";

// Public, stable logo URL for a tenant. Consumers (og:image, favicon,
// manifest icons, sidebar/topbar) all point to /api/public/c/{slug}/logo
// so cached previews stay valid across logo changes.
export const Route = createFileRoute("/api/public/c/$slug/logo")({
  server: {
    handlers: {
      GET: async ({ params }) => {
        const slug = params.slug;
        try {
          const supaUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || "";
          const serviceKey =
            process.env.SUPABASE_SERVICE_ROLE_KEY ||
            process.env.VITE_SUPABASE_SERVICE_ROLE_KEY ||
            process.env.SUPABASE_PUBLISHABLE_KEY ||
            process.env.VITE_SUPABASE_PUBLISHABLE_KEY ||
            "";
          const admin = createClient(
            supaUrl,
            serviceKey,
            { auth: { persistSession: false, autoRefreshToken: false } },
          );
          const { data: company } = await admin
            .from("companies")
            .select("logo_url")
            .eq("slug", slug)
            .maybeSingle();
          const raw = (company?.logo_url ?? "").trim();
          if (!raw) return notFound();

          // http(s) URL → redirect
          if (/^https?:\/\//i.test(raw)) {
            return new Response(null, {
              status: 302,
              headers: { Location: raw, "Cache-Control": "public, max-age=300" },
            });
          }

          // data: URL → decode and serve bytes
          if (raw.startsWith("data:")) {
            const m = /^data:([^;,]+)(;base64)?,(.*)$/s.exec(raw);
            if (!m) return notFound();
            const mime = m[1] || "application/octet-stream";
            const isB64 = !!m[2];
            const body = isB64
              ? Buffer.from(m[3], "base64")
              : Buffer.from(decodeURIComponent(m[3]), "utf8");
            return new Response(body, {
              status: 200,
              headers: {
                "Content-Type": mime,
                "Cache-Control": "public, max-age=300",
              },
            });
          }

          // Otherwise treat as storage path inside the company-logos bucket
          const path = raw.replace(/^company-logos\//, "");
          const { data: file, error } = await admin.storage
            .from("company-logos")
            .download(path);
          if (error || !file) return notFound();
          const buf = Buffer.from(await file.arrayBuffer());
          return new Response(buf, {
            status: 200,
            headers: {
              "Content-Type": file.type || "image/png",
              "Cache-Control": "public, max-age=300",
            },
          });
        } catch {
          return notFound();
        }
      },
    },
  },
});

function notFound() {
  return new Response("Not found", { status: 404 });
}