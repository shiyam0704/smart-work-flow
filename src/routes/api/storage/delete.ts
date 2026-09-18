import { createFileRoute } from "@tanstack/react-router";
import { createClient } from "@supabase/supabase-js";

export const Route = createFileRoute("/api/storage/delete")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        try {
          const authHeader = request.headers.get("Authorization") || "";
          const token = authHeader.replace(/^Bearer\s+/i, "").trim();

          const supaUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || "";
          const serviceKey =
            process.env.SUPABASE_SERVICE_ROLE_KEY ||
            process.env.VITE_SUPABASE_SERVICE_ROLE_KEY ||
            "";

          if (!supaUrl || !serviceKey) {
            return new Response(JSON.stringify({ error: "Storage service not configured" }), {
              status: 500,
              headers: { "Content-Type": "application/json" },
            });
          }

          const admin = createClient(supaUrl, serviceKey, {
            auth: { persistSession: false, autoRefreshToken: false },
          });

          // Verify user authorization via token
          if (token) {
            const { data: userData, error: userErr } = await admin.auth.getUser(token);
            if (userErr || !userData.user) {
              return new Response(JSON.stringify({ error: "Unauthorized" }), {
                status: 401,
                headers: { "Content-Type": "application/json" },
              });
            }
          }

          const body = (await request.json().catch(() => ({}))) as {
            bucket?: string;
            paths?: string[];
            path?: string;
          };

          const bucket = body.bucket;
          const paths = body.paths || (body.path ? [body.path] : []);

          if (!bucket || paths.length === 0) {
            return new Response(JSON.stringify({ error: "Invalid request payload" }), {
              status: 400,
              headers: { "Content-Type": "application/json" },
            });
          }

          // Allowed storage buckets for safety
          const allowedBuckets = [
            "project-attachments",
            "task-attachments",
            "lead-attachments",
            "employee-photos",
            "company-logos",
          ];
          if (!allowedBuckets.includes(bucket)) {
            return new Response(JSON.stringify({ error: "Bucket not permitted" }), {
              status: 403,
              headers: { "Content-Type": "application/json" },
            });
          }

          const { data, error } = await admin.storage.from(bucket).remove(paths);
          if (error) {
            return new Response(JSON.stringify({ error: error.message }), {
              status: 500,
              headers: { "Content-Type": "application/json" },
            });
          }

          return new Response(JSON.stringify({ success: true, removed: data }), {
            status: 200,
            headers: { "Content-Type": "application/json" },
          });
        } catch (err: any) {
          return new Response(JSON.stringify({ error: err?.message || "Internal server error" }), {
            status: 500,
            headers: { "Content-Type": "application/json" },
          });
        }
      },
    },
  },
});
