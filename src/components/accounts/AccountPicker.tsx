import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { usePaymentAccounts, accountTypeLabel } from "@/hooks/use-payment-accounts";

const NONE = "none";

/**
 * Cash / bank account selector shared by every money-entry dialog.
 * Hidden entirely until the workspace has at least one account.
 */
export function AccountPicker({
  value,
  onChange,
  label = "Money in / out of",
  className,
}: {
  value: string | null;
  onChange: (id: string | null) => void;
  label?: string;
  className?: string;
}) {
  const { activeAccounts } = usePaymentAccounts();

  if (activeAccounts.length === 0) return null;

  const validValue = value && activeAccounts.some((a) => a.id === value) ? value : NONE;

  return (
    <div className={`space-y-1.5 grid gap-2 ${className ?? ""}`}>
      <Label>{label}</Label>
      <Select value={validValue} onValueChange={(v) => onChange(v === NONE ? null : v)}>
        <SelectTrigger className="bg-input border-border">
          <SelectValue placeholder="Not assigned" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value={NONE}>Not assigned</SelectItem>
          {activeAccounts.map((a) => (
            <SelectItem key={a.id} value={a.id}>
              {a.name} · {accountTypeLabel(a.account_type)}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}
