import { StatusBadge, PriorityBadge } from "@/components/app/StatusBadge";
import { InlineTaskEditor } from "@/components/app/InlineTaskEditor";
import { useTaskAttachmentCounts } from "@/hooks/use-task-attachment-counts";
import { Paperclip, Mic } from "lucide-react";
import { useDepartments } from "@/hooks/use-departments";
import { useClientsData } from "@/hooks/use-clients-data";
import type { TaskRow } from "@/hooks/use-tasks";

interface Props {
  tasks: TaskRow[];
  onOpen: (t: TaskRow) => void;
  onStatusChange: (id: string, statusId: string) => void;
}

export function TasksListView({ tasks, onOpen, onStatusChange }: Props) {
  const { departments } = useDepartments();
  const { clients } = useClientsData();
  const { counts } = useTaskAttachmentCounts();

  const sorted = [...tasks].sort((a, b) => {
    if (!a.due_date && !b.due_date) return 0;
    if (!a.due_date) return 1;
    if (!b.due_date) return -1;
    return a.due_date.localeCompare(b.due_date);
  });

  if (sorted.length === 0) {
    return (
      <div className="glass rounded-2xl p-10 text-center text-muted-foreground">
        No tasks.
      </div>
    );
  }

  return (
    <div className="glass rounded-2xl shadow-card overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="text-left text-xs uppercase tracking-wide text-muted-foreground bg-white/5">
            <tr>
              <th className="px-4 py-3 font-medium">Title</th>
              <th className="px-4 py-3 font-medium">Client</th>
              <th className="px-4 py-3 font-medium">Department</th>
              <th className="px-4 py-3 font-medium">Priority</th>
              <th className="px-4 py-3 font-medium">Status</th>
              <th className="px-4 py-3 font-medium">Due</th>
              <th className="px-4 py-3" />
            </tr>
          </thead>
          <tbody className="divide-y divide-glass-border">
            {sorted.map((t) => {
              const d = departments.find((x) => x.id === t.department_id);
              const c = clients.find((x) => x.id === t.client_id);
              return (
                <tr key={t.id} className="hover:bg-white/5 transition">
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <button type="button" onClick={() => onOpen(t)} className="text-left font-medium hover:underline">
                        {t.title}
                      </button>
                      {(counts[t.id]?.files ?? 0) > 0 && (
                        <span className="inline-flex items-center gap-0.5 text-[11px] text-muted-foreground" title="Attachments">
                          <Paperclip className="w-3 h-3" />{counts[t.id]?.files}
                        </span>
                      )}
                      {(counts[t.id]?.voice ?? 0) > 0 && (
                        <span className="inline-flex items-center gap-0.5 text-[11px] text-muted-foreground" title="Voice notes">
                          <Mic className="w-3 h-3" />{counts[t.id]?.voice}
                        </span>
                      )}
                    </div>
                  </td>
                  <td className="px-4 py-3 text-muted-foreground">{c?.name ?? "—"}</td>
                  <td className="px-4 py-3 text-muted-foreground">{d?.name ?? "—"}</td>
                  <td className="px-4 py-3"><PriorityBadge priority={t.priority} /></td>
                  <td className="px-4 py-3">
                    <StatusBadge statusId={t.status_id} onChange={(sid) => onStatusChange(t.id, sid)} />
                  </td>
                  <td className="px-4 py-3 text-muted-foreground whitespace-nowrap">{t.due_date ?? "—"}</td>
                  <td className="px-4 py-3 text-right"><InlineTaskEditor task={t} /></td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}