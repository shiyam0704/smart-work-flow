import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export const MAX_ATTACHMENT_BYTES = 25 * 1024 * 1024; // 25 MB per file
export const BUCKET = "task-attachments";

export function isVoiceNote(mime: string, fileName: string) {
  return mime.startsWith("audio/") || /^voice note/i.test(fileName);
}

export function formatSize(b: number) {
  if (b < 1024) return `${b} B`;
  if (b < 1024 * 1024) return `${(b / 1024).toFixed(1)} KB`;
  return `${(b / 1024 / 1024).toFixed(1)} MB`;
}

/**
 * Upload files to the task-attachments bucket and register them on a task.
 * Returns the number of files stored successfully.
 */
export async function uploadTaskAttachments(taskId: string, files: File[]): Promise<number> {
  if (!taskId || files.length === 0) return 0;
  const { data: u } = await supabase.auth.getUser();
  if (!u.user) {
    toast.error("Not signed in");
    return 0;
  }
  let stored = 0;
  for (const file of files) {
    if (file.size > MAX_ATTACHMENT_BYTES) {
      toast.error(`${file.name} is larger than ${formatSize(MAX_ATTACHMENT_BYTES)}`);
      continue;
    }
    const safeName = file.name.replace(/[^\w.\- ]+/g, "_");
    const path = `${u.user.id}/${taskId}/${crypto.randomUUID()}-${safeName}`;
    const { error: upErr } = await supabase.storage
      .from(BUCKET)
      .upload(path, file, { contentType: file.type || "application/octet-stream" });
    if (upErr) {
      toast.error(`${file.name}: ${upErr.message}`);
      continue;
    }
    const { error } = await supabase.from("task_attachments").insert({
      task_id: taskId,
      uploader_id: u.user.id,
      file_name: file.name,
      storage_path: path,
      size_bytes: file.size,
      mime_type: file.type || "application/octet-stream",
    });
    if (error) {
      toast.error(`${file.name}: ${error.message}`);
      continue;
    }
    stored += 1;
  }
  if (stored) window.dispatchEvent(new Event("task-attachments:changed"));
  return stored;
}
