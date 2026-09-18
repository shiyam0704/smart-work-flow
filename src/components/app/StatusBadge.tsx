import { useWorkflowStates } from "@/hooks/use-workflow-states";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Check, ChevronDown } from "lucide-react";

export function StatusBadge({
  statusId,
  onChange,
}: {
  statusId: string | null;
  onChange?: (statusId: string) => void;
}) {
  const { states } = useWorkflowStates();
  const s = states.find((x) => x.id === statusId);

  const badge = (
    <span
      className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium glass"
      style={
        s
          ? { color: s.color, borderColor: `color-mix(in oklch, ${s.color} 40%, transparent)` }
          : undefined
      }
    >
      {s ? (
        <>
          <span className="w-1.5 h-1.5 rounded-full" style={{ background: s.color }} />
          {s.name}
        </>
      ) : (
        <span className="text-muted-foreground">—</span>
      )}
      {onChange && <ChevronDown className="w-3 h-3 opacity-60" />}
    </span>
  );

  if (!onChange) {
    return s ? badge : <span className="text-xs text-muted-foreground">—</span>;
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        asChild
        onClick={(e) => e.stopPropagation()}
        className="cursor-pointer hover:opacity-80 transition focus:outline-none focus-visible:ring-2 focus-visible:ring-ring rounded-full"
      >
        <button type="button" aria-label="Change status">{badge}</button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" onClick={(e) => e.stopPropagation()}>
        {states.map((st) => (
          <DropdownMenuItem
            key={st.id}
            onSelect={() => onChange(st.id)}
            className="gap-2"
          >
            <span className="w-2 h-2 rounded-full" style={{ background: st.color }} />
            <span className="flex-1">{st.name}</span>
            {st.id === statusId && <Check className="w-3.5 h-3.5 text-primary" />}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

const PRIORITY_COLORS: Record<string, string> = {
  low: "var(--muted-foreground)",
  medium: "var(--neon-cyan)",
  high: "var(--neon-amber)",
  urgent: "var(--neon-pink)",
};

export function PriorityBadge({ priority }: { priority: string }) {
  return (
    <span
      className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-bold uppercase tracking-wide"
      style={{ color: PRIORITY_COLORS[priority], background: `color-mix(in oklch, ${PRIORITY_COLORS[priority]} 15%, transparent)` }}
    >
      {priority}
    </span>
  );
}

export function PriorityDot({ priority, className = "" }: { priority: string; className?: string }) {
  const color = PRIORITY_COLORS[priority] ?? "var(--muted-foreground)";
  return (
    <span
      className={`inline-block w-2 h-2 rounded-full shrink-0 ${className}`}
      style={{ background: color, boxShadow: `0 0 0 2px color-mix(in oklch, ${color} 20%, transparent)` }}
      title={`Priority: ${priority}`}
      aria-label={`Priority: ${priority}`}
    />
  );
}
