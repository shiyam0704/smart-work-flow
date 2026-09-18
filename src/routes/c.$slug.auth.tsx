import { createFileRoute, useParams } from "@tanstack/react-router";
import { CLink as Link, useCNavigate as useNavigate } from "@/lib/nav";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { PasswordInput } from "@/components/ui/password-input";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";
import { writeActiveCompanyId } from "@/lib/active-company";
import { toast } from "sonner";
import { Building2, Download } from "lucide-react";
import logo from "@/assets/app-logo.png";

export const Route = createFileRoute("/c/$slug/auth")({
  component: CompanyAuthPage,
});

function CompanyAuthPage() {
  const { slug } = useParams({ from: "/c/$slug/auth" });
  const nav = useNavigate();
  const [company, setCompany] = useState<null | { id: string; name: string; slug: string; logo_url: string | null; status: string }>(null);
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const { data } = await supabase.rpc("get_company_branding", { _slug: slug });
      if (cancelled) return;
      const row = Array.isArray(data) ? data[0] : null;
      setCompany(row ?? null);
      setLoading(false);
    })();
    return () => { cancelled = true; };
  }, [slug]);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [installPrompt, setInstallPrompt] = useState<any>(null);
  const [installed, setInstalled] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const mm = window.matchMedia("(display-mode: standalone)");
    setInstalled(mm.matches || (window.navigator as any).standalone === true);
    const onPrompt = (e: any) => { e.preventDefault(); setInstallPrompt(e); };
    const onInstalled = () => { setInstalled(true); setInstallPrompt(null); };
    window.addEventListener("beforeinstallprompt", onPrompt);
    window.addEventListener("appinstalled", onInstalled);
    return () => {
      window.removeEventListener("beforeinstallprompt", onPrompt);
      window.removeEventListener("appinstalled", onInstalled);
    };
  }, []);

  const isIOS = typeof navigator !== "undefined" && /iPad|iPhone|iPod/.test(navigator.userAgent);

  async function handleInstall() {
    if (installPrompt) {
      installPrompt.prompt();
      await installPrompt.userChoice;
      setInstallPrompt(null);
    } else if (isIOS) {
      toast.info("Tap Share, then 'Add to Home Screen' to install.");
    } else {
      toast.info("Your browser will show an install option in the address bar.");
    }
  }

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session) nav({ to: "/c/$slug/dashboard" });
    });
  }, [nav]);

  if (loading) {
    return <div className="min-h-dvh grid place-items-center text-muted-foreground">Loading…</div>;
  }
  if (!company) {
    return (
      <div className="min-h-dvh grid place-items-center p-6">
        <div className="glass rounded-2xl p-8 max-w-md text-center shadow-card">
          <h1 className="font-display font-bold text-2xl">Company not found</h1>
          <p className="text-muted-foreground text-sm mt-2">
            No company is registered at <span className="font-mono">/c/{slug}</span>.
          </p>
          <Link to="/" className="inline-block mt-4 text-primary underline text-sm">Back to home</Link>
        </div>
      </div>
    );
  }
  if (company.status === "suspended") {
    return (
      <div className="min-h-dvh grid place-items-center p-6">
        <div className="glass rounded-2xl p-8 max-w-md text-center shadow-card">
          <h1 className="font-display font-bold text-2xl">Company suspended</h1>
          <p className="text-muted-foreground text-sm mt-2">
            Access to {company.name} is currently paused. Please contact the platform administrator.
          </p>
        </div>
      </div>
    );
  }

  async function handleSignIn(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    const { data, error } = await supabase.auth.signInWithPassword({ email, password });
    setBusy(false);
    if (error) return toast.error(error.message);
    const userId = data.user?.id;
    if (!userId) return toast.error("Sign-in failed");
    const { data: roles } = await supabase
      .from("user_roles")
      .select("role, company_id")
      .eq("user_id", userId);
    const isSuperAdmin = (roles ?? []).some((r: any) => r.role === "super_admin");
    if (isSuperAdmin) {
      writeActiveCompanyId(null);
      toast.success("Signed in");
      nav({ to: "/admin" });
      return;
    }
    let belongsToCompany = (roles ?? []).some((r: any) => r.company_id === company!.id);
    if (!belongsToCompany) {
      // Fallback: an active employee row for this company also counts as membership.
      // This unblocks employees whose user_roles seed row is missing or legacy.
      const { data: empRow } = await supabase
        .from("employees")
        .select("id")
        .eq("user_id", userId)
        .eq("company_id", company!.id)
        .eq("status", "active")
        .maybeSingle();
      belongsToCompany = !!empRow;
    }
    if (!belongsToCompany) {
      await supabase.auth.signOut();
      return toast.error("This account is not assigned to this company");
    }
    writeActiveCompanyId(company!.id);
    toast.success(`Welcome to ${company!.name}`);
    nav({ to: "/c/$slug/dashboard" });
  }

  return (
    <div className="min-h-dvh flex items-center justify-center p-6">
      <div className="glass-strong rounded-3xl p-8 max-w-md w-full shadow-card">
        <div className="flex items-center gap-3 mb-6">
          <div className="w-14 h-14 rounded-xl overflow-hidden shadow-glow ring-1 ring-glass-border bg-white grid place-items-center">
            {company.logo_url
              ? <img src={company.logo_url} alt={company.name} className="w-full h-full object-cover" />
              : <Building2 className="w-7 h-7 text-primary" />}
          </div>
          <div>
            <div className="font-display font-bold text-2xl">{company.name}</div>
            <div className="text-xs text-muted-foreground">Sign in to your workspace</div>
          </div>
        </div>

        <form className="space-y-4" onSubmit={handleSignIn}>
          <div className="grid gap-2">
            <Label>Work email</Label>
            <Input type="email" required value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@company.com" />
          </div>
          <div className="grid gap-2">
            <Label>Password</Label>
            <PasswordInput required value={password} onChange={(e) => setPassword(e.target.value)} placeholder="••••••••" />
          </div>
          <Button type="submit" disabled={busy} className="w-full bg-gradient-primary text-white shadow-glow h-11">
            {busy ? "Signing in…" : "Sign in"}
          </Button>
        </form>

        {!installed && (
          <button
            type="button"
            onClick={handleInstall}
            className="mt-4 w-full flex items-center justify-center gap-2 h-10 rounded-lg border border-glass-border text-sm hover:bg-white/5 transition"
          >
            <Download className="w-4 h-4" /> Install {company.name} app
          </button>
        )}

        <div className="mt-6 pt-4 border-t border-glass-border flex items-center justify-between text-xs text-muted-foreground">
          <div className="flex items-center gap-2">
            <img src={logo} alt="" className="w-4 h-4 rounded" />
            <span>Powered by Smart Work Flow</span>
          </div>
          <Link to="/auth" className="hover:text-foreground">Admin →</Link>
        </div>
      </div>
    </div>
  );
}