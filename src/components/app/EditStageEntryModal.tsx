import { useEffect, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import type { LeadStageEntry, LeadStage } from "@/hooks/use-leads";
import { STAGE_LABEL } from "@/hooks/use-leads";

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  entry: LeadStageEntry | null;
  onSave: (
    entry: LeadStageEntry,
    patch: { data: Record<string, unknown>; note: string },
    closedExtras?: { outcome: "success" | "unsuccess"; final_price: number | null; close_reason: string | null },
  ) => Promise<unknown>;
}

export function EditStageEntryModal({ open, onOpenChange, entry, onSave }: Props) {
  const [followDate, setFollowDate] = useState("");
  const [projectName, setProjectName] = useState("");
  const [workDetails, setWorkDetails] = useState("");
  const [quotedPrice, setQuotedPrice] = useState("");
  const [offerPrice, setOfferPrice] = useState("");
  const [outcome, setOutcome] = useState<"success" | "unsuccess">("success");
  const [finalPrice, setFinalPrice] = useState("");
  const [closeReason, setCloseReason] = useState("");
  const [note, setNote] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open || !entry) return;
    const d = entry.data ?? {};
    setFollowDate(String(d.follow_up_date ?? ""));
    setProjectName(String(d.project_name ?? ""));
    // For follow-up the field is project_details; for quoted it's work_details
    setWorkDetails(String(d.work_details ?? d.project_details ?? ""));
    setQuotedPrice(d.quoted_price != null ? String(d.quoted_price) : "");
    setOfferPrice(d.offer_price != null ? String(d.offer_price) : "");
    setOutcome((d.outcome as "success" | "unsuccess") ?? "success");
    setFinalPrice(d.final_price != null ? String(d.final_price) : "");
    setCloseReason(typeof d.reason === "string" ? d.reason : "");
    setNote(entry.note ?? "");
  }, [open, entry]);


  if (!entry) return null;
  const stage: LeadStage = entry.stage;

  const submit = async () => {
    setSaving(true);
    let data: Record<string, unknown> = entry.data ?? {};
    let closedExtras: { outcome: "success" | "unsuccess"; final_price: number | null; close_reason: string | null } | undefined;

    if (stage === "follow_up") {
      if (!followDate) { setSaving(false); return; }
      data = {
        ...data,
        follow_up_date: followDate,
        project_name: projectName.trim() || null,
        project_details: workDetails.trim() || null,
      };
    } else if (stage === "quoted") {
      if (!projectName.trim() || !workDetails.trim()) { setSaving(false); return; }
      data = {
        ...data,
        project_name: projectName.trim(),
        work_details: workDetails,
        quoted_price: Number(quotedPrice) || 0,
        offer_price: Number(offerPrice) || 0,
      };

    } else if (stage === "closed") {
      if (outcome === "unsuccess" && !closeReason.trim()) { setSaving(false); return; }
      if (outcome === "success" && !(Number(finalPrice) > 0)) { setSaving(false); return; }
      const fp = outcome === "success" ? (Number(finalPrice) || 0) : null;
      const reason = outcome === "unsuccess" ? closeReason.trim() : null;
      data = { ...data, outcome, final_price: fp, reason };
      closedExtras = { outcome, final_price: fp, close_reason: reason };
    }

    const ok = await onSave(entry, { data, note }, closedExtras);
    setSaving(false);
    if (ok) onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="bg-background border-border sm:max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Edit {STAGE_LABEL[stage]} entry</DialogTitle>
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
                <Input value={projectName} onChange={(e) => setProjectName(e.target.value)} />
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
                  <Textarea value={closeReason} onChange={(e) => setCloseReason(e.target.value)} rows={2} />
                </div>
              )}
            </>
          )}

          <div className="space-y-2">
            <Label>Note</Label>
            <Textarea value={note} onChange={(e) => setNote(e.target.value)} rows={2} />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button onClick={submit} disabled={saving} className="bg-gradient-primary text-white">
            {saving ? "Saving…" : "Save changes"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
