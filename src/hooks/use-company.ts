import { useEffect, useState, useCallback } from "react";
import { useParams } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";
import { readActiveCompanyId } from "@/lib/active-company";
import { useSharedResource } from "@/lib/shared-cache";

export interface Company {
  id: string;
  name: string;
  slug: string;
  logo_url: string;
  timezone: string;
  date_format: string;
  time_format: "12h" | "24h";
  status: "active" | "suspended";
  created_at?: string;
}

export interface CompanyModule {
  id?: string;
  company_id: string;
  module_key: string;
  enabled: boolean;
}

/** Reads the active company id from localStorage and reacts to changes. */
export function useActiveCompanyId(): string | null {
  const [id, setId] = useState<string | null>(() => readActiveCompanyId());
  useEffect(() => {
    const on = () => setId(readActiveCompanyId());
    window.addEventListener("swf:active-company-changed", on);
    window.addEventListener("storage", on);
    return () => {
      window.removeEventListener("swf:active-company-changed", on);
      window.removeEventListener("storage", on);
    };
  }, []);
  return id;
}

export function useAllCompanies() {
  const { data, loading, reload } = useSharedResource<Company[]>(
    "companies",
    async () => {
      const { data } = await supabase.from("companies" as any).select("*").order("created_at", { ascending: false });
      return (data ?? []) as unknown as Company[];
    },
    { eventName: "companies:changed" },
  );
  return { companies: data ?? [], loading, reload };
}

export function useActiveCompany() {
  const activeId = useActiveCompanyId();
  const { companies, loading, reload } = useAllCompanies();
  // The URL slug is the canonical source of truth after the /c/{slug} refactor.
  // Prefer it so that switching between companies (or opening a different
  // tenant in a new tab) reflects the right branding immediately, without
  // waiting for the localStorage active-company id to sync.
  const params = useParams({ strict: false }) as { slug?: string };
  const urlSlug = params?.slug ?? null;

  let company: Company | null = null;
  // 1) Match by URL slug (canonical).
  if (urlSlug) company = companies.find((c) => c.slug === urlSlug) ?? null;
  // 2) Fall back to the explicitly selected active-company id.
  if (!company && activeId) company = companies.find((c) => c.id === activeId) ?? null;
  // 3) Final fallback: single-tenant users where neither URL nor
  //    localStorage tells us which company to use (e.g. signed in via /auth).
  if (!company && companies.length === 1) company = companies[0];

  // If the URL points at a slug we don't have cached, bypass the 30s
  // staleness window so branding for the new tenant loads immediately.
  useEffect(() => {
    if (!urlSlug || loading) return;
    if (!companies.some((c) => c.slug === urlSlug)) reload();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [urlSlug, loading, companies.length]);

  return { company, loading, reload };
}

export function useCompanyModules(companyId: string | null | undefined) {
  const { data, loading, reload } = useSharedResource<CompanyModule[]>(
    `company_modules:${companyId ?? "none"}`,
    async () => {
      if (!companyId) return [];
      const { data } = await supabase.from("company_modules" as any).select("*").eq("company_id", companyId);
      return (data ?? []) as unknown as CompanyModule[];
    },
    { eventName: `company_modules:${companyId ?? "none"}:changed` },
  );
  const rows = data ?? [];
  const isEnabled = useCallback(
    (moduleKey: string) => {
      const row = rows.find((r) => r.module_key === moduleKey);
      return row ? row.enabled : true; // default enabled if no explicit row
    },
    [rows],
  );
  return { modules: rows, loading, isEnabled, reload };
}

export function useCompanyFormats() {
  const { company } = useActiveCompany();
  return {
    timezone: company?.timezone ?? "Asia/Kolkata",
    dateFormat: company?.date_format ?? "dd/MM/yyyy",
    timeFormat: (company?.time_format ?? "12h") as "12h" | "24h",
  };
}