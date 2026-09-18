import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useSharedResource, invalidateCache } from "@/lib/shared-cache";
import { subscribeTables } from "@/lib/shared-realtime";
import { removeStorageFiles } from "@/lib/storage-delete";

export type LeadStage = "new_lead" | "follow_up" | "quoted" | "closed";
export type LeadOutcome = "success" | "unsuccess" | null;

export const STAGES: { id: LeadStage; label: string; color: string }[] = [
  { id: "new_lead", label: "New Lead", color: "var(--neon-cyan)" },
  { id: "follow_up", label: "Follow Up", color: "var(--neon-blue)" },
  { id: "quoted", label: "Quoted", color: "var(--neon-purple)" },
  { id: "closed", label: "Closed", color: "var(--neon-pink)" },
];

export const STAGE_LABEL: Record<LeadStage, string> = {
  new_lead: "New Lead",
  follow_up: "Follow Up",
  quoted: "Quoted",
  closed: "Closed",
};

export interface LeadRow {
  id: string;
  company_name: string;
  address: string;
  city: string;
  contact_person: string;
  contact_number: string;
  lead_source: string;
  note: string;
  current_stage: LeadStage;
  outcome: LeadOutcome;
  final_price: number | null;
  close_reason: string | null;
  owner_id: string | null;
  converted_client_id: string | null;
  created_by: string | null;
  captured_by_employee_id: string | null;
  followed_by_employee_id: string | null;
  lead_date: string;
  created_at: string;
  updated_at: string;
  custom_fields: Record<string, unknown>;
}

/** Today's date in the user's local timezone as yyyy-MM-dd. */
export function todayLocalDate(): string {
  const d = new Date();
  const off = d.getTimezoneOffset();
  return new Date(d.getTime() - off * 60000).toISOString().slice(0, 10);
}

export interface LeadStageEntry {
  id: string;
  lead_id: string;
  stage: LeadStage;
  data: Record<string, unknown>;
  note: string;
  created_by: string | null;
  employee_id: string | null;
  created_at: string;
}

export interface NewLeadInput {
  company_name: string;
  address: string;
  city: string;
  contact_person: string;
  contact_number: string;
  lead_source: string;
  note: string;
  lead_date?: string;
  captured_by_employee_id?: string | null;
  followed_by_employee_id?: string | null;
  custom_fields?: Record<string, unknown>;
}


const CACHE_KEY = "leads";

async function fetchLeads(): Promise<LeadRow[]> {
  const { data, error } = await supabase
    .from("leads" as never)
    .select("*")
    .order("lead_date", { ascending: false })
    .order("created_at", { ascending: false });
  if (error) {
    toast.error(`Failed to load leads: ${error.message}`);
    return [];
  }
  return (data ?? []) as unknown as LeadRow[];
}

export function useLeads() {
  const { data, loading, reload } = useSharedResource<LeadRow[]>(
    CACHE_KEY,
    fetchLeads,
  );
  const leads = data ?? [];
  const load = reload;

  useEffect(() => {
    return subscribeTables("leads", ["leads"], () => {
      invalidateCache(CACHE_KEY);
      reload();
    });
  }, [reload]);


  const createLead = async (input: NewLeadInput) => {
    const { data: u } = await supabase.auth.getUser();
    const { captured_by_employee_id, followed_by_employee_id, ...rest } = input;
    const captured = captured_by_employee_id ?? null;
    const followed = followed_by_employee_id ?? captured;
    const { data, error } = await supabase
      .from("leads" as never)
      .insert({
        ...rest,
        lead_date: rest.lead_date || todayLocalDate(),
        captured_by_employee_id: captured,
        followed_by_employee_id: followed,
        current_stage: "new_lead",
        custom_fields: input.custom_fields ?? {},
        created_by: u.user?.id ?? null,
      } as never)
      .select()
      .single();
    if (error) {
      toast.error(error.message);
      return null;
    }
    const lead = data as unknown as LeadRow;
    // first stage entry — if it fails, roll back the lead so we don't leave
    // a lead without any history.
    const { error: entryErr } = await supabase.from("lead_stage_entries" as never).insert({
      lead_id: lead.id,
      stage: "new_lead",
      data: {
        company_name: input.company_name,
        address: input.address,
        contact_person: input.contact_person,
        contact_number: input.contact_number,
        lead_source: input.lead_source,
      },
      note: input.note,
      created_by: u.user?.id ?? null,
      employee_id: captured,
    } as never);
    if (entryErr) {
      await supabase.from("leads" as never).delete().eq("id", lead.id);
      toast.error(`Failed to create lead history — lead removed: ${entryErr.message}`);
      return null;
    }
    toast.success("Lead created");
    await load();
    return lead;
  };

  const updateLead = async (id: string, patch: Partial<LeadRow>) => {
    const normalized = { ...patch };
    if (normalized.lead_date === "" || normalized.lead_date == null) {
      normalized.lead_date = todayLocalDate();
    }
    const { error } = await supabase.from("leads" as never).update(normalized as never).eq("id", id);
    if (error) {
      toast.error(error.message);
      return false;
    }
    await load();
    return true;
  };

  const advanceStage = async (
    leadId: string,
    stage: LeadStage,
    data: Record<string, unknown>,
    note: string,
    files?: File[],
    extra?: Partial<Pick<LeadRow, "outcome" | "final_price" | "close_reason">>,
    employeeId?: string | null,
  ) => {
    const { data: u } = await supabase.auth.getUser();
    const { data: entry, error: e1 } = await supabase
      .from("lead_stage_entries" as never)
      .insert({ lead_id: leadId, stage, data, note, created_by: u.user?.id ?? null, employee_id: employeeId ?? null } as never)
      .select()
      .single();
    if (e1) {
      toast.error(e1.message);
      return false;
    }
    const entryRow = entry as unknown as LeadStageEntry;

    const uploadedPaths: string[] = [];
    const attachmentIds: string[] = [];
    if (files && files.length) {
      for (const f of files) {
        const path = `${leadId}/${Date.now()}-${f.name}`;
        const { error: upErr } = await supabase.storage
          .from("lead-attachments")
          .upload(path, f, { contentType: f.type, upsert: false });
        if (upErr) {
          toast.error(`Upload failed: ${upErr.message}`);
          continue;
        }
        uploadedPaths.push(path);
        const { data: att, error: attErr } = await supabase
          .from("lead_attachments" as never)
          .insert({
            lead_id: leadId,
            stage_entry_id: entryRow.id,
            file_name: f.name,
            storage_path: path,
            mime_type: f.type || "application/octet-stream",
            size_bytes: f.size,
            uploader_id: u.user?.id ?? null,
          } as never)
          .select("id")
          .single();
        if (!attErr && att) attachmentIds.push((att as { id: string }).id);
      }
    }

    const patch: Partial<LeadRow> = { current_stage: stage, ...extra };
    if (employeeId !== undefined) patch.followed_by_employee_id = employeeId;
    const { error: e2 } = await supabase.from("leads" as never).update(patch as never).eq("id", leadId);
    if (e2) {
      // Compensate: roll back attachments (rows + storage objects) and the stage entry
      // so history doesn't claim a move that didn't happen.
      if (attachmentIds.length) {
        await supabase.from("lead_attachments" as never).delete().in("id", attachmentIds);
      }
      if (uploadedPaths.length) {
        await removeStorageFiles("lead-attachments", uploadedPaths);
      }
      await supabase.from("lead_stage_entries" as never).delete().eq("id", entryRow.id);
      toast.error(e2.message);
      return false;
    }
    toast.success(`Moved to ${STAGE_LABEL[stage]}`);
    await load();
    return true;
  };

  const deleteLead = async (leadId: string) => {
    // 1. Collect attachments to remove storage objects
    const { data: atts } = await supabase
      .from("lead_attachments" as never)
      .select("storage_path")
      .eq("lead_id", leadId);
    const paths = ((atts ?? []) as unknown as { storage_path: string }[]).map((a) => a.storage_path);
    if (paths.length) {
      await removeStorageFiles("lead-attachments", paths);
    }
    // 2. Delete rows in dependency order (no FK cascades)
    await supabase.from("lead_attachments" as never).delete().eq("lead_id", leadId);
    await supabase.from("lead_stage_entries" as never).delete().eq("lead_id", leadId);
    const { error } = await supabase.from("leads" as never).delete().eq("id", leadId);
    if (error) {
      toast.error(error.message);
      return false;
    }
    toast.success("Lead deleted");
    await load();
    return true;
  };

  const reopenLead = async (leadId: string) => {
    const { data: u } = await supabase.auth.getUser();
    // Look up current user's employee record to set followed_by.
    let followedBy: string | null = null;
    if (u.user?.id) {
      const { data: emp } = await supabase
        .from("employees")
        .select("id")
        .eq("user_id", u.user.id)
        .maybeSingle();
      followedBy = (emp as { id?: string } | null)?.id ?? null;
    }
    const patch: Record<string, unknown> = {
      current_stage: "follow_up",
      outcome: null,
    };
    if (followedBy) patch.followed_by_employee_id = followedBy;
    const { error: e1 } = await supabase
      .from("leads" as never)
      .update(patch as never)
      .eq("id", leadId);
    if (e1) {
      toast.error(e1.message);
      return false;
    }
    await supabase.from("lead_stage_entries" as never).insert({
      lead_id: leadId,
      stage: "follow_up",
      data: { reopened_from: "closed_unsuccess" },
      note: "Lead reopened",
      created_by: u.user?.id ?? null,
      employee_id: followedBy,
    } as never);
    toast.success("Lead reopened");
    await load();
    return true;
  };

  return { leads, loading, createLead, updateLead, advanceStage, deleteLead, reopenLead, reload: load, refresh: load };
}

export async function updateStageEntry(
  entryId: string,
  patch: { data?: Record<string, unknown>; note?: string },
) {
  const { error } = await supabase
    .from("lead_stage_entries" as never)
    .update(patch as never)
    .eq("id", entryId);
  if (error) {
    toast.error(error.message);
    return false;
  }
  toast.success("Entry updated");
  return true;
}


export function useLeadEntries(leadId: string | undefined) {
  const [entries, setEntries] = useState<LeadStageEntry[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    if (!leadId) return;
    const { data, error } = await supabase
      .from("lead_stage_entries" as never)
      .select("*")
      .eq("lead_id", leadId)
      .order("created_at", { ascending: true });
    if (error) toast.error(error.message);
    else setEntries((data ?? []) as unknown as LeadStageEntry[]);
    setLoading(false);
  }, [leadId]);

  useEffect(() => {
    if (!leadId) return;
    load();
    const ch = supabase
      .channel(`lead-entries-${leadId}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "lead_stage_entries", filter: `lead_id=eq.${leadId}` },
        load,
      )
      .subscribe();
    return () => {
      supabase.removeChannel(ch);
    };
  }, [leadId, load]);

  return { entries, loading, reload: load };
}

export interface LeadAttachmentRow {
  id: string;
  lead_id: string;
  stage_entry_id: string | null;
  file_name: string;
  storage_path: string;
  mime_type: string;
  size_bytes: number;
  uploader_id: string | null;
  created_at: string;
}

export function useLeadAttachments(leadId: string | undefined) {
  const [items, setItems] = useState<LeadAttachmentRow[]>([]);

  const load = useCallback(async () => {
    if (!leadId) return;
    const { data, error } = await supabase
      .from("lead_attachments" as never)
      .select("*")
      .eq("lead_id", leadId)
      .order("created_at", { ascending: false });
    if (error) toast.error(error.message);
    else setItems((data ?? []) as unknown as LeadAttachmentRow[]);
  }, [leadId]);

  useEffect(() => {
    if (!leadId) return;
    load();
    const ch = supabase
      .channel(`lead-att-${leadId}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "lead_attachments", filter: `lead_id=eq.${leadId}` },
        load,
      )
      .subscribe();
    return () => {
      supabase.removeChannel(ch);
    };
  }, [leadId, load]);

  const getSignedUrl = async (path: string) => {
    const { data, error } = await supabase.storage
      .from("lead-attachments")
      .createSignedUrl(path, 3600);
    if (error) {
      toast.error(error.message);
      return null;
    }
    return data.signedUrl;
  };

  return { items, reload: load, getSignedUrl };
}
