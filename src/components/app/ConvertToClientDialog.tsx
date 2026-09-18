import { useEffect, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useClientsData, CLIENT_GROUPS } from "@/hooks/use-clients-data";
import type { LeadRow } from "@/hooks/use-leads";
import { STAGE_LABEL } from "@/hooks/use-leads";
import { useClientGroups } from "@/hooks/use-client-groups";
import { useProjects } from "@/hooks/use-projects";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

interface Props {
  lead: LeadRow;
  open: boolean;
  onOpenChange: (v: boolean) => void;
  onConverted: (clientId: string) => void;
}

async function copyLeadThreadToProject(lead: LeadRow, projectId: string) {
  const { data: userData } = await supabase.auth.getUser();
  const uid = userData.user?.id ?? null;
  if (!uid) return;

  // Header marker
  await supabase.from("project_comments").insert({
    project_id: projectId,
    author_id: uid,
    body: `Linked from lead: ${lead.company_name}`,
  });

  // Follow-up activities → project_comments
  const { data: entries } = await supabase
    .from("lead_stage_entries" as never)
    .select("stage, note, data, created_at")
    .eq("lead_id", lead.id)
    .order("created_at", { ascending: true });
  const rows = (entries ?? []) as unknown as Array<{
    stage: keyof typeof STAGE_LABEL;
    note: string | null;
    data: Record<string, unknown> | null;
    created_at: string;
  }>;
  for (const e of rows) {
    const dataLines = e.data
      ? Object.entries(e.data)
          .filter(([, v]) => v !== null && v !== "" && v !== undefined)
          .map(([k, v]) => `${k}: ${String(v)}`)
          .join("\n")
      : "";
    const noteText = (e.note ?? "").trim();
    const bodyParts = [
      `[From lead · ${STAGE_LABEL[e.stage] ?? e.stage}]`,
      noteText,
      dataLines,
      `— logged ${new Date(e.created_at).toLocaleString()}`,
    ].filter(Boolean);
    await supabase.from("project_comments").insert({
      project_id: projectId,
      author_id: uid,
      body: bodyParts.join("\n"),
    });
  }

  // Attachments → copy storage + project_attachments rows
  const { data: atts } = await supabase
    .from("lead_attachments" as never)
    .select("file_name, storage_path, mime_type, size_bytes")
    .eq("lead_id", lead.id)
    .order("created_at", { ascending: true });
  const attRows = (atts ?? []) as unknown as Array<{
    file_name: string;
    storage_path: string;
    mime_type: string;
    size_bytes: number;
  }>;
  for (const a of attRows) {
    try {
      const { data: blob, error: dlErr } = await supabase.storage
        .from("lead-attachments")
        .download(a.storage_path);
      if (dlErr || !blob) {
        console.warn(`Skipping attachment ${a.file_name}: ${dlErr?.message ?? "no data"}`);
        continue;
      }
      const newPath = `${uid}/${projectId}/from-lead/${Date.now()}-${a.file_name}`;
      const { error: upErr } = await supabase.storage
        .from("project-attachments")
        .upload(newPath, blob, { contentType: a.mime_type, upsert: false });
      if (upErr) {
        console.warn(`Upload failed for ${a.file_name}: ${upErr.message}`);
        continue;
      }
      await supabase.from("project_attachments").insert({
        project_id: projectId,
        uploader_id: uid,
        file_name: a.file_name,
        storage_path: newPath,
        size_bytes: a.size_bytes,
        mime_type: a.mime_type,
      });
    } catch (err) {
      console.warn(`Failed to copy lead attachment ${a.file_name}`, err);
    }
  }
}

export function ConvertToClientDialog({ lead, open, onOpenChange, onConverted }: Props) {
  const { addClient, deleteClient } = useClientsData();
  const { groups } = useClientGroups();
  const { addProject } = useProjects();
  const [group, setGroup] = useState(CLIENT_GROUPS[0]);
  const [finalPrice, setFinalPrice] = useState<string>("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (open) setFinalPrice(lead.final_price != null ? String(lead.final_price) : "");
  }, [open, lead.final_price]);

  const submit = async () => {
    const fp = Number(finalPrice);
    if (!(fp > 0)) {
      toast.error("Final price is required");
      return;
    }
    setSaving(true);
    const id = await addClient({
      name: lead.company_name,
      status: "active",
      client_group: group,
      address: lead.address ?? "",
      city: "",
      contact_person: lead.contact_person ?? "",
      contact_number: lead.contact_number ?? "",
      note: lead.note ?? "",
      custom_fields: {},
    });
    if (!id) {
      setSaving(false);
      return;
    }

    try {
      // Materialize project from latest quoted entry
      const { data: qe } = await supabase
        .from("lead_stage_entries" as never)
        .select("data")
        .eq("lead_id", lead.id)
        .eq("stage", "quoted")
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      const qd = ((qe as { data?: Record<string, unknown> } | null)?.data ?? {}) as Record<string, unknown>;
      const projectName =
        (typeof qd.project_name === "string" && qd.project_name.trim()) ||
        `${lead.company_name} — Project`;
      const quotedPrice = qd.quoted_price != null ? Number(qd.quoted_price) : null;
      const workDetails =
        (typeof qd.work_details === "string" && qd.work_details.trim()) ||
        `Converted from lead ${lead.company_name}`;
      const newProjectId = await addProject({
        client_id: id,
        name: projectName,
        start_date: null,
        deadline_date: null,
        status: lead.outcome === "success" ? "active" : "not_started",
        priority: "medium",
        custom_fields: {},
        quoted_price: quotedPrice,
        final_price: fp,
        work_details: workDetails,
        department_ids: [],
      });

      if (!newProjectId) {
        await deleteClient(id);
        toast.error("Project creation failed — conversion cancelled");
        setSaving(false);
        return;
      }

      await copyLeadThreadToProject(lead, newProjectId);

      onConverted(id);
      onOpenChange(false);
    } catch (err) {
      console.error("Lead conversion failed after client create", err);
      await deleteClient(id);
      toast.error("Project creation failed — conversion cancelled");
    }
    setSaving(false);
  };


  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="bg-background border-border sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Convert to Client</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 py-2">
          <div className="text-sm text-muted-foreground">
            Creating a client from <span className="text-foreground font-medium">{lead.company_name}</span>.
          </div>
          <div className="space-y-2">
            <Label>Client group</Label>
            <Select value={group} onValueChange={setGroup}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {(groups.length ? groups.map((g) => g.name) : CLIENT_GROUPS).map((g) => (
                  <SelectItem key={g} value={g}>{g}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>Final price (₹) *</Label>
            <Input
              type="number"
              value={finalPrice}
              onChange={(e) => setFinalPrice(e.target.value)}
              placeholder="Project final price"
            />
            <p className="text-xs text-muted-foreground">
              Carried over from the lead. Required to create the project.
            </p>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button
            onClick={submit}
            disabled={saving || !(Number(finalPrice) > 0)}
            className="bg-gradient-primary text-white"
          >
            {saving ? "Converting…" : "Convert"}

          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
