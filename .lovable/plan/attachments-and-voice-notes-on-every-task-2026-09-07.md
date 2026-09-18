# Attachments and voice notes on every task

Today files can only be added to a task after it exists, from the task detail
panel. There is no way to record a voice note anywhere. This adds both to every
place a task is created or opened.

## What you will be able to do

- Attach files while creating a task (New Task window, and the quick-add used on
  client, project and department pages). Files picked before saving are uploaded
  the moment the task is created.
- Record a voice note with a single "Record" button — press to start, press to
  stop, hear it back before keeping it, discard and re-record if needed.
- Open a task and add more files or voice notes at any time.
- Play voice notes straight inside the task with a small player showing length,
  who added it and when; download or delete like any other file.
- See a paperclip count with a small microphone marker on task cards/rows when a
  task carries files or voice notes.

## Behaviour details

- Voice notes record in the browser's native format and are saved as normal task
  files named "Voice note - 7 Sep 2026, 3:02 pm", so they appear in the same
  list as documents and images.
- Recording asks for microphone permission the first time. If permission is
  denied or the device has no microphone, the button explains that in place and
  file attachment still works.
- A single recording is capped at 5 minutes; a countdown appears in the last 30
  seconds and recording stops automatically at the cap.
- Attachment size limit stays consistent with existing uploads; oversized files
  are rejected with a clear message and the rest still upload.
- Anything staged before saving is discarded if the create window is cancelled.

## Technical notes

- New `src/components/app/VoiceNoteRecorder.tsx`: `MediaRecorder`-based recorder
  returning a `File` (`audio/webm`, or `audio/mp4` on Safari) with local preview
  playback, elapsed timer, cap, and permission-error state. Client-only, mounted
  inside dialogs so no SSR concerns.
- New `src/components/app/TaskAttachmentsField.tsx`: staging list used before a
  task id exists (file input + `VoiceNoteRecorder`, in-memory `File[]`, remove
  per row).
- `src/hooks/use-task-thread.ts`: keep `uploadAttachment`; add
  `uploadAttachments(files: File[], taskId?)` so a caller can upload after
  create, and expose signed-URL playback for audio rows.
- `src/components/app/NewTaskModal.tsx`: hold staged files in state, and after
  `addTask` returns the new id, upload them to `task-attachments` and insert the
  matching `task_attachments` rows; report partial failures without losing the
  created task.
- `src/components/app/TaskDetailDialog.tsx`: add the recorder next to the
  existing file input; render audio rows with an `<audio controls>` player fed by
  a short-lived signed URL instead of the plain download row.
- `src/components/app/InlineTaskEditor.tsx` gets an "Attachments" entry that
  opens the task detail panel (it edits an existing task, so no staging needed).
- Attachment counts for list/kanban rows come from a lightweight count query on
  `task_attachments` grouped by task, cached with the existing shared-resource
  pattern and invalidated on the task-thread realtime events.
- No database or storage changes: `public.task_attachments` and the private
  `task-attachments` bucket with company-scoped policies already exist, and the
  audio files are ordinary rows in them.
