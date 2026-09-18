import { useEffect, useRef, useState } from "react";
import { Mic, Square, Trash2, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { format } from "date-fns";

const MAX_SECONDS = 300; // 5 minutes

function pickMime() {
  if (typeof MediaRecorder === "undefined") return "";
  const candidates = ["audio/webm;codecs=opus", "audio/webm", "audio/mp4", "audio/ogg"];
  return candidates.find((m) => MediaRecorder.isTypeSupported(m)) ?? "";
}

function extFor(mime: string) {
  if (mime.includes("mp4")) return "m4a";
  if (mime.includes("ogg")) return "ogg";
  return "webm";
}

function mmss(total: number) {
  const m = Math.floor(total / 60);
  const s = total % 60;
  return `${m}:${String(s).padStart(2, "0")}`;
}

/**
 * Records a voice note in the browser and hands the finished recording back as a File.
 * Shows a local preview so the user can listen before keeping it.
 */
export function VoiceNoteRecorder({
  onRecorded,
  disabled,
}: {
  onRecorded: (file: File) => void | Promise<void>;
  disabled?: boolean;
}) {
  const [recording, setRecording] = useState(false);
  const [seconds, setSeconds] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [preview, setPreview] = useState<{ url: string; file: File; seconds: number } | null>(null);
  const [saving, setSaving] = useState(false);

  const recorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const secondsRef = useRef(0);

  const clearTimer = () => {
    if (timerRef.current) clearInterval(timerRef.current);
    timerRef.current = null;
  };

  useEffect(() => {
    return () => {
      clearTimer();
      recorderRef.current?.stream.getTracks().forEach((t) => t.stop());
      if (preview) URL.revokeObjectURL(preview.url);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const start = async () => {
    setError(null);
    if (typeof navigator === "undefined" || !navigator.mediaDevices?.getUserMedia || typeof MediaRecorder === "undefined") {
      setError("Voice recording is not supported on this device.");
      return;
    }
    let stream: MediaStream;
    try {
      stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    } catch {
      setError("Microphone blocked. Allow microphone access to record a voice note.");
      return;
    }
    const mimeType = pickMime();
    const rec = mimeType ? new MediaRecorder(stream, { mimeType }) : new MediaRecorder(stream);
    chunksRef.current = [];
    secondsRef.current = 0;
    setSeconds(0);

    rec.ondataavailable = (e) => {
      if (e.data.size) chunksRef.current.push(e.data);
    };
    rec.onstop = () => {
      clearTimer();
      stream.getTracks().forEach((t) => t.stop());
      const type = rec.mimeType || mimeType || "audio/webm";
      const blob = new Blob(chunksRef.current, { type });
      if (blob.size === 0) {
        setError("Nothing was recorded. Try again.");
        setRecording(false);
        return;
      }
      const name = `Voice note - ${format(new Date(), "d MMM yyyy, h.mm a")}.${extFor(type)}`;
      const file = new File([blob], name, { type });
      setPreview({ url: URL.createObjectURL(blob), file, seconds: secondsRef.current });
      setRecording(false);
    };

    recorderRef.current = rec;
    rec.start();
    setRecording(true);
    timerRef.current = setInterval(() => {
      secondsRef.current += 1;
      setSeconds(secondsRef.current);
      if (secondsRef.current >= MAX_SECONDS) rec.stop();
    }, 1000);
  };

  const stop = () => recorderRef.current?.stop();

  const discard = () => {
    if (preview) URL.revokeObjectURL(preview.url);
    setPreview(null);
    setSeconds(0);
  };

  const keep = async () => {
    if (!preview) return;
    setSaving(true);
    await onRecorded(preview.file);
    setSaving(false);
    discard();
  };

  const remaining = MAX_SECONDS - seconds;

  if (preview) {
    return (
      <div className="flex flex-wrap items-center gap-2 rounded-md border border-border p-2">
        <audio controls src={preview.url} className="h-8 max-w-[220px]" />
        <span className="text-[11px] text-muted-foreground">{mmss(preview.seconds)}</span>
        <Button size="sm" onClick={keep} disabled={saving}>
          <Check className="w-3.5 h-3.5" /> {saving ? "Adding…" : "Keep voice note"}
        </Button>
        <Button size="sm" variant="ghost" className="text-destructive" onClick={discard} disabled={saving}>
          <Trash2 className="w-3.5 h-3.5" /> Discard
        </Button>
      </div>
    );
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      {recording ? (
        <>
          <Button size="sm" variant="destructive" onClick={stop}>
            <Square className="w-3.5 h-3.5" /> Stop
          </Button>
          <span className="text-xs tabular-nums text-muted-foreground">
            Recording {mmss(seconds)}
            {remaining <= 30 && ` · stops in ${remaining}s`}
          </span>
        </>
      ) : (
        <Button size="sm" variant="outline" onClick={start} disabled={disabled}>
          <Mic className="w-3.5 h-3.5" /> Record voice note
        </Button>
      )}
      {error && <span className="text-xs text-destructive">{error}</span>}
    </div>
  );
}
