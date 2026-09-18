import { useState } from "react";
import { Check, ChevronsUpDown } from "lucide-react";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { useEmployees } from "@/hooks/use-employees";
import { cn } from "@/lib/utils";

interface Props {
  value: string | null;
  onChange: (v: string | null) => void;
  label?: string;
  required?: boolean;
  filter?: (e: import("@/hooks/use-employees").EmployeeRow) => boolean;
}

export function EmployeePicker({ value, onChange, label = "Handled by", required, filter }: Props) {
  const { employees } = useEmployees();
  const active = employees.filter((e) => e.status === "active" && (!filter || filter(e)));
  const [open, setOpen] = useState(false);

  const selected = active.find((e) => e.id === value) ?? null;
  const displayText = selected
    ? `${selected.name}${selected.role ? ` · ${selected.role}` : ""}`
    : value === null
      ? "— Unassigned —"
      : "Select employee";

  const pick = (v: string | null) => {
    onChange(v);
    setOpen(false);
  };

  return (
    <div className="space-y-2">
      <Label>
        {label}
        {required ? " *" : ""}
      </Label>
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button
            type="button"
            variant="outline"
            role="combobox"
            aria-expanded={open}
            className="w-full justify-between font-normal"
          >
            <span className={cn("truncate", !selected && "text-muted-foreground")}>
              {displayText}
            </span>
            <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-[--radix-popover-trigger-width] p-0" align="start">
          <Command>
            <CommandInput placeholder="Search employee…" />
            <CommandList>
              <CommandEmpty>No employee found.</CommandEmpty>
              <CommandGroup>
                <CommandItem value="__unassigned__" onSelect={() => pick(null)}>
                  <Check
                    className={cn("mr-2 h-4 w-4", value === null ? "opacity-100" : "opacity-0")}
                  />
                  — Unassigned —
                </CommandItem>
                {active.map((e) => (
                  <CommandItem
                    key={e.id}
                    value={`${e.name} ${e.role ?? ""} ${e.email ?? ""}`}
                    onSelect={() => pick(e.id)}
                  >
                    <Check
                      className={cn(
                        "mr-2 h-4 w-4",
                        value === e.id ? "opacity-100" : "opacity-0",
                      )}
                    />
                    {e.name}
                    {e.role ? ` · ${e.role}` : ""}
                  </CommandItem>
                ))}
              </CommandGroup>
            </CommandList>
          </Command>
        </PopoverContent>
      </Popover>
    </div>
  );
}
