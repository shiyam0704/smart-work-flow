import { useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useSharedResource } from "@/lib/shared-cache";

export type AttachmentCounts = Record<string, { files: number; voice: number }>;

const KEY = "task-attachment-counts";

async function fetchCounts(): Promise<AttachmentCounts> {
  const { data, error } = await supabase
    .from("task_attachments")
    .select("task_id,mime_type,file_name");
  if (error) return {};
  const out: AttachmentCounts = {};
  for (const row of (data ?? []) as { task_id: string; mime_type: string; file_name: string }[]) {
    const bucket = (out[row.task_id] ??= { files: 0, voice: 0 });
    const voice = (row.mime_type ?? "").startsWith("audio/") || /^voice note/i.test(row.file_name ?? "");
    if (voice) bucket.voice += 1;
    else bucket.files += 1;
  }
  return out;
}

/** Counts of files and voice notes per task, for list and board rows. */
export function useTaskAttachmentCounts() {
  const { data, reload } = useSharedResource<AttachmentCounts>(KEY, fetchCounts, { staleMs: 30_000 });

  useEffect(() => {
    const onChanged = () => { void reload(); };
    window.addEventListener("task-attachments:changed", onChanged);
    return () => window.removeEventListener("task-attachments:changed", onChanged);
  }, [reload]);

  return { counts: data ?? {} };
}
