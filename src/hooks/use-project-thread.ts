import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { removeStorageFiles } from "@/lib/storage-delete";

export interface ProjectCommentRow {
  id: string;
  project_id: string;
  author_id: string;
  body: string;
  created_at: string;
}

export interface ProjectAttachmentRow {
  id: string;
  project_id: string;
  uploader_id: string;
  file_name: string;
  storage_path: string;
  size_bytes: number;
  mime_type: string;
  created_at: string;
}

export function useProjectThread(projectId: string | null) {
  const [comments, setComments] = useState<ProjectCommentRow[]>([]);
  const [attachments, setAttachments] = useState<ProjectAttachmentRow[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    if (!projectId) return;
    setLoading(true);
    const [{ data: c, error: e1 }, { data: a, error: e2 }] = await Promise.all([
      supabase.from("project_comments").select("*").eq("project_id", projectId).order("created_at"),
      supabase.from("project_attachments").select("*").eq("project_id", projectId).order("created_at"),
    ]);
    if (e1) toast.error(`Failed to load comments: ${e1.message}`);
    if (e2) toast.error(`Failed to load attachments: ${e2.message}`);
    setComments((c ?? []) as ProjectCommentRow[]);
    setAttachments((a ?? []) as ProjectAttachmentRow[]);
    setLoading(false);
  }, [projectId]);

  useEffect(() => {
    if (!projectId) return;
    load();
    const ch = supabase
      .channel(`project-thread-${projectId}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "project_comments", filter: `project_id=eq.${projectId}` }, () => load())
      .on("postgres_changes", { event: "*", schema: "public", table: "project_attachments", filter: `project_id=eq.${projectId}` }, () => load())
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [projectId, load]);

  const addComment = async (body: string) => {
    if (!projectId || !body.trim()) return;
    const { data: u } = await supabase.auth.getUser();
    if (!u.user) return toast.error("Not signed in");
    const { error } = await supabase.from("project_comments").insert({
      project_id: projectId, author_id: u.user.id, body: body.trim(),
    });
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success("Comment posted");
    await load();
  };

  const deleteComment = async (id: string) => {
    const { error } = await supabase.from("project_comments").delete().eq("id", id);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success("Comment deleted");
    await load();
  };

  const uploadAttachment = async (file: File) => {
    if (!projectId) return;
    const { data: u } = await supabase.auth.getUser();
    if (!u.user) return toast.error("Not signed in");
    const path = `${u.user.id}/${projectId}/${crypto.randomUUID()}-${file.name}`;
    const { error: upErr } = await supabase.storage.from("project-attachments").upload(path, file);
    if (upErr) return toast.error(upErr.message);
    const { error } = await supabase.from("project_attachments").insert({
      project_id: projectId,
      uploader_id: u.user.id,
      file_name: file.name,
      storage_path: path,
      size_bytes: file.size,
      mime_type: file.type || "application/octet-stream",
    });
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success("Attachment uploaded");
    await load();
  };

  const deleteAttachment = async (a: ProjectAttachmentRow) => {
    const { error: dbErr } = await supabase.from("project_attachments").delete().eq("id", a.id);
    if (dbErr) {
      toast.error(dbErr.message);
      return;
    }
    await removeStorageFiles("project-attachments", [a.storage_path]);
    toast.success("Attachment deleted");
    await load();
  };

  const getDownloadUrl = async (path: string) => {
    const { data, error } = await supabase.storage.from("project-attachments").createSignedUrl(path, 60);
    if (error) { toast.error(error.message); return null; }
    return data.signedUrl;
  };

  return { comments, attachments, loading, addComment, deleteComment, uploadAttachment, deleteAttachment, getDownloadUrl };
}
