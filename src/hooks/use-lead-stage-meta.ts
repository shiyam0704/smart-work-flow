import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import type { LeadRow, LeadStage } from "@/hooks/use-leads";
import type { StageMeta } from "@/components/app/LeadCard";

export function useLeadStageMeta(leads: LeadRow[]) {
  const [stageMeta, setStageMeta] = useState<Record<string, StageMeta>>({});
  const key = leads.map((l) => `${l.id}:${l.current_stage}`).join("|");

  useEffect(() => {
    let alive = true;
    (async () => {
      const { data, error } = await supabase
        .from("lead_stage_entries" as never)
        .select("lead_id, stage, data, created_at")
        .order("created_at", { ascending: false });
      if (error || !alive) return;
      const map: Record<string, StageMeta> = {};
      for (const row of (data ?? []) as unknown as Array<{
        lead_id: string;
        stage: LeadStage;
        data: Record<string, unknown>;
      }>) {
        const cur = map[row.lead_id] ?? {};
        if (row.stage === "follow_up" && cur.follow_up_date === undefined) {
          const d = row.data?.follow_up_date;
          if (typeof d === "string") cur.follow_up_date = d;
        }
        if (row.stage === "quoted" && cur.quoted_price === undefined) {
          const p = row.data?.quoted_price;
          if (typeof p === "number") cur.quoted_price = p;
        }
        map[row.lead_id] = cur;
      }
      setStageMeta(map);
    })();
    return () => {
      alive = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);

  return stageMeta;
}
