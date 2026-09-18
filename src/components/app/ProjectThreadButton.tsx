import { useRef, useState } from "react";
import { useCanManage } from "@/hooks/use-permissions";
import { format, formatDistanceToNow } from "date-fns";
import { Paperclip, Send, Trash2, Download, FileIcon, MessageSquare } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useProjectThread } from "@/hooks/use-project-thread";
import { useEmployees } from "@/hooks/use-employees";
import { useProfileNames } from "@/hooks/use-profile-names";
import { useAuth } from "@/hooks/use-auth";
import { useConfirm } from "@/components/app/confirm-dialog";

function formatSize(b: number) {
  if (b < 1024) return `${b} B`;
  if (b < 1024 * 1024) return `${(b / 1024).toFixed(1)} KB`;
  return `${(b / 1024 / 1024).toFixed(1)} MB`;
}

export function ProjectThreadButton({ projectId, projectName }: { projectId: string; projectName: string }) {
  const [open, setOpen] = useState(false);
  const { user, isAdmin } = useAuth();
  const canManageProjects = useCanManage("projects");
  const { employees } = useEmployees();
  const { nameByUserId } = useProfileNames();
  const { comments, attachments, addComment, deleteComment, uploadAttachment, deleteAttachment, getDownloadUrl } =
    useProjectThread(open ? projectId : null);
  const [draft, setDraft] = useState("");
  const confirm = useConfirm();
  const fileRef = useRef<HTMLInputElement>(null);

  const authorName = (id: string) =>
    employees.find((e) => e.user_id === id)?.name ?? nameByUserId(id) ?? "Unknown";
  const canManage = isAdmin || canManageProjects;

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
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" className="glass border-glass-border" title="Attachments & Comments">
          <MessageSquare className="w-4 h-4" />
          <span className="hidden sm:inline">Thread</span>
          {(comments.length + attachments.length) > 0 && (
            <span className="ml-1 text-xs text-muted-foreground">
              {attachments.length}/{comments.length}
            </span>
          )}
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-2xl max-h-[85vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="truncate pr-6">{projectName} — Attachments & Comments</DialogTitle>
        </DialogHeader>

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
                        <FileIcon className="w-4 h-4 text-muted-foreground shrink-0" />
                        <div className="flex-1 min-w-0">
                          <div className="text-sm truncate">{a.file_name}</div>
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
          <div className="flex items-center justify-between">
            <input ref={fileRef} type="file" multiple className="hidden" onChange={(e) => onPickFiles(e.target.files)} />
            <Button variant="outline" size="sm" onClick={() => fileRef.current?.click()}>
              <Paperclip className="w-3.5 h-3.5" /> Attach files
            </Button>
            <Button size="sm" onClick={onSend} disabled={!draft.trim()}>
              <Send className="w-3.5 h-3.5" /> Comment
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
