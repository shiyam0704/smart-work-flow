import type { LeadRow } from "@/hooks/use-leads";
import { STAGE_LABEL } from "@/hooks/use-leads";
import type { StageMeta } from "@/components/app/LeadCard";
import { exportRowsAsCsv } from "@/lib/csv";

export function exportLeadsCsv(
  leads: LeadRow[],
  opts: {
    employeeName?: (id: string | null) => string;
    stageMeta?: Record<string, StageMeta>;
    filename?: string;
  } = {},
) {
  const empName = opts.employeeName ?? (() => "");
  const meta = opts.stageMeta ?? {};
  exportRowsAsCsv(opts.filename ?? "leads", leads, [
    { key: "lead_date", label: "Lead date", value: (r) => r.lead_date ?? "" },
    { key: "company_name", label: "Company", value: (r) => r.company_name },
    { key: "contact_person", label: "Contact", value: (r) => r.contact_person },
    { key: "contact_number", label: "Phone", value: (r) => r.contact_number },
    { key: "address", label: "Address", value: (r) => r.address },
    { key: "city", label: "City", value: (r) => r.city },
    { key: "lead_source", label: "Source", value: (r) => r.lead_source },
    { key: "current_stage", label: "Stage", value: (r) => STAGE_LABEL[r.current_stage] },
    { key: "outcome", label: "Outcome", value: (r) => r.outcome ?? "" },
    { key: "final_price", label: "Final price", value: (r) => r.final_price ?? "" },
    { key: "close_reason", label: "Close reason", value: (r) => r.close_reason ?? "" },
    { key: "follow_up", label: "Next follow-up", value: (r) => meta[r.id]?.follow_up_date ?? "" },
    { key: "quoted_price", label: "Quoted price", value: (r) => meta[r.id]?.quoted_price ?? "" },
    { key: "captured_by", label: "Captured by", value: (r) => empName(r.captured_by_employee_id) },
    { key: "followed_by", label: "Followed by", value: (r) => empName(r.followed_by_employee_id) },
    { key: "note", label: "Note", value: (r) => r.note },
    { key: "created_at", label: "Created", value: (r) => r.created_at },
    { key: "updated_at", label: "Updated", value: (r) => r.updated_at },
  ]);
}