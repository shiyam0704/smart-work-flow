import { createFileRoute } from "@tanstack/react-router";
import { CLink as Link, useCNavigate as useNavigate } from "@/lib/nav";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { PasswordInput } from "@/components/ui/password-input";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";
import { writeActiveCompanyId } from "@/lib/active-company";
import { toast } from "sonner";
import { ShieldCheck } from "lucide-react";

export const Route = createFileRoute("/auth")({
  component: AdminAuthPage,
  head: () => ({ meta: [{ title: "Admin sign-in — Smart Work Flow" }] }),
});

type AdminDestination =
  | { kind: "admin" }
  | { kind: "company"; slug: string }
  | null;

async function getAdminDestination(userId: string): Promise<AdminDestination> {
  const { data, error } = await supabase
    .from("user_roles")
    .select("role, company_id")
    .eq("user_id", userId);
  if (error) throw error;
  const roles = data ?? [];
  if (roles.some((r: { role: string }) => r.role === "super_admin")) {
    writeActiveCompanyId(null);
    return { kind: "admin" };
  }
  const companyAdmin = roles.find((r: { role: string; company_id: string | null }) => r.role === "admin" && r.company_id);
  if (companyAdmin?.company_id) {
    writeActiveCompanyId(companyAdmin.company_id);
    const { data: co } = await supabase
      .from("companies" as any)
      .select("slug")
      .eq("id", companyAdmin.company_id)
      .maybeSingle();
    const slug = (co as { slug?: string } | null)?.slug;
    if (slug) return { kind: "company", slug };
  }
  return null;
}

function goToDestination(nav: ReturnType<typeof useNavigate>, dest: AdminDestination) {
  if (!dest) return;
  if (dest.kind === "admin") nav({ to: "/admin" });
  else nav({ to: "/c/$slug/dashboard", params: { slug: dest.slug } });
}

function AdminAuthPage() {
  const nav = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    (async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;
      const destination = await getAdminDestination(session.user.id);
      goToDestination(nav, destination);
    })();
  }, [nav]);

  async function rejectNonAdmin() {
    await supabase.auth.signOut();
    toast.error(
      "This login is for platform and company admins only.",
    );
  }

  async function handleSignIn(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    const { data, error } = await supabase.auth.signInWithPassword({ email, password });
    setBusy(false);
    if (error) return toast.error(error.message);
    if (!data.user) return toast.error("Sign-in failed");
    const destination = await getAdminDestination(data.user.id);
    if (!destination) return rejectNonAdmin();
    toast.success("Signed in");
    goToDestination(nav, destination);
  }

  return (
    <div className="min-h-dvh flex items-center justify-center p-6">
      <div className="glass-strong rounded-3xl p-8 max-w-md w-full shadow-card">
        <div className="flex items-center gap-3 mb-6">
          <div className="w-14 h-14 rounded-xl bg-gradient-primary text-white grid place-items-center shadow-glow">
            <ShieldCheck className="w-7 h-7" />
          </div>
          <div>
            <div className="font-display font-bold text-2xl">Admin</div>
            <div className="text-xs text-muted-foreground">Sign in to manage your workspace</div>
          </div>
        </div>

        <form className="space-y-4" onSubmit={handleSignIn}>
          <div className="grid gap-2">
            <Label>Email</Label>
            <Input type="email" required value={email} onChange={(e) => setEmail(e.target.value)} />
          </div>
          <div className="grid gap-2">
            <Label>Password</Label>
            <PasswordInput required value={password} onChange={(e) => setPassword(e.target.value)} placeholder="••••••••" />
          </div>
          <Button type="submit" disabled={busy} className="w-full bg-gradient-primary text-white shadow-glow h-11">
            {busy ? "Working…" : "Sign in"}
          </Button>
        </form>

        <div className="mt-6 pt-6 border-t border-glass-border">
          <p className="text-[11px] text-muted-foreground text-center">
            Company employees: sign in at your company URL <span className="font-mono text-foreground">/c/&#123;your-company&#125;</span>
          </p>
          <div className="mt-4 text-center">
            <Link to="/" className="text-xs text-muted-foreground hover:text-foreground">← Back to home</Link>
          </div>
        </div>
      </div>
    </div>
  );
}
