import { createFileRoute } from "@tanstack/react-router";
import { useCNavigate as useNavigate } from "@/lib/nav";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { useAllCompanies, useCompanyModules, type Company } from "@/hooks/use-company";
import { MODULES, isValidSlug, RESERVED_SLUGS } from "@/lib/modules";
import { createCompanyAdminLogin, resetCompanyAdminPassword } from "@/lib/company-admin.functions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { PasswordInput } from "@/components/ui/password-input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from "@/components/ui/dialog";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { invalidateCache } from "@/lib/shared-cache";
import { formatDate, DATE_FORMAT_OPTIONS, TIME_FORMAT_OPTIONS } from "@/lib/format";
import { toast } from "sonner";
import {
  Building2, Plus, LogOut, MoreHorizontal, Pencil, Layers, KeyRound, Trash2,
  Users, Upload, Sparkles, Eye, Copy, Check,
} from "lucide-react";

export const Route = createFileRoute("/admin/")({
  component: AdminConsole,
  head: () => ({ meta: [{ title: "Platform Admin — Console" }] }),
});

const TIMEZONES = [
  { value: "Asia/Kolkata",       label: "(GMT+05:30) India — Asia/Kolkata" },
  { value: "Asia/Dubai",         label: "(GMT+04:00) UAE — Asia/Dubai" },
  { value: "Asia/Singapore",     label: "(GMT+08:00) Singapore" },
  { value: "Europe/London",      label: "(GMT+00:00) London" },
  { value: "Europe/Berlin",      label: "(GMT+01:00) Berlin" },
  { value: "America/New_York",   label: "(GMT-05:00) New York" },
  { value: "America/Los_Angeles",label: "(GMT-08:00) Los Angeles" },
  { value: "Australia/Sydney",   label: "(GMT+10:00) Sydney" },
  { value: "UTC",                label: "(GMT+00:00) UTC" },
];

const ACCENT = "#0f7a4a"; // green matching reference
const ACCENT_SOFT = "#e8f5ee";
const BRAND = "#8a4a2a";  // brown for primary CTAs inside dialogs

function AdminConsole() {
  const nav = useNavigate();
  const { user, isSuperAdmin, loading } = useAuth();
  useEffect(() => {
    if (loading) return;
    if (!user || !isSuperAdmin) nav({ to: "/auth" });
  }, [user, isSuperAdmin, loading, nav]);

  const { companies, reload } = useAllCompanies();
  const [openNew, setOpenNew] = useState(false);
  const [viewing, setViewing] = useState<Company | null>(null);
  const [editing, setEditing] = useState<Company | null>(null);
  const [modulesFor, setModulesFor] = useState<Company | null>(null);
  const [resetFor, setResetFor] = useState<Company | null>(null);
  const [deleteFor, setDeleteFor] = useState<Company | null>(null);

  async function signOut() {
    await supabase.auth.signOut();
    nav({ to: "/auth" });
  }

  async function toggleStatus(c: Company) {
    const next = c.status === "active" ? "suspended" : "active";
    await supabase.from("companies" as any).update({ status: next }).eq("id", c.id);
    invalidateCache("companies");
    await reload();
    toast.success(next === "suspended" ? "Company suspended" : "Company reactivated");
  }

  if (loading || !user || !isSuperAdmin) {
    return <div className="min-h-dvh grid place-items-center text-muted-foreground bg-[#f7f8fa]">Loading console…</div>;
  }

  return (
    <div className="min-h-dvh bg-[#f7f8fa] text-slate-900">
      {/* Header */}
      <header className="bg-white border-b border-slate-200">
        <div className="max-w-[1400px] mx-auto px-8 py-5 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 grid place-items-center">
              <Sparkles className="w-6 h-6" style={{ color: ACCENT }} />
            </div>
            <div>
              <h1 className="text-lg font-bold leading-tight text-slate-900">Platform Admin</h1>
              <p className="text-xs text-slate-500">Manage company workspaces</p>
            </div>
          </div>
          <Button
            onClick={() => setOpenNew(true)}
            className="text-white h-10 px-4 rounded-lg shadow-sm hover:opacity-90"
            style={{ backgroundColor: ACCENT }}
          >
            <Plus className="w-4 h-4" /> New company
          </Button>
        </div>
      </header>

      <div className="max-w-[1400px] mx-auto px-8 py-6 space-y-6">
        {/* Utility row */}
        <div className="flex items-center justify-end gap-3">
          <span className="text-sm text-slate-500">{user.email}</span>
          <button
            onClick={signOut}
            className="inline-flex items-center gap-2 text-sm px-3 py-1.5 rounded-md border border-slate-200 bg-white hover:bg-slate-50"
          >
            <LogOut className="w-3.5 h-3.5" /> Sign out
          </button>
        </div>

        {/* KPI cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <KpiCard icon={<Building2 className="w-5 h-5 text-slate-700" />} value={companies.length} label="Companies" />
          <KpiCard icon={<Users className="w-5 h-5 text-slate-700" />} value={MODULES.length} label="Modules available" />
          <KpiCard icon={<Layers className="w-5 h-5 text-slate-700" />} value={7} label="Roles" />
        </div>

        {/* Companies table */}
        <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
          <div className="grid grid-cols-[2fr_1fr_1fr_1fr_80px] px-6 py-4 border-b border-slate-200 text-sm text-slate-500 font-medium">
            <div>Company</div>
            <div>Slug</div>
            <div>Status</div>
            <div>Created</div>
            <div className="text-right">Actions</div>
          </div>
          {companies.length === 0 ? (
            <div className="px-6 py-10 text-center text-sm text-slate-500">No companies yet.</div>
          ) : companies.map((c) => (
            <div key={c.id} className="grid grid-cols-[2fr_1fr_1fr_1fr_80px] px-6 py-4 items-center border-b border-slate-100 last:border-0">
              <div className="font-semibold text-slate-900">{c.name}</div>
              <div className="font-mono text-sm text-slate-600">{c.slug}</div>
              <div className="flex items-center gap-2">
                <Switch
                  checked={c.status === "active"}
                  onCheckedChange={() => toggleStatus(c)}
                  className="data-[state=checked]:bg-[color:var(--admin-accent)]"
                  style={{ ["--admin-accent" as any]: ACCENT }}
                />
                <span className="text-sm" style={{ color: c.status === "active" ? ACCENT : "#b91c1c" }}>
                  {c.status === "active" ? "Active" : "Suspended"}
                </span>
              </div>
              <div className="text-sm text-slate-600">
                {c.created_at ? formatDate(c.created_at, "dd/MM/yyyy") : "—"}
              </div>
              <div className="flex justify-end">
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <button className="w-8 h-8 grid place-items-center rounded-md hover:bg-slate-100 text-slate-500">
                      <MoreHorizontal className="w-4 h-4" />
                    </button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" className="w-52">
                    <DropdownMenuItem onClick={() => setViewing(c)}>
                      <Eye className="w-4 h-4" /> View details
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => setEditing(c)}>
                      <Pencil className="w-4 h-4" /> Edit details
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => setModulesFor(c)}>
                      <Layers className="w-4 h-4" /> Modules
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => setResetFor(c)}>
                      <KeyRound className="w-4 h-4" /> Reset admin password
                    </DropdownMenuItem>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem onClick={() => setDeleteFor(c)} className="text-red-600 focus:text-red-600">
                      <Trash2 className="w-4 h-4" /> Delete company
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
            </div>
          ))}
        </div>
      </div>

      <NewCompanyDialog open={openNew} onOpenChange={setOpenNew} existingSlugs={companies.map((c) => c.slug)} onCreated={() => { void reload(); }} />
      <ViewCompanyDialog company={viewing} onOpenChange={(o) => !o && setViewing(null)} />
      <EditCompanyDialog company={editing} onOpenChange={(o) => !o && setEditing(null)} onSaved={() => { void reload(); }} />
      <ModulesDialog company={modulesFor} onOpenChange={(o) => !o && setModulesFor(null)} />
      <ResetPasswordDialog company={resetFor} onOpenChange={(o) => !o && setResetFor(null)} />
      <DeleteCompanyDialog company={deleteFor} onOpenChange={(o) => !o && setDeleteFor(null)} onDeleted={() => { void reload(); }} />
    </div>
  );
}

function KpiCard({ icon, value, label }: { icon: React.ReactNode; value: number | string; label: string }) {
  return (
    <div className="bg-white border border-slate-200 rounded-xl p-6 shadow-sm">
      <div className="w-9 h-9 rounded-lg bg-slate-100 grid place-items-center mb-4">{icon}</div>
      <div className="text-3xl font-bold text-slate-900 leading-none">{value}</div>
      <div className="text-sm text-slate-500 mt-2">{label}</div>
    </div>
  );
}

// ------------------------------------------------------------------ dialogs

function deriveSlug(name: string, existing: string[]): string {
  const base = name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 30) || "co";
  let s = base;
  let i = 2;
  while (existing.includes(s) || RESERVED_SLUGS.has(s) || !isValidSlug(s)) {
    s = `${base}-${i++}`;
    if (i > 50) break;
  }
  return s;
}

function NewCompanyDialog({
  open, onOpenChange, existingSlugs, onCreated,
}: { open: boolean; onOpenChange: (o: boolean) => void; existingSlugs: string[]; onCreated: () => void }) {
  const [name, setName] = useState("");
  const [adminName, setAdminName] = useState("");
  const [adminEmail, setAdminEmail] = useState("");
  const [adminPassword, setAdminPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const createAdminLogin = useServerFn(createCompanyAdminLogin);

  useEffect(() => {
    if (!open) { setName(""); setAdminName(""); setAdminEmail(""); setAdminPassword(""); }
  }, [open]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) return toast.error("Company name is required");
    if (!adminName.trim()) return toast.error("Admin name is required");
    if (!adminEmail.trim()) return toast.error("Admin email is required");
    if (adminPassword.length < 4) return toast.error("Password must be at least 4 characters");

    setBusy(true);
    const slug = deriveSlug(name, existingSlugs);
    const { data: co, error } = await supabase.from("companies" as any).insert({
      name: name.trim(), slug, logo_url: "",
      timezone: "Asia/Kolkata", date_format: "dd/MM/yyyy", time_format: "12h", status: "active",
    }).select();
    if (error || !co) { setBusy(false); return toast.error(error?.message ?? "Failed to create"); }
    const companyId = Array.isArray(co) ? (co[0] as any).id : (co as any).id;
    for (const m of MODULES) {
      await supabase.from("company_modules" as any).insert({
        company_id: companyId, module_key: m.key, enabled: true,
      });
    }
    try {
      await createAdminLogin({
        data: {
          companyId,
          name: adminName.trim(),
          email: adminEmail.trim(),
          password: adminPassword,
        },
      });
    } catch (e: any) {
      setBusy(false);
      return toast.error(e.message ?? "Failed to create admin login");
    }
    invalidateCache("companies");
    setBusy(false);
    onCreated();
    onOpenChange(false);
    toast.success(`Company created · /c/${slug}/auth`);
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md bg-white text-slate-900">
        <DialogHeader>
          <DialogTitle>New company</DialogTitle>
          <DialogDescription>Create the company and its first Admin login.</DialogDescription>
        </DialogHeader>
        <form onSubmit={submit} className="space-y-4">
          <FieldRow label="Company name"><Input value={name} onChange={(e) => setName(e.target.value)} /></FieldRow>
          <FieldRow label="Admin name"><Input value={adminName} onChange={(e) => setAdminName(e.target.value)} /></FieldRow>
          <FieldRow label="Admin email"><Input type="email" value={adminEmail} onChange={(e) => setAdminEmail(e.target.value)} /></FieldRow>
          <FieldRow label="Admin password"><PasswordInput value={adminPassword} onChange={(e) => setAdminPassword(e.target.value)} /></FieldRow>
          <DialogFooter>
            <Button type="submit" disabled={busy} className="text-white" style={{ backgroundColor: BRAND }}>
              {busy ? "Creating…" : "Create company"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function FieldRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <Label className="text-sm font-medium text-slate-800">{label}</Label>
      <div className="mt-1.5">{children}</div>
    </div>
  );
}

function EditCompanyDialog({
  company, onOpenChange, onSaved,
}: { company: Company | null; onOpenChange: (o: boolean) => void; onSaved: () => void }) {
  const [name, setName] = useState("");
  const [slug, setSlug] = useState("");
  const [logo, setLogo] = useState("");
  const [tz, setTz] = useState("Asia/Kolkata");
  const [df, setDf] = useState("dd/MM/yyyy");
  const [tf, setTf] = useState<"12h" | "24h">("12h");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!company) return;
    setName(company.name); setSlug(company.slug); setLogo(company.logo_url || "");
    setTz(company.timezone); setDf(company.date_format); setTf(company.time_format);
  }, [company]);

  const loginUrl = useMemo(() => {
    if (typeof window === "undefined") return `/c/${slug}/auth`;
    return `${window.location.origin}/c/${slug}/auth`;
  }, [slug]);

  function onLogo(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0]; if (!f) return;
    if (f.size > 2 * 1024 * 1024) return toast.error("Max 2 MB");
    const r = new FileReader();
    r.onload = () => setLogo(String(r.result || ""));
    r.readAsDataURL(f);
  }

  async function save() {
    if (!company) return;
    if (!name.trim()) return toast.error("Company name is required");
    if (slug !== company.slug) {
      if (!isValidSlug(slug)) return toast.error("Invalid slug");
      const { data: dup } = await supabase.from("companies" as any).select("id").eq("slug", slug).maybeSingle();
      if (dup && (dup as any).id !== company.id) return toast.error("Slug already used");
    }
    setBusy(true);
    const { error } = await supabase.from("companies" as any).update({
      name: name.trim(), slug, logo_url: logo, timezone: tz, date_format: df, time_format: tf,
    }).eq("id", company.id);
    setBusy(false);
    if (error) return toast.error(error.message);
    invalidateCache("companies");
    onSaved();
    onOpenChange(false);
    toast.success("Company saved");
  }

  return (
    <Dialog open={!!company} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md bg-white text-slate-900">
        <DialogHeader>
          <DialogTitle>Edit company</DialogTitle>
          <DialogDescription>Update branding, URL, and formats.</DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div>
            <Label className="text-sm font-medium">Logo</Label>
            <div className="flex items-center gap-3 mt-1.5">
              <div className="w-14 h-14 rounded-lg bg-slate-100 border border-slate-200 grid place-items-center overflow-hidden">
                {logo ? <img src={logo} alt="" className="w-full h-full object-cover" /> : <Building2 className="w-6 h-6 text-slate-400" />}
              </div>
              <label className="inline-flex items-center gap-2 text-sm border border-slate-200 rounded-md px-3 py-1.5 cursor-pointer hover:bg-slate-50">
                <Upload className="w-3.5 h-3.5" /> Upload
                <input type="file" accept="image/*" className="hidden" onChange={onLogo} />
              </label>
              {logo && <button onClick={() => setLogo("")} className="text-xs text-slate-500 hover:text-red-600">Remove</button>}
            </div>
          </div>
          <FieldRow label="Company name"><Input value={name} onChange={(e) => setName(e.target.value)} /></FieldRow>
          <div>
            <Label className="text-sm font-medium">Company URL slug</Label>
            <Input value={slug} onChange={(e) => setSlug(e.target.value.toLowerCase())} className="mt-1.5 font-mono" />
            <p className="text-[11px] text-slate-500 mt-1.5">Sign-in URL: <span className="font-mono break-all">{loginUrl}</span></p>
          </div>
          <div>
            <Label className="text-sm font-medium">Timezone</Label>
            <select value={tz} onChange={(e) => setTz(e.target.value)} className="mt-1.5 w-full h-10 px-3 rounded-md border border-slate-200 bg-white text-slate-900 text-sm">
              {TIMEZONES.map((z) => <option key={z.value} value={z.value}>{z.label}</option>)}
            </select>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label className="text-sm font-medium">Date format</Label>
              <select value={df} onChange={(e) => setDf(e.target.value)} className="mt-1.5 w-full h-10 px-3 rounded-md border border-slate-200 bg-white text-slate-900 text-sm">
                {DATE_FORMAT_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
              </select>
            </div>
            <div>
              <Label className="text-sm font-medium">Time format</Label>
              <select value={tf} onChange={(e) => setTf(e.target.value as any)} className="mt-1.5 w-full h-10 px-3 rounded-md border border-slate-200 bg-white text-slate-900 text-sm">
                {TIME_FORMAT_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
              </select>
            </div>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button onClick={save} disabled={busy} className="text-white" style={{ backgroundColor: BRAND }}>
            {busy ? "Saving…" : "Save changes"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function ModulesDialog({
  company, onOpenChange,
}: { company: Company | null; onOpenChange: (o: boolean) => void }) {
  const { modules, isEnabled, reload } = useCompanyModules(company?.id ?? null);

  async function toggle(key: string, next: boolean) {
    if (!company) return;
    const row = modules.find((m) => m.module_key === key);
    if (row?.id) {
      await supabase.from("company_modules" as any).update({ enabled: next }).eq("id", row.id);
    } else {
      await supabase.from("company_modules" as any).insert({ company_id: company.id, module_key: key, enabled: next });
    }
    invalidateCache(`company_modules:${company.id}`);
    await reload();
  }

  return (
    <Dialog open={!!company} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md bg-white text-slate-900">
        <DialogHeader>
          <DialogTitle>Modules</DialogTitle>
          <DialogDescription>Enable or disable features for {company?.name}.</DialogDescription>
        </DialogHeader>
        <div className="divide-y divide-slate-100">
          {MODULES.map((m) => (
            <div key={m.key} className="flex items-center gap-3 py-3">
              <div className="flex-1 min-w-0">
                <div className="text-sm font-medium text-slate-900">{m.label}</div>
                <div className="text-xs text-slate-500">{m.description}</div>
              </div>
              <Switch
                checked={isEnabled(m.key)}
                onCheckedChange={(v) => toggle(m.key, v)}
                style={{ ["--admin-accent" as any]: ACCENT }}
                className="data-[state=checked]:bg-[color:var(--admin-accent)]"
              />
            </div>
          ))}
        </div>
        <DialogFooter>
          <Button onClick={() => onOpenChange(false)} className="text-white" style={{ backgroundColor: BRAND }}>Done</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function ResetPasswordDialog({
  company, onOpenChange,
}: { company: Company | null; onOpenChange: (o: boolean) => void }) {
  const [pw, setPw] = useState("");
  const [busy, setBusy] = useState(false);
  const resetPassword = useServerFn(resetCompanyAdminPassword);
  useEffect(() => { if (!company) setPw(""); }, [company]);

  async function submit() {
    if (!company) return;
    if (pw.length < 4) return toast.error("Password must be at least 4 characters");
    setBusy(true);
    try {
      await resetPassword({ data: { companyId: company.id, password: pw } });
    } catch (e: any) {
      setBusy(false);
      return toast.error(e.message ?? "Failed to reset password");
    }
    setBusy(false);
    onOpenChange(false);
    toast.success("Company admin password updated");
  }

  return (
    <Dialog open={!!company} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-sm bg-white text-slate-900">
        <DialogHeader>
          <DialogTitle>Reset admin password</DialogTitle>
          <DialogDescription>Set a new password for {company?.name}'s admin.</DialogDescription>
        </DialogHeader>
        <FieldRow label="New password">
          <PasswordInput value={pw} onChange={(e) => setPw(e.target.value)} />
        </FieldRow>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button onClick={submit} disabled={busy} className="text-white" style={{ backgroundColor: BRAND }}>
            {busy ? "Resetting…" : "Reset password"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function DeleteCompanyDialog({
  company, onOpenChange, onDeleted,
}: { company: Company | null; onOpenChange: (o: boolean) => void; onDeleted: () => void }) {
  const [confirm, setConfirm] = useState("");
  useEffect(() => { if (!company) setConfirm(""); }, [company]);

  async function submit() {
    if (!company) return;
    if (confirm !== company.slug) return toast.error(`Type "${company.slug}" to confirm`);
    await supabase.from("company_modules" as any).delete().eq("company_id", company.id);
    await supabase.from("company_admins" as any).delete().eq("company_id", company.id);
    await supabase.from("companies" as any).delete().eq("id", company.id);
    invalidateCache("companies");
    onDeleted();
    onOpenChange(false);
    toast.success("Company deleted");
  }

  return (
    <Dialog open={!!company} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-sm bg-white text-slate-900">
        <DialogHeader>
          <DialogTitle className="text-red-600">Delete company</DialogTitle>
          <DialogDescription>
            This permanently removes <b>{company?.name}</b> and its module settings.
            Type <span className="font-mono">{company?.slug}</span> to confirm.
          </DialogDescription>
        </DialogHeader>
        <Input value={confirm} onChange={(e) => setConfirm(e.target.value)} placeholder={company?.slug} className="font-mono" />
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button onClick={submit} className="bg-red-600 hover:bg-red-700 text-white">Delete company</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// suppress unused warning for ACCENT_SOFT (kept for future active pill styling)
void ACCENT_SOFT;

// -------------------------------------------------------- View details

type CompanyAdminRow = { name: string; email: string };

function ViewCompanyDialog({
  company, onOpenChange,
}: { company: Company | null; onOpenChange: (o: boolean) => void }) {
  const [admins, setAdmins] = useState<CompanyAdminRow[]>([]);
  const [loadingAdmins, setLoadingAdmins] = useState(false);
  const { modules } = useCompanyModules(company?.id ?? null);

  useEffect(() => {
    if (!company) { setAdmins([]); return; }
    let cancelled = false;
    setLoadingAdmins(true);
    supabase
      .from("company_admins" as any)
      .select("name, email")
      .eq("company_id", company.id)
      .order("created_at", { ascending: true })
      .then(({ data, error }) => {
        if (cancelled) return;
        if (error) {
          toast.error(error.message);
          setAdmins([]);
        } else {
          setAdmins(((data ?? []) as unknown as CompanyAdminRow[]));
        }
        setLoadingAdmins(false);
      });
    return () => { cancelled = true; };
  }, [company]);

  const signInUrl = useMemo(() => {
    if (!company) return "";
    if (typeof window === "undefined") return `/c/${company.slug}/auth`;
    return `${window.location.origin}/c/${company.slug}/auth`;
  }, [company]);

  const enabledCount = modules.filter((m) => m.enabled).length;
  const tzLabel = TIMEZONES.find((z) => z.value === company?.timezone)?.label ?? company?.timezone ?? "—";

  return (
    <Dialog open={!!company} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg bg-white text-slate-900">
        <DialogHeader>
          <DialogTitle>Company details</DialogTitle>
          <DialogDescription>Read-only view of {company?.name}.</DialogDescription>
        </DialogHeader>

        {company && (
          <div className="space-y-5">
            {/* Header */}
            <div className="flex items-center gap-3">
              <div className="w-14 h-14 rounded-lg bg-slate-100 border border-slate-200 grid place-items-center overflow-hidden">
                {company.logo_url
                  ? <img src={company.logo_url} alt="" className="w-full h-full object-cover" />
                  : <Building2 className="w-6 h-6 text-slate-400" />}
              </div>
              <div className="min-w-0">
                <div className="font-semibold text-slate-900 truncate">{company.name}</div>
                <div className="text-xs text-slate-500">
                  <span style={{ color: company.status === "active" ? ACCENT : "#b91c1c" }}>
                    {company.status === "active" ? "Active" : "Suspended"}
                  </span>
                  {company.created_at && <> · Created {formatDate(company.created_at, "dd/MM/yyyy")}</>}
                </div>
              </div>
            </div>

            {/* Company facts */}
            <div className="rounded-lg border border-slate-200 divide-y divide-slate-100">
              <ViewRow label="Sign-in URL" value={signInUrl} mono copyable />
              <ViewRow label="Slug" value={company.slug} mono />
              <ViewRow label="Timezone" value={tzLabel} />
              <ViewRow label="Date format" value={company.date_format} />
              <ViewRow label="Time format" value={company.time_format} />
            </div>

            {/* Admins */}
            <div>
              <div className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2">
                Company admin{admins.length > 1 ? "s" : ""}
              </div>
              {loadingAdmins ? (
                <div className="text-sm text-slate-500 px-3 py-4 rounded-lg border border-slate-200">Loading…</div>
              ) : admins.length === 0 ? (
                <div className="text-sm text-slate-500 px-3 py-4 rounded-lg border border-dashed border-slate-200">
                  No admin on file.
                </div>
              ) : (
                <div className="rounded-lg border border-slate-200 divide-y divide-slate-100">
                  {admins.map((a, i) => (
                    <div key={`${a.email}-${i}`} className="px-3 py-2.5">
                      <div className="text-sm font-medium text-slate-900">{a.name || "—"}</div>
                      <div className="flex items-center gap-2 mt-0.5">
                        <a href={`mailto:${a.email}`} className="text-sm text-slate-600 hover:text-slate-900 underline underline-offset-2 break-all">
                          {a.email}
                        </a>
                        <CopyButton value={a.email} />
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Modules */}
            <div>
              <div className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2">Modules</div>
              <div className="text-sm text-slate-700 px-3 py-2.5 rounded-lg border border-slate-200">
                {enabledCount} of {MODULES.length} enabled
              </div>
            </div>
          </div>
        )}

        <DialogFooter>
          <Button onClick={() => onOpenChange(false)} className="text-white" style={{ backgroundColor: BRAND }}>
            Close
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function ViewRow({ label, value, mono, copyable }: { label: string; value: string; mono?: boolean; copyable?: boolean }) {
  return (
    <div className="flex items-center gap-3 px-3 py-2.5">
      <div className="text-xs text-slate-500 w-28 shrink-0">{label}</div>
      <div className={`text-sm text-slate-800 flex-1 min-w-0 break-all ${mono ? "font-mono" : ""}`}>{value}</div>
      {copyable && <CopyButton value={value} />}
    </div>
  );
}

function CopyButton({ value }: { value: string }) {
  const [copied, setCopied] = useState(false);
  async function copy() {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
      setTimeout(() => setCopied(false), 1200);
    } catch {
      toast.error("Could not copy");
    }
  }
  return (
    <button
      onClick={copy}
      className="shrink-0 w-7 h-7 grid place-items-center rounded-md border border-slate-200 hover:bg-slate-50 text-slate-500"
      aria-label={copied ? "Copied" : "Copy"}
      type="button"
    >
      {copied ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
    </button>
  );
}