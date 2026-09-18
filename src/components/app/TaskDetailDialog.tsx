import { useEffect, useRef, useState } from "react";
import { useCanManage } from "@/hooks/use-permissions";
import { format, formatDistanceToNow } from "date-fns";
import { Paperclip, Send, Trash2, Download, FileIcon, MessageSquare, Mic, Pencil } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useTaskThread } from "@/hooks/use-task-thread";
import { useEmployees } from "@/hooks/use-employees";
import { useProfileNames } from "@/hooks/use-profile-names";
import { useAuth } from "@/hooks/use-auth";
import { StatusBadge, PriorityBadge } from "@/components/app/StatusBadge";
import { useConfirm } from "@/components/app/confirm-dialog";
import { VoiceNoteRecorder } from "@/components/app/VoiceNoteRecorder";
import { isVoiceNote, formatSize } from "@/lib/task-attachments";
import type { TaskRow } from "@/hooks/use-tasks";
import { useTaskModal } from "@/components/app/NewTaskModal";

export function TaskDetailDialog({ task, open, onOpenChange }: { task: TaskRow | null; open: boolean; onOpenChange: (v: boolean) => void }) {
  const { user, isAdmin } = useAuth();
  const canManageTasks = useCanManage("tasks");
  const { openEdit } = useTaskModal();
  const { employees } = useEmployees();
  const { nameByUserId } = useProfileNames();
  const { comments, attachments, addComment, deleteComment, uploadAttachment, deleteAttachment, getDownloadUrl } = useTaskThread(task?.id ?? null);
  const [draft, setDraft] = useState("");
  const confirm = useConfirm();
  const fileRef = useRef<HTMLInputElement>(null);
  const [audioUrls, setAudioUrls] = useState<Record<string, string>>({});

  const voiceRows = attachments.filter((a) => isVoiceNote(a.mime_type, a.file_name));

  useEffect(() => {
    let cancelled = false;
    const missing = voiceRows.filter((a) => !audioUrls[a.id]);
    if (missing.length === 0) return;
    (async () => {
      const entries: [string, string][] = [];
      for (const a of missing) {
        const url = await getDownloadUrl(a.storage_path);
        if (url) entries.push([a.id, url]);
      }
      if (!cancelled && entries.length) {
        setAudioUrls((cur) => ({ ...cur, ...Object.fromEntries(entries) }));
      }
    })();
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [attachments]);

  const authorName = (id: string) =>
    employees.find((e) => e.user_id === id)?.name ?? nameByUserId(id) ?? "Unknown";
  const canManage = isAdmin || canManageTasks;

  const onSend = async () => {
    if (!draft.trim()) return;
    await addComment(draft);
    setDraft("");
  };

  const onPickFiles = async (files: FileList | null) => {
    if (!files) return;
    for (const f of Array.from(files)) await uploadAttachment(f);
    if (fileRef.current) fileRef.current.value = "";
  };

  const download = async (path: string, name: string) => {
    const url = await getDownloadUrl(path);
    if (!url) return;
    const a = document.createElement("a");
    a.href = url; a.download = name; a.target = "_blank"; a.rel = "noopener";
    document.body.appendChild(a); a.click(); a.remove();
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[85vh] flex flex-col">
        <DialogHeader>
          <div className="flex flex-wrap items-center justify-between gap-2 pr-6">
            <DialogTitle className="flex items-center gap-3 truncate">
              <span className="truncate">{task?.title ?? "Task"}</span>
              {task && <PriorityBadge priority={task.priority} />}
              {task && <StatusBadge statusId={task.status_id} />}
            </DialogTitle>
            {task && canManage && (
              <Button
                variant="outline"
                size="sm"
                className="h-8 gap-1.5 shrink-0"
                onClick={() => {
                  onOpenChange(false);
                  openEdit(task);
                }}
              >
                <Pencil className="w-3.5 h-3.5" />
                <span>Edit Task</span>
              </Button>
            )}
          </div>
        </DialogHeader>

        {task?.description && (
          <p className="text-sm text-muted-foreground border-b border-border pb-3">{task.description}</p>
        )}

        <ScrollArea className="flex-1 -mx-6 px-6">
          <div className="space-y-5 py-2">
            <section>
              <div className="flex items-center gap-2 text-xs font-semibold text-muted-foreground mb-2">
                <Paperclip className="w-3.5 h-3.5" /> Attachments ({attachments.length})
              </div>
              {attachments.length === 0 ? (
                <div className="text-xs text-muted-foreground">No files yet.</div>
              ) : (
                <ul className="space-y-1.5">
                  {attachments.map((a) => {
                    const canDelete = a.uploader_id === user?.id || canManage;
                    return (
                      <li key={a.id} className="flex items-center gap-2 p-2 rounded-md glass">
                        {isVoiceNote(a.mime_type, a.file_name) ? (
                          <Mic className="w-4 h-4 text-muted-foreground shrink-0" />
                        ) : (
                          <FileIcon className="w-4 h-4 text-muted-foreground shrink-0" />
                        )}
                        <div className="flex-1 min-w-0">
                          <div className="text-sm truncate">{a.file_name}</div>
                          {isVoiceNote(a.mime_type, a.file_name) && audioUrls[a.id] && (
                            <audio controls src={audioUrls[a.id]} className="h-8 w-full max-w-[260px] my-1" />
                          )}
                          <div className="text-[10px] text-muted-foreground">
                            {formatSize(a.size_bytes)} · {authorName(a.uploader_id)} · {formatDistanceToNow(new Date(a.created_at), { addSuffix: true })}
                          </div>
                        </div>
                        <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => download(a.storage_path, a.file_name)} aria-label={`Download ${a.file_name}`}>
                          <Download className="w-3.5 h-3.5" />
                        </Button>
                        {canDelete && (
                          <Button size="icon" variant="ghost" className="h-7 w-7 text-destructive" onClick={async () => { if (await confirm({ title: `Delete "${a.file_name}"?`, requireType: "DELETE" })) deleteAttachment(a); }} aria-label={`Delete ${a.file_name}`}>
                            <Trash2 className="w-3.5 h-3.5" />
                          </Button>
                        )}
                      </li>
                    );
                  })}
                </ul>
              )}
            </section>

            <section>
              <div className="flex items-center gap-2 text-xs font-semibold text-muted-foreground mb-2">
                <MessageSquare className="w-3.5 h-3.5" /> Comments ({comments.length})
              </div>
              {comments.length === 0 ? (
                <div className="text-xs text-muted-foreground">Be the first to comment.</div>
              ) : (
                <ul className="space-y-3">
                  {comments.map((c) => {
                    const canDelete = c.author_id === user?.id || canManage;
                    return (
                      <li key={c.id} className="flex gap-3">
                        <div className="w-8 h-8 rounded-full bg-gradient-accent text-white text-xs font-bold flex items-center justify-center shrink-0">
                          {authorName(c.author_id).slice(0, 2).toUpperCase()}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 text-xs text-muted-foreground">
                            <span className="font-medium text-foreground">{authorName(c.author_id)}</span>
                            <span>{format(new Date(c.created_at), "MMM d, p")}</span>
                            {canDelete && (
                              <button onClick={async () => { if (await confirm({ title: "Delete this comment?", requireType: "DELETE" })) deleteComment(c.id); }} className="ml-auto text-destructive hover:underline">delete</button>
                            )}
                          </div>
                          <div className="text-sm whitespace-pre-wrap">{c.body}</div>
                        </div>
                      </li>
                    );
                  })}
                </ul>
              )}
            </section>
          </div>
        </ScrollArea>

        <div className="border-t border-border pt-3 space-y-2">
          <Textarea
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            placeholder="Write a comment…"
            rows={2}
            onKeyDown={(e) => { if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) onSend(); }}
          />
          <div className="flex items-center justify-between gap-2">
            <input ref={fileRef} type="file" multiple className="hidden" onChange={(e) => onPickFiles(e.target.files)} />
            <div className="flex flex-wrap items-center gap-2">
              <Button variant="outline" size="sm" onClick={() => fileRef.current?.click()}>
                <Paperclip className="w-3.5 h-3.5" /> Attach files
              </Button>
              <VoiceNoteRecorder onRecorded={async (f) => { await uploadAttachment(f); }} disabled={!task} />
            </div>
            <Button size="sm" onClick={onSend} disabled={!draft.trim()}>
              <Send className="w-3.5 h-3.5" /> Comment
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
