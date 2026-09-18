import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { uploadTaskAttachments } from "@/lib/task-attachments";
import { removeStorageFiles } from "@/lib/storage-delete";

export interface CommentRow {
  id: string;
  task_id: string;
  author_id: string;
  body: string;
  created_at: string;
}

export interface AttachmentRow {
  id: string;
  task_id: string;
  uploader_id: string;
  file_name: string;
  storage_path: string;
  size_bytes: number;
  mime_type: string;
  created_at: string;
}

export function useTaskThread(taskId: string | null) {
  const [comments, setComments] = useState<CommentRow[]>([]);
  const [attachments, setAttachments] = useState<AttachmentRow[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    if (!taskId) return;
    setLoading(true);
    const [{ data: c, error: e1 }, { data: a, error: e2 }] = await Promise.all([
      supabase.from("task_comments").select("*").eq("task_id", taskId).order("created_at"),
      supabase.from("task_attachments").select("*").eq("task_id", taskId).order("created_at"),
    ]);
    if (e1) toast.error(`Failed to load comments: ${e1.message}`);
    if (e2) toast.error(`Failed to load attachments: ${e2.message}`);
    setComments((c ?? []) as CommentRow[]);
    setAttachments((a ?? []) as AttachmentRow[]);
    setLoading(false);
  }, [taskId]);

  useEffect(() => {
    if (!taskId) return;
    load();
    const ch = supabase
      .channel(`task-thread-${taskId}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "task_comments", filter: `task_id=eq.${taskId}` }, () => load())
      .on("postgres_changes", { event: "*", schema: "public", table: "task_attachments", filter: `task_id=eq.${taskId}` }, () => load())
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [taskId, load]);

  const addComment = async (body: string) => {
    if (!taskId || !body.trim()) return;
    const { data: u } = await supabase.auth.getUser();
    if (!u.user) return toast.error("Not signed in");
    const { error } = await supabase.from("task_comments").insert({
      task_id: taskId, author_id: u.user.id, body: body.trim(),
    });
    if (error) toast.error(error.message);
  };

  const deleteComment = async (id: string) => {
    const { data, error } = await supabase.from("task_comments").delete().eq("id", id).select("id");
    if (error) { toast.error(error.message); return; }
    if (!data || data.length === 0) {
      toast.error("You don't have permission to delete this comment.");
    }
  };

  const uploadAttachment = async (file: File) => {
    if (!taskId) return;
    await uploadTaskAttachments(taskId, [file]);
  };

  const uploadAttachments = async (files: File[], id?: string) => {
    const target = id ?? taskId;
    if (!target) return 0;
    return uploadTaskAttachments(target, files);
  };

  const deleteAttachment = async (a: AttachmentRow) => {
    const { data, error } = await supabase.from("task_attachments").delete().eq("id", a.id).select("id");
    if (error) { toast.error(error.message); return; }
    if (!data || data.length === 0) {
      toast.error("You don't have permission to delete this file.");
      return;
    }
    await removeStorageFiles("task-attachments", [a.storage_path]);
    toast.success("Attachment deleted");
    window.dispatchEvent(new Event("task-attachments:changed"));
  };

  const getDownloadUrl = async (path: string) => {
    const { data, error } = await supabase.storage.from("task-attachments").createSignedUrl(path, 60);
    if (error) { toast.error(error.message); return null; }
    return data.signedUrl;
  };

  return { comments, attachments, loading, addComment, deleteComment, uploadAttachment, uploadAttachments, deleteAttachment, getDownloadUrl };
}
