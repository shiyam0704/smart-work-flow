import { createFileRoute, Outlet, useParams } from "@tanstack/react-router";
import { useCNavigate as useNavigate } from "@/lib/nav";
import { useEffect, useState } from "react";
import { Sidebar } from "@/components/app/Sidebar";
import { BottomNav } from "@/components/app/BottomNav";
import { TaskModalProvider } from "@/components/app/NewTaskModal";
import { ConfirmProvider } from "@/components/app/confirm-dialog";
import { useAuth } from "@/hooks/use-auth";
import { useThemePrefs } from "@/hooks/use-theme-prefs";
import { useAllCompanies } from "@/hooks/use-company";
import { writeActiveCompanyId } from "@/lib/active-company";
import { supabase } from "@/integrations/supabase/client";
import { Sparkles } from "lucide-react";


export const Route = createFileRoute("/c/$slug/_app")({
  component: AppLayout,
});

function AppLayout() {
  const { slug } = useParams({ from: "/c/$slug/_app" });
  const { user, loading, isInactive, isSuperAdmin } = useAuth();
  const { companies, loading: coLoading } = useAllCompanies();
  const company = companies.find((c) => c.slug === slug) ?? null;
  const nav = useNavigate();
  const [urlBranding, setUrlBranding] = useState<null | { id: string; slug: string; status: string }>(null);
  const [brandingLoading, setBrandingLoading] = useState(true);
  useThemePrefs();

  // Resolve the URL slug to a company id via the public branding RPC so we
  // can tell "unknown slug" apart from "known slug I don't belong to".
  useEffect(() => {
    let cancelled = false;
    setBrandingLoading(true);
    (async () => {
      try {
        const { data, error } = await supabase.rpc("get_company_branding", { _slug: slug });
        if (cancelled) return;
        const row = Array.isArray(data) ? data[0] : null;
        if (row) {
          setUrlBranding(row);
        } else {
          const match = companies.find((c) => c.slug === slug);
          setUrlBranding(match ? { id: match.id, slug: match.slug, status: match.status } : null);
        }
      } catch {
        if (cancelled) return;
        const match = companies.find((c) => c.slug === slug);
        setUrlBranding(match ? { id: match.id, slug: match.slug, status: match.status } : null);
      } finally {
        if (!cancelled) setBrandingLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [slug, companies]);

  // Keep the localStorage active-company id in sync with the URL slug so
  // hooks that still key off it (useActiveCompany, useCompanyModules) resolve
  // to the right tenant on every mount.
  useEffect(() => {
    if (company?.id) writeActiveCompanyId(company.id);
  }, [company?.id]);

  useEffect(() => {
    if (loading) return;
    if (!user) {
      nav({ to: "/c/$slug/auth", params: { slug } });
      return;
    }
    if (isSuperAdmin) {
      // Super admin visiting /c/{slug}/* is allowed — sync active company below.
      if (urlBranding?.id) writeActiveCompanyId(urlBranding.id);
      return;
    }
    if (brandingLoading || coLoading) return;
    if (!urlBranding) {
      // Slug does not exist at all.
      nav({ to: "/auth" });
      return;
    }
    if (urlBranding.status === "suspended") {
      nav({ to: "/c/$slug/auth", params: { slug } });
      return;
    }
    if (!company) {
      // Signed-in user does not belong to this company — bounce to their own,
      // or to the sign-in page for this slug if they have no company at all.
      const own = companies[0];
      if (own) {
        nav({ to: "/c/$slug/dashboard", params: { slug: own.slug } });
      } else {
        nav({ to: "/c/$slug/auth", params: { slug } });
      }
      return;
    }
    if (isInactive) {
      void import("sonner").then((m) =>
        m.toast.error("Your account is inactive. Contact an administrator."),
      );
      nav({ to: "/c/$slug/auth", params: { slug } });
    }
  }, [user, loading, isInactive, isSuperAdmin, company, coLoading, brandingLoading, urlBranding, companies, nav, slug]);

  const ready =
    !loading &&
    !!user &&
    !isInactive &&
    !brandingLoading &&
    !coLoading &&
    (isSuperAdmin ? !!urlBranding : !!company);
  if (!ready) {
    return (
      <div className="min-h-dvh flex items-center justify-center">
        <div className="flex items-center gap-3 text-muted-foreground">
          <Sparkles className="w-5 h-5 animate-pulse" />
          Loading workspace…
        </div>
      </div>
    );
  }

  return (
    <TaskModalProvider>
      <ConfirmProvider>
        <div className="flex min-h-dvh">
          <Sidebar />
          <main className="flex-1 min-w-0 pb-20 md:pb-0">
            <Outlet />
          </main>
          <BottomNav />
        </div>
      </ConfirmProvider>
    </TaskModalProvider>
  );
}
