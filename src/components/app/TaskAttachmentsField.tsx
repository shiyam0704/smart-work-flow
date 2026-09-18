import { useRef } from "react";
import { Paperclip, X, FileIcon, Mic } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { VoiceNoteRecorder } from "@/components/app/VoiceNoteRecorder";
import { formatSize, isVoiceNote, MAX_ATTACHMENT_BYTES } from "@/lib/task-attachments";
import { toast } from "sonner";

/**
 * Stages files and voice notes before a task exists. Uploading happens
 * after the task is created.
 */
export function TaskAttachmentsField({
  files,
  onChange,
}: {
  files: File[];
  onChange: (files: File[]) => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);

  const add = (incoming: File[]) => {
    const accepted = incoming.filter((f) => {
      if (f.size > MAX_ATTACHMENT_BYTES) {
        toast.error(`${f.name} is larger than ${formatSize(MAX_ATTACHMENT_BYTES)}`);
        return false;
      }
      return true;
    });
    if (accepted.length) onChange([...files, ...accepted]);
  };

  return (
    <div className="grid min-w-0 max-w-full gap-2 overflow-hidden">
      <Label>Attachments &amp; voice notes</Label>
      <div className="flex flex-wrap items-center gap-2">
        <input
          ref={inputRef}
          type="file"
          multiple
          className="hidden"
          onChange={(e) => {
            add(Array.from(e.target.files ?? []));
            if (inputRef.current) inputRef.current.value = "";
          }}
        />
        <Button type="button" size="sm" variant="outline" onClick={() => inputRef.current?.click()}>
          <Paperclip className="w-3.5 h-3.5" /> Attach files
        </Button>
        <VoiceNoteRecorder onRecorded={(f) => add([f])} />
      </div>

      {files.length > 0 && (
        <ul className="min-w-0 space-y-1.5">
          {files.map((f, i) => (
            <li
              key={`${f.name}-${i}`}
              className="grid min-w-0 grid-cols-[auto_minmax(0,1fr)_auto_auto] items-center gap-2 rounded-md border border-border p-2"
            >
              {isVoiceNote(f.type, f.name) ? (
                <Mic className="w-4 h-4 text-muted-foreground shrink-0" />
              ) : (
                <FileIcon className="w-4 h-4 text-muted-foreground shrink-0" />
              )}
              <span className="min-w-0 truncate text-sm" title={f.name}>{f.name}</span>
              <span className="text-[10px] text-muted-foreground shrink-0">{formatSize(f.size)}</span>
              <Button
                type="button"
                size="icon"
                variant="ghost"
                className="h-7 w-7 text-destructive"
                aria-label={`Remove ${f.name}`}
                onClick={() => onChange(files.filter((_, idx) => idx !== i))}
              >
                <X className="w-3.5 h-3.5" />
              </Button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
