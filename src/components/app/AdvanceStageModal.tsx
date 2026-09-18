import { useState, useEffect, useMemo } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { EmployeePicker } from "@/components/app/EmployeePicker";
import { useCurrentEmployee } from "@/hooks/use-current-employee";
import { useEmployees } from "@/hooks/use-employees";
import type { LeadStage } from "@/hooks/use-leads";
import { STAGE_LABEL } from "@/hooks/use-leads";
import { Paperclip, X } from "lucide-react";

interface Props {
  open: boolean;
  stage: LeadStage;
  onOpenChange: (v: boolean) => void;
  latestFollowUp?: Record<string, unknown> | null;
  onAdvance: (
    stage: LeadStage,
    data: Record<string, unknown>,
    note: string,
    files: File[],
    extra: { outcome?: "success" | "unsuccess"; final_price?: number | null; close_reason?: string | null },
    employeeId: string | null,
  ) => Promise<unknown>;
}

export function AdvanceStageModal({ open, stage, onOpenChange, latestFollowUp, onAdvance }: Props) {
  const [followDate, setFollowDate] = useState("");
  const [projectName, setProjectName] = useState("");
  const [workDetails, setWorkDetails] = useState("");
  const [quotedPrice, setQuotedPrice] = useState("");
  const [offerPrice, setOfferPrice] = useState("");
  const [outcome, setOutcome] = useState<"success" | "unsuccess">("success");
  const [finalPrice, setFinalPrice] = useState("");
  const [closeReason, setCloseReason] = useState("");
  const [note, setNote] = useState("");
  const [files, setFiles] = useState<File[]>([]);
  const [employeeId, setEmployeeId] = useState<string | null>(null);
  const [editEmployee, setEditEmployee] = useState(false);
  const [saving, setSaving] = useState(false);
  const currentEmployee = useCurrentEmployee();
  const { employees } = useEmployees();
  const employeeName = useMemo(
    () => (employeeId ? employees.find((e) => e.id === employeeId)?.name ?? null : null),
    [employees, employeeId],
  );

  useEffect(() => {
    if (!open) return;
    setNote("");
    setFiles([]);
    setEmployeeId(currentEmployee?.id ?? null);
    setEditEmployee(false);

    const fu = latestFollowUp ?? null;

    if (stage === "follow_up") {
      setFollowDate("");
      // Carry forward any project info already captured
      setProjectName(String(fu?.project_name ?? ""));
      setWorkDetails(String(fu?.project_details ?? fu?.work_details ?? ""));
    } else if (stage === "quoted") {
      // Prefill project name & work details from the latest follow-up.
      setProjectName(String(fu?.project_name ?? ""));
      setWorkDetails(String(fu?.project_details ?? fu?.work_details ?? ""));
      setQuotedPrice("");
      setOfferPrice("");
    } else if (stage === "closed") {
      setOutcome("success");
      setFinalPrice("");
      setCloseReason("");
    }
  }, [open, stage, currentEmployee, latestFollowUp]);


  const submit = async () => {
    setSaving(true);
    let data: Record<string, unknown> = {};
    const extra: { outcome?: "success" | "unsuccess"; final_price?: number | null; close_reason?: string | null } = {};

    if (stage === "follow_up") {
      if (!followDate) {
        setSaving(false);
        return;
      }
      data = {
        follow_up_date: followDate,
        project_name: projectName.trim() || null,
        project_details: workDetails.trim() || null,
      };
    } else if (stage === "quoted") {
      if (!projectName.trim() || !workDetails.trim()) {
        setSaving(false);
        return;
      }
      data = {
        project_name: projectName.trim(),
        work_details: workDetails,
        quoted_price: Number(quotedPrice) || 0,
        offer_price: Number(offerPrice) || 0,
      };

    } else if (stage === "closed") {
      if (outcome === "unsuccess" && !closeReason.trim()) {
        setSaving(false);
        return;
      }
      if (outcome === "success" && !(Number(finalPrice) > 0)) {
        setSaving(false);
        return;
      }
      extra.outcome = outcome;
      extra.final_price = outcome === "success" ? Number(finalPrice) || 0 : null;
      extra.close_reason = outcome === "unsuccess" ? closeReason.trim() : null;
      data = { outcome, final_price: extra.final_price, reason: extra.close_reason };
    }

    const res = await onAdvance(stage, data, note, files, extra, employeeId);
    setSaving(false);
    if (res) onOpenChange(false);
  };

  const addFiles = (list: FileList | null) => {
    if (!list) return;
    const arr = Array.from(list).slice(0, 5);
    const valid = arr.filter((f) => f.size <= 10 * 1024 * 1024);
    setFiles((prev) => [...prev, ...valid].slice(0, 5));
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="bg-background border-border sm:max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Move to {STAGE_LABEL[stage]}</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 py-2">
          {stage === "follow_up" && (
            <>
              <div className="space-y-2">
                <Label>Follow-up date *</Label>
                <Input type="date" value={followDate} onChange={(e) => setFollowDate(e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label>Project name</Label>
                <Input value={projectName} onChange={(e) => setProjectName(e.target.value)} placeholder="Optional — used to prefill the quote" />
              </div>
              <div className="space-y-2">
                <Label>Project details</Label>
                <Textarea value={workDetails} onChange={(e) => setWorkDetails(e.target.value)} rows={3} />
              </div>
            </>
          )}

          {stage === "quoted" && (
            <>
              <div className="space-y-2">
                <Label>Project name *</Label>
                <Input value={projectName} onChange={(e) => setProjectName(e.target.value)} placeholder="e.g. Summer Campaign 2026" />
              </div>
              <div className="space-y-2">
                <Label>Work details *</Label>
                <Textarea value={workDetails} onChange={(e) => setWorkDetails(e.target.value)} rows={3} />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-2">
                  <Label>Quoted price (₹)</Label>
                  <Input type="number" value={quotedPrice} onChange={(e) => setQuotedPrice(e.target.value)} />
                </div>
                <div className="space-y-2">
                  <Label>Offer price (₹)</Label>
                  <Input type="number" value={offerPrice} onChange={(e) => setOfferPrice(e.target.value)} />
                </div>
              </div>
              <div className="space-y-2">
                <Label>Attachments (max 5, 10MB each)</Label>
                <label className="flex items-center gap-2 px-3 py-2 rounded-lg border border-border cursor-pointer hover:bg-muted/30 text-sm">
                  <Paperclip className="w-4 h-4" />
                  <span>Add files</span>
                  <input
                    type="file"
                    multiple
                    className="hidden"
                    onChange={(e) => addFiles(e.target.files)}
                  />
                </label>
                {files.length > 0 && (
                  <ul className="space-y-1">
                    {files.map((f, i) => (
                      <li key={i} className="flex items-center justify-between text-xs glass px-2 py-1.5 rounded">
                        <span className="truncate">{f.name}</span>
                        <button onClick={() => setFiles((p) => p.filter((_, j) => j !== i))}>
                          <X className="w-3 h-3" />
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </>
          )}

          {stage === "closed" && (
            <>
              <div className="space-y-2">
                <Label>Outcome *</Label>
                <RadioGroup value={outcome} onValueChange={(v) => setOutcome(v as "success" | "unsuccess")} className="flex gap-4">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <RadioGroupItem value="success" /> Success
                  </label>
                  <label className="flex items-center gap-2 cursor-pointer">
                    <RadioGroupItem value="unsuccess" /> Unsuccess
                  </label>
                </RadioGroup>
              </div>
              {outcome === "success" && (
                <div className="space-y-2">
                  <Label>Final price (₹) *</Label>
                  <Input type="number" value={finalPrice} onChange={(e) => setFinalPrice(e.target.value)} />
                </div>
              )}
              {outcome === "unsuccess" && (
                <div className="space-y-2">
                  <Label>Reason *</Label>
                  <Textarea
                    value={closeReason}
                    onChange={(e) => setCloseReason(e.target.value)}
                    rows={2}
                    placeholder="Why did this lead not convert?"
                  />
                </div>
              )}
            </>
          )}

          {editEmployee ? (
            <EmployeePicker
              label="Followed by"
              value={employeeId}
              onChange={(v) => {
                setEmployeeId(v);
                setEditEmployee(false);
              }}
              filter={(e) => e.status === "active"}
            />
          ) : (
            <div className="space-y-2">
              <Label>Followed by</Label>
              <div className="flex items-center justify-between gap-2 rounded-md border border-border bg-input px-3 py-2 text-sm">
                <span className="truncate">{employeeName ?? "—"}</span>
                <Button type="button" variant="outline" size="sm" className="h-7" onClick={() => setEditEmployee(true)}>
                  Change
                </Button>
              </div>
            </div>
          )}

          <div className="space-y-2">
            <Label>Note</Label>
            <Textarea value={note} onChange={(e) => setNote(e.target.value)} rows={2} />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button onClick={submit} disabled={saving} className="bg-gradient-primary text-white">
            {saving ? "Saving…" : `Move to ${STAGE_LABEL[stage]}`}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
