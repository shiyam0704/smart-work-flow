import { createFileRoute, useRouter } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { RoleGuard } from "@/components/app/RoleGuard";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";
import { useActiveCompany } from "@/hooks/use-company";
import { useAuth } from "@/hooks/use-auth";
import { invalidateCache } from "@/lib/shared-cache";
import { isValidSlug } from "@/lib/modules";
import {
  DATE_FORMAT_OPTIONS, TIME_FORMAT_OPTIONS,
  formatDate, formatTime,
} from "@/lib/format";
import { toast } from "sonner";
import { Building2, Upload, Link as LinkIcon, Copy, ExternalLink } from "lucide-react";

export const Route = createFileRoute("/c/$slug/_app/settings/company")({
  component: () => <RoleGuard allow={["admin", "super_admin"]}><CompanyPage /></RoleGuard>,
  head: () => ({ meta: [{ title: "Company — Settings" }] }),
});

// A small set of common IANA timezones; users can type any IANA name too.
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

function CompanyPage() {
  const { company, reload } = useActiveCompany();
  const { isSuperAdmin } = useAuth();
  const router = useRouter();
  const [name, setName] = useState("");
  const [slug, setSlug] = useState("");
  const [logoUrl, setLogoUrl] = useState("");
  const [logoPreview, setLogoPreview] = useState<string>("");
  const [tz, setTz] = useState("Asia/Kolkata");
  const [df, setDf] = useState("dd/MM/yyyy");
  const [tf, setTf] = useState<"12h" | "24h">("12h");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!company) return;
    setName(company.name); setSlug(company.slug); setLogoUrl(company.logo_url);
    setLogoPreview(company.logo_url ?? "");
    setTz(company.timezone); setDf(company.date_format); setTf(company.time_format);
  }, [company]);

  const now = useMemo(() => new Date(), [tz, df, tf]);
  const loginUrl = typeof window !== "undefined" && company
    ? `${window.location.origin}/c/${company.slug}/auth` : `/c/${slug}/auth`;

  if (!company) {
    return <div className="text-muted-foreground text-sm">No active company. Sign in via a company URL first.</div>;
  }

  async function onLogoFile(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0];
    if (!f) return;
    e.target.value = "";
    if (f.size > 2 * 1024 * 1024) { toast.error("Max 2 MB"); return; }
    if (!company) return;
    const ext = (f.name.split(".").pop() || "png").toLowerCase().replace(/[^a-z0-9]/g, "") || "png";
    const path = `${company.id}/logo-${Date.now()}.${ext}`;
    setBusy(true);
    const { error } = await supabase.storage
      .from("company-logos")
      .upload(path, f, { upsert: true, cacheControl: "3600", contentType: f.type || undefined });
    setBusy(false);
    if (error) return toast.error(error.message);
    setLogoUrl(path);
    // Show the freshly-uploaded file locally (bucket is private; direct URL not accessible).
    const reader = new FileReader();
    reader.onload = () => setLogoPreview(String(reader.result || ""));
    reader.readAsDataURL(f);
    toast.success("Logo uploaded — click Save to apply");
  }

  async function save() {
    if (!name.trim()) return toast.error("Company name is required");
    if (slug !== company!.slug) {
      if (!isSuperAdmin) return toast.error("Only Super Admin can change the URL slug");
      if (!isValidSlug(slug)) return toast.error("Invalid slug");
      const { data: dup } = await supabase.from("companies" as any).select("id").eq("slug", slug).maybeSingle();
      if (dup && (dup as any).id !== company!.id) return toast.error("Slug already used");
    }
    setBusy(true);
    const { data: updated, error } = await supabase
      .from("companies" as any)
      .update({
        name: name.trim(), slug, logo_url: logoUrl,
        timezone: tz, date_format: df, time_format: tf,
      })
      .eq("id", company!.id)
      .select("id");
    setBusy(false);
    if (error) return toast.error(error.message);
    if (!updated || updated.length === 0) {
      // RLS filtered the update out — do NOT reload, so the just-uploaded
      // logo stays visible in the form for the user to retry.
      return toast.error("You don't have permission to update this company");
    }
    invalidateCache("companies");
    await reload();
    window.dispatchEvent(new Event("companies:changed"));
    // Re-run the /c/$slug loader so Sidebar/Topbar/head tags pick up new branding.
    await router.invalidate();
    toast.success("Company saved");
  }

  return (
    <div className="space-y-4 max-w-3xl">
      <div className="glass rounded-2xl p-5 shadow-card flex items-start gap-3">
        <div className="w-11 h-11 rounded-xl bg-gradient-primary text-white grid place-items-center shadow-glow">
          <Building2 className="w-5 h-5" />
        </div>
        <div>
          <h2 className="font-display font-bold text-lg">Company</h2>
          <p className="text-sm text-muted-foreground">Branding, URL &amp; formats</p>
        </div>
      </div>

      <div className="glass rounded-2xl p-6 shadow-card space-y-6">
        {/* Logo */}
        <div>
          <Label>Logo</Label>
          <div className="flex items-center gap-3 mt-2">
            <div className="w-16 h-16 rounded-xl bg-muted grid place-items-center overflow-hidden border border-glass-border">
              {logoPreview
                ? <img src={logoPreview} alt="Logo" className="w-full h-full object-cover" />
                : logoUrl
                ? <img src={`/api/public/c/${company.slug}/logo?v=${encodeURIComponent(logoUrl)}`} alt="Logo" className="w-full h-full object-cover" />
                : <Building2 className="w-7 h-7 text-muted-foreground" />}
            </div>
            <label className="inline-flex items-center gap-2 border border-glass-border rounded-lg px-3 py-2 text-sm cursor-pointer hover:bg-white/5">
              <Upload className="w-4 h-4" /> Upload
              <input type="file" accept="image/*" className="hidden" onChange={onLogoFile} />
            </label>
            {(logoUrl || logoPreview) && <button onClick={() => { setLogoUrl(""); setLogoPreview(""); }} className="text-xs text-muted-foreground hover:text-destructive">Remove</button>}
          </div>
          <p className="text-xs text-muted-foreground mt-2">PNG, JPG, WEBP or SVG · max 2MB. Shown on the sign-in page and sidebar.</p>
        </div>

        {/* Name */}
        <div>
          <Label>Company name</Label>
          <Input value={name} onChange={(e) => setName(e.target.value)} className="mt-2" />
        </div>

        {/* Slug */}
        <div>
          <Label className="flex items-center gap-2"><LinkIcon className="w-3.5 h-3.5" /> Company URL slug</Label>
          <div className="mt-2 flex items-stretch gap-2">
            <Input
              value={slug}
              onChange={(e) => setSlug(e.target.value.toLowerCase())}
              disabled={!isSuperAdmin}
              className="font-mono flex-1"
            />
            <Button
              type="button"
              variant="outline"
              onClick={async () => {
                try {
                  await navigator.clipboard.writeText(loginUrl);
                  toast.success("Company URL copied");
                } catch {
                  toast.error("Copy failed");
                }
              }}
              className="gap-1.5"
            >
              <Copy className="w-4 h-4" /> Copy URL
            </Button>
            <Button
              type="button"
              variant="outline"
              asChild
              className="gap-1.5"
            >
              <a href={loginUrl} target="_blank" rel="noreferrer">
                <ExternalLink className="w-4 h-4" /> Open
              </a>
            </Button>
          </div>
          <p className="text-xs text-muted-foreground mt-2">
            Employees sign in at <span className="font-mono text-primary">{loginUrl}</span>
            {!isSuperAdmin && <span className="ml-2 opacity-70">(only Super Admin can change the slug)</span>}
          </p>
        </div>

        {/* Timezone */}
        <div>
          <Label>Timezone</Label>
          <select value={tz} onChange={(e) => setTz(e.target.value)} className="mt-2 w-full h-10 px-3 rounded-md border border-glass-border bg-background text-foreground text-sm">
            {TIMEZONES.map((z) => <option key={z.value} value={z.value}>{z.label}</option>)}
          </select>
        </div>

        {/* Date & time formats */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <Label>Date format</Label>
            <select value={df} onChange={(e) => setDf(e.target.value)} className="mt-2 w-full h-10 px-3 rounded-md border border-glass-border bg-background text-foreground text-sm">
              {DATE_FORMAT_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
            </select>
            <p className="text-xs text-muted-foreground mt-2">Preview: <span className="text-primary font-mono">{formatDate(now, df as any, tz)}</span></p>
          </div>
          <div>
            <Label>Time format</Label>
            <select value={tf} onChange={(e) => setTf(e.target.value as any)} className="mt-2 w-full h-10 px-3 rounded-md border border-glass-border bg-background text-foreground text-sm">
              {TIME_FORMAT_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
            </select>
            <p className="text-xs text-muted-foreground mt-2">Preview: <span className="text-primary font-mono">{formatTime(now, tf, tz)}</span></p>
          </div>
        </div>

        <div>
          <Button onClick={save} disabled={busy} className="bg-gradient-primary text-white">
            {busy ? "Saving…" : "Save changes"}
          </Button>
        </div>
      </div>
    </div>
  );
}