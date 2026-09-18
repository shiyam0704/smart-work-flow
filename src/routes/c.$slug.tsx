import { createFileRoute, Outlet } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";

function hashString(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0;
  return h;
}

export const Route = createFileRoute("/c/$slug")({
  component: () => <Outlet />,
  loader: async ({ params }) => {
    const { data } = await supabase.rpc("get_company_branding" as any, { _slug: params.slug });
    const b = Array.isArray(data) ? (data[0] as any) : null;
    const rawLogo = (b?.logo_url as string) || null;
    // Stable, crawler-friendly URL. A short version tag busts client/CDN
    // caches when the underlying logo changes, without changing the URL
    // shape that social crawlers already have cached.
    const version = rawLogo
      ? Math.abs(hashString(rawLogo)).toString(36).slice(0, 8)
      : null;
    const logoProxyPath = rawLogo
      ? `/api/public/c/${params.slug}/logo?v=${version}`
      : null;
    return {
      slug: params.slug,
      name: (b?.name as string) ?? params.slug,
      logoUrl: logoProxyPath,
      logoRaw: rawLogo,
    };
  },
  head: ({ params, loaderData }) => {
    const name = loaderData?.name ?? params.slug;
    const logo = loaderData?.logoUrl ?? null;
    const manifestHref = `/api/public/c/${params.slug}/manifest.webmanifest`;
    const meta = [
      { title: `${name} — Sign in` },
      { name: "apple-mobile-web-app-title", content: name },
      { name: "application-name", content: name },
      { name: "theme-color", content: "#0f172a" },
      { property: "og:title", content: name },
      ...(logo ? [{ property: "og:image", content: logo }] : []),
    ];
    const links = [
      { rel: "manifest", href: manifestHref },
      ...(logo
        ? [
            { rel: "icon", href: logo },
            { rel: "apple-touch-icon", href: logo },
          ]
        : []),
    ];
    return { meta, links };
  },
});