import { useMemo, useState } from "react";
import { CLink as Link } from "@/lib/nav";
import { Phone, MessageCircle, ArrowUp, ArrowDown, Trash2, Download, UserCog, ChevronRight, X } from "lucide-react";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Checkbox } from "@/components/ui/checkbox";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { formatINR } from "@/lib/format";
import { cn } from "@/lib/utils";
import { STAGE_LABEL, STAGES, type LeadRow, type LeadStage } from "@/hooks/use-leads";
import type { StageMeta } from "@/components/app/LeadCard";
import { toast } from "sonner";

type SortKey = "company" | "stage" | "owner" | "updated";

interface Employee { id: string; name: string; role?: string; status?: string }

interface Props {
  leads: LeadRow[];
  stageMeta: Record<string, StageMeta>;
  employees: Employee[];
  canManage: boolean;
  onExportSelected: (ids: string[]) => void;
  onBulkReassign: (ids: string[], employeeId: string | null) => Promise<void>;
  onBulkDelete: (ids: string[]) => Promise<void>;
  onOpenAdvance: (leadId: string, stage: LeadStage) => void;
}

function phoneNorm(v: string) {
  const d = (v ?? "").replace(/[^\d+]/g, "");
  return { digits: d, wa: d.replace(/^\+/, "") };
}

export function LeadsListView({
  leads, stageMeta, employees, canManage,
  onExportSelected, onBulkReassign, onBulkDelete, onOpenAdvance,
}: Props) {
  const [sortKey, setSortKey] = useState<SortKey>("updated");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [reassignOpen, setReassignOpen] = useState(false);
  const [reassignId, setReassignId] = useState<string>("");
  const [deleteOpen, setDeleteOpen] = useState(false);

  const empName = useMemo(() => {
    const m = new Map<string, string>();
    for (const e of employees) m.set(e.id, e.name);
    return (id: string | null) => (id ? m.get(id) ?? "—" : "—");
  }, [employees]);

  const rows = useMemo(() => {
    const filtered = leads.filter((l) => !(l.current_stage === "closed" && l.converted_client_id));
    const cmp = (a: LeadRow, b: LeadRow) => {
      let av: string; let bv: string;
      switch (sortKey) {
        case "company": av = a.company_name; bv = b.company_name; break;
        case "stage": av = a.current_stage; bv = b.current_stage; break;
        case "owner": av = empName(a.followed_by_employee_id); bv = empName(b.followed_by_employee_id); break;
        default: av = a.lead_date || a.created_at; bv = b.lead_date || b.created_at;
      }
      const r = av.localeCompare(bv);
      return sortDir === "asc" ? r : -r;
    };
    return [...filtered].sort(cmp);
  }, [leads, sortKey, sortDir, empName]);

  const allChecked = rows.length > 0 && rows.every((r) => selected.has(r.id));
  const someChecked = selected.size > 0 && !allChecked;

  function toggleAll(v: boolean) {
    if (v) setSelected(new Set(rows.map((r) => r.id)));
    else setSelected(new Set());
  }
  function toggle(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  }
  function setSort(k: SortKey) {
    if (k === sortKey) setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    else { setSortKey(k); setSortDir("asc"); }
  }

  const selIds = Array.from(selected);
  const stageColor = (id: LeadStage) => STAGES.find((s) => s.id === id)?.color ?? "";

  return (
    <div className="space-y-3">
      <div className="glass rounded-xl border border-glass-border overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-10">
                <Checkbox
                  checked={allChecked ? true : someChecked ? "indeterminate" : false}
                  onCheckedChange={(v) => toggleAll(!!v)}
                  aria-label="Select all"
                />
              </TableHead>
              <SortableHead label="Company" k="company" sortKey={sortKey} sortDir={sortDir} onClick={setSort} />
              <TableHead>Contact</TableHead>
              <SortableHead label="Stage" k="stage" sortKey={sortKey} sortDir={sortDir} onClick={setSort} />
              <SortableHead label="Owner" k="owner" sortKey={sortKey} sortDir={sortDir} onClick={setSort} />
              <TableHead>Details</TableHead>
              <SortableHead label="Lead date" k="updated" sortKey={sortKey} sortDir={sortDir} onClick={setSort} />
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.length === 0 && (
              <TableRow><TableCell colSpan={7} className="text-center text-sm text-muted-foreground py-10">No leads</TableCell></TableRow>
            )}
            {rows.map((l) => {
              const phone = phoneNorm(l.contact_number);
              const meta = stageMeta[l.id] ?? {};
              return (
                <TableRow key={l.id} className="cursor-pointer" data-state={selected.has(l.id) ? "selected" : undefined}>
                  <TableCell onClick={(e) => e.stopPropagation()}>
                    <Checkbox checked={selected.has(l.id)} onCheckedChange={() => toggle(l.id)} aria-label={`Select ${l.company_name}`} />
                  </TableCell>
                  <TableCell className="font-medium">
                    <Link to="/c/$slug/leads/$leadId" params={{ leadId: l.id }} className="hover:text-primary">
                      {l.company_name}
                    </Link>
                  </TableCell>
                  <TableCell className="text-xs">
                    <div className="flex items-center gap-2 min-w-0" onClick={(e) => e.stopPropagation()}>
                      <span className="truncate">
                        {l.contact_person && <span className="text-muted-foreground">{l.contact_person} </span>}
                        {l.contact_number && <span>{l.contact_number}</span>}
                      </span>
                      {l.contact_number && (
                        <span className="flex items-center gap-1 shrink-0">
                          <a href={`tel:${phone.digits}`} className="inline-flex items-center justify-center w-6 h-6 rounded-md bg-primary/15 text-primary hover:bg-primary/25" aria-label="Call"><Phone className="w-3 h-3" /></a>
                          <a href={`https://wa.me/${phone.wa}`} target="_blank" rel="noopener noreferrer" className="inline-flex items-center justify-center w-6 h-6 rounded-md bg-emerald-500/15 text-emerald-400 hover:bg-emerald-500/25" aria-label="WhatsApp"><MessageCircle className="w-3 h-3" /></a>
                        </span>
                      )}
                    </div>
                  </TableCell>
                  <TableCell>
                    <span className="inline-flex items-center gap-1.5 text-xs">
                      <span className="w-2 h-2 rounded-full" style={{ background: stageColor(l.current_stage) }} />
                      {STAGE_LABEL[l.current_stage]}
                    </span>
                  </TableCell>
                  <TableCell className="text-xs text-muted-foreground">{empName(l.followed_by_employee_id)}</TableCell>
                  <TableCell className="text-xs">
                    {l.current_stage === "new_lead" && (l.lead_source || "—")}
                    {l.current_stage === "follow_up" && (meta.follow_up_date ? new Date(meta.follow_up_date).toLocaleDateString() : "—")}
                    {l.current_stage === "quoted" && (meta.quoted_price != null ? formatINR(meta.quoted_price) : "—")}
                    {l.current_stage === "closed" && (
                      <span className={cn(l.outcome === "success" ? "text-emerald-400" : "text-red-400")}>
                        {l.outcome === "success"
                          ? (l.final_price != null ? formatINR(l.final_price) : "Success")
                          : (l.close_reason || "Unsuccess")}
                      </span>
                    )}
                  </TableCell>
                  <TableCell className="text-xs text-muted-foreground">
                    {new Date(l.lead_date || l.created_at).toLocaleDateString()}
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </div>

      {selIds.length > 0 && (
        <div className="sticky bottom-4 z-20 mx-auto max-w-3xl glass-strong border border-glass-border rounded-xl px-4 py-2.5 flex items-center gap-3 shadow-lg">
          <span className="text-sm font-medium">{selIds.length} selected</span>
          <div className="flex-1" />
          {canManage && (
            <Select onValueChange={(v) => onOpenAdvance(selIds[0], v as LeadStage)}>
              <SelectTrigger className="h-8 w-40 text-xs"><SelectValue placeholder="Advance…" /></SelectTrigger>
              <SelectContent>
                {STAGES.filter((s) => s.id !== "new_lead").map((s) => (
                  <SelectItem key={s.id} value={s.id}>
                    <ChevronRight className="inline w-3 h-3 mr-1" />{s.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
          {canManage && (
            <Button size="sm" variant="outline" className="h-8" onClick={() => { setReassignId(""); setReassignOpen(true); }}>
              <UserCog className="w-3.5 h-3.5 mr-1" /> Reassign
            </Button>
          )}
          <Button size="sm" variant="outline" className="h-8" onClick={() => onExportSelected(selIds)}>
            <Download className="w-3.5 h-3.5 mr-1" /> Export
          </Button>
          {canManage && (
            <Button size="sm" variant="outline" className="h-8 text-destructive" onClick={() => setDeleteOpen(true)}>
              <Trash2 className="w-3.5 h-3.5 mr-1" /> Delete
            </Button>
          )}
          <button onClick={() => setSelected(new Set())} className="text-muted-foreground hover:text-foreground" aria-label="Clear selection">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      <Dialog open={reassignOpen} onOpenChange={setReassignOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader><DialogTitle>Reassign {selIds.length} leads</DialogTitle></DialogHeader>
          <div className="py-2">
            <Select value={reassignId} onValueChange={setReassignId}>
              <SelectTrigger><SelectValue placeholder="Select employee" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="__none__">Unassigned</SelectItem>
                {employees
                  .filter((e) => e.status === "active")
                  .map((e) => (<SelectItem key={e.id} value={e.id}>{e.name}</SelectItem>))}
              </SelectContent>
            </Select>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setReassignOpen(false)}>Cancel</Button>
            <Button
              disabled={!reassignId}
              onClick={async () => {
                setReassignOpen(false);
                await onBulkReassign(selIds, reassignId === "__none__" ? null : reassignId);
                toast.success("Reassigned");
                setSelected(new Set());
              }}
            >Reassign</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete {selIds.length} leads?</AlertDialogTitle>
            <AlertDialogDescription>
              This permanently deletes the selected leads, their history and attachments. This cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={async () => {
                setDeleteOpen(false);
                await onBulkDelete(selIds);
                setSelected(new Set());
              }}
            >Delete all</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

function SortableHead({
  label, k, sortKey, sortDir, onClick,
}: {
  label: string; k: SortKey; sortKey: SortKey; sortDir: "asc" | "desc"; onClick: (k: SortKey) => void;
}) {
  const active = k === sortKey;
  return (
    <TableHead>
      <button className="inline-flex items-center gap-1 hover:text-foreground" onClick={() => onClick(k)}>
        {label}
        {active && (sortDir === "asc" ? <ArrowUp className="w-3 h-3" /> : <ArrowDown className="w-3 h-3" />)}
      </button>
    </TableHead>
  );
}