import { useState, useEffect, useRef } from "react";
import { EmployeePhoto } from "@/components/app/EmployeePhoto";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Upload, Loader2, Info, Eye, EyeOff, Trash2, ShieldCheck } from "lucide-react";
import { CLink as Link } from "@/lib/nav";
import type { EmployeeRow, EmployeeInput } from "@/hooks/use-employees";
import type { DepartmentRow } from "@/hooks/use-departments";
import { useEmployeeFields } from "@/hooks/use-employee-fields";
import { useAuth, type AppRole } from "@/hooks/use-auth";
import { supabase } from "@/integrations/supabase/client";
import { useServerFn } from "@tanstack/react-start";
import {
  createEmployeeLogin,
  resetEmployeePassword,
  deleteEmployeeLogin,
  setEmployeeSystemAccess,
} from "@/lib/employee-auth.functions";
import { useConfirm } from "@/components/app/confirm-dialog";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { PASSWORD_RULES, validateStrongPassword } from "@/lib/password-strength";

function friendlyPasswordError(e: any): string | undefined {
  const msg = String(e?.message ?? "");
  if (/SUPABASE_SERVICE_ROLE_KEY/i.test(msg)) {
    return "Missing SUPABASE_SERVICE_ROLE_KEY in .env. Please add your Supabase Service Role Key to enable employee login accounts.";
  }
  if (/known to be weak|easy to guess|compromised|pwned/i.test(msg)) {
    return "That password is too easy to guess. Please choose a different, less common password.";
  }
  return msg || undefined;
}
import { Check, X } from "lucide-react";
import { useEmployees } from "@/hooks/use-employees";
import { useActiveCompany } from "@/hooks/use-company";

function PasswordChecklist({ value }: { value: string }) {
  return (
    <ul className="space-y-1 text-xs">
      {PASSWORD_RULES.map((rule) => {
        const ok = rule.test(value);
        return (
          <li
            key={rule.id}
            className={cn(
              "flex items-center gap-1.5",
              ok ? "text-emerald-600 dark:text-emerald-400" : "text-muted-foreground",
            )}
          >
            {ok ? <Check className="w-3 h-3" /> : <X className="w-3 h-3" />}
            {rule.label}
          </li>
        );
      })}
    </ul>
  );
}

const SYSTEM_ROLES: { value: AppRole; label: string }[] = [
  { value: "manager", label: "Manager" },
  { value: "executive", label: "Executive" },
  { value: "officer", label: "Officer" },
  { value: "staff", label: "Staff" },
];
const ADMIN_LABEL = "Admin";

const ROLE_LABEL_TO_VALUE: Record<string, AppRole> = {
  admin: "admin",
  manager: "manager",
  executive: "executive",
  officer: "officer",
  staff: "staff",
  employee: "staff",
};

function normalizeRole(raw: string): AppRole {
  return ROLE_LABEL_TO_VALUE[raw.trim().toLowerCase()] ?? "staff";
}

function roleLabel(v: AppRole) {
  if (v === "admin") return ADMIN_LABEL;
  return SYSTEM_ROLES.find((r) => r.value === v)?.label ?? "Staff";
}

interface Props {
  employee: EmployeeRow | null;
  departments: DepartmentRow[];
  open: boolean;
  mode?: "edit" | "create";
  onOpenChange: (open: boolean) => void;
  onSave: (input: EmployeeInput, id?: string) => Promise<unknown>;
  onDelete?: (id: string) => Promise<boolean>;
}

const empty = (deptId: string | null): EmployeeInput => ({
  name: "",
  email: "",
  role: "staff",
  department_id: deptId,
  status: "active",
  photo_url: "",
  contact_number: "",
  employee_code: "",
  custom_fields: {},
});

function suggestEmployeeCode(slug: string | undefined, count: number): string {
  const prefix =
    (slug ?? "SMS").toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 4) || "EMP";
  const seq = String(count + 1).padStart(3, "0");
  return `${prefix}01-${seq}`;
}

export function EditEmployeeModal({
  employee,
  departments,
  open,
  mode = "edit",
  onOpenChange,
  onSave,
  onDelete,
}: Props) {
  const [form, setForm] = useState<EmployeeInput>(empty(departments[0]?.id ?? null));
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [uploading, setUploading] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const { fields: customFields } = useEmployeeFields();
  const { isAdmin } = useAuth();
  const confirm = useConfirm();
  const { employees, reload: reloadEmployees } = useEmployees();
  const { company } = useActiveCompany();

  // System role + dept scopes (only used when employee.user_id is set)
  const [systemRole, setSystemRole] = useState<AppRole>("staff");
  const [multiDepts, setMultiDepts] = useState<string[]>([]);
  const [officerDept, setOfficerDept] = useState<string>("");
  const [scopesLoading, setScopesLoading] = useState(false);

  // Password management
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const createLoginFn = useServerFn(createEmployeeLogin);
  const resetPasswordFn = useServerFn(resetEmployeePassword);
  const deleteLoginFn = useServerFn(deleteEmployeeLogin);
  const setSystemAccessFn = useServerFn(setEmployeeSystemAccess);

  useEffect(() => {
    if (employee) {
      setForm({
        name: employee.name,
        email: employee.email,
        role: employee.role || "staff",
        department_id: employee.department_id,
        status: employee.status,
        photo_url: employee.photo_url ?? "",
        contact_number: employee.contact_number ?? "",
        employee_code: employee.employee_code ?? "",
        custom_fields: employee.custom_fields ?? {},
      });
      setSystemRole(normalizeRole(employee.role || "staff"));
    } else {
      setForm({
        ...empty(departments[0]?.id ?? null),
        employee_code: suggestEmployeeCode(company?.slug, employees.length),
      });
      setSystemRole("staff");
      setMultiDepts([]);
      setOfficerDept("");
    }
    setNewPassword("");
    setConfirmPassword("");
    setShowPassword(false);
    setShowConfirm(false);
  }, [employee, open, departments, company?.slug, employees.length]);

  // Load actual user_roles + scopes for a linked employee
  useEffect(() => {
    if (!open || !employee?.user_id) return;
    setScopesLoading(true);
    Promise.all([
      supabase.from("user_roles").select("role").eq("user_id", employee.user_id),
      supabase
        .from("user_role_departments")
        .select("role, department_id")
        .eq("user_id", employee.user_id),
    ]).then(([{ data: roleRows }, { data: scopeRows }]) => {
      const priority: AppRole[] = ["admin", "manager", "executive", "officer", "staff"];
      const owned = (roleRows ?? []).map((r: any) => r.role as AppRole);
      const primary = priority.find((r) => owned.includes(r)) ?? normalizeRole(employee.role || "staff");
      setSystemRole(primary);
      // Manager + Executive both use multi-select chips
      setMultiDepts(
        (scopeRows ?? [])
          .filter((s: any) => s.role === "manager" || s.role === "executive")
          .map((s: any) => s.department_id),
      );
      const officer = (scopeRows ?? []).find((s: any) => s.role === "officer");
      setOfficerDept(officer ? officer.department_id : "");
      setScopesLoading(false);
    });
  }, [open, employee?.user_id, employee?.role]);

  const handlePhotoUpload = async (file: File) => {
    if (!company?.id) {
      toast.error("No active company — cannot upload photo.");
      return;
    }
    if (!file.type.startsWith("image/")) {
      toast.error("Please choose an image file.");
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      toast.error("Image is too large (max 5 MB).");
      return;
    }
    setUploading(true);
    const ext = (file.name.split(".").pop() || "jpg").toLowerCase();
    const path = `${company.id}/${crypto.randomUUID()}.${ext}`;
    const previous = form.photo_url;
    const { error } = await supabase.storage.from("employee-photos").upload(path, file, {
      upsert: false,
      contentType: file.type,
    });
    if (error) {
      toast.error(`Photo upload failed: ${error.message}`);
      setUploading(false);
      return;
    }
    // Store the storage path (bucket is private; render via signed URL).
    setForm((f) => ({ ...f, photo_url: path }));
    setUploading(false);
    toast.success("Photo uploaded");
    // Clean up the replaced file (ignore legacy full URLs).
    if (previous && !/^(https?:|data:|blob:)/i.test(previous)) {
      supabase.storage.from("employee-photos").remove([previous]).catch(() => {});
    }
  };

  const setCF = (key: string, value: unknown) =>
    setForm((f) => ({ ...f, custom_fields: { ...(f.custom_fields ?? {}), [key]: value } }));

  const syncSystemAccess = async (userId: string) => {
    const departmentIds: string[] =
      systemRole === "executive" || systemRole === "manager"
        ? multiDepts
        : systemRole === "officer" && officerDept
          ? [officerDept]
          : [];
    await setSystemAccessFn({
      data: { userId, role: systemRole, departmentIds },
    });
  };

  const handleSave = async () => {
    if (!form.name.trim()) return toast.error("Name is required");
    if (!form.department_id) return toast.error("Department is required");
    if (!systemRole) return toast.error("Role is required");
    if (!form.email.trim() && !form.contact_number.trim()) {
      return toast.error("Email or mobile number is required as the user ID");
    }
    if (isAdmin) {
      if ((systemRole === "executive" || systemRole === "manager") && multiDepts.length === 0) {
        return toast.error(`Select at least one department for ${roleLabel(systemRole)}`);
      }
      if (systemRole === "officer" && !officerDept) {
        return toast.error("Select a department for Officer");
      }
    }
    const wantsCreateLogin = mode === "create" && isAdmin && !!form.email.trim();
    const wantsPasswordChange =
      mode === "edit" && isAdmin && !!newPassword;
    if (mode === "create" && isAdmin) {
      if (!newPassword) return toast.error("Password is required");
      const check = validateStrongPassword(newPassword);
      if (!check.valid) return toast.error(check.firstError!);
      if (newPassword !== confirmPassword) return toast.error("Passwords do not match");
    }
    if (wantsPasswordChange) {
      const check = validateStrongPassword(newPassword);
      if (!check.valid) return toast.error(check.firstError!);
      if (newPassword !== confirmPassword) return toast.error("Passwords do not match");
    }
    setSaving(true);
    // Save the role label into employees.role so the list displays it consistently
    const payload: EmployeeInput = { ...form, role: roleLabel(systemRole) };
    const res = (await onSave(payload, employee?.id)) as { id: string; user_id?: string | null } | null;

    if (res && isAdmin && employee?.user_id) {
      try {
        await syncSystemAccess(employee.user_id);
        toast.success("System access updated");
      } catch (e: any) {
        toast.error(e.message ?? "Failed to update system access");
      }
    }

    // On create, provision a login account when an email is supplied
    if (res && wantsCreateLogin) {
      try {
        const { userId } = await createLoginFn({
          data: { employeeId: res.id, email: form.email, password: newPassword },
        });
        await syncSystemAccess(userId);
        await reloadEmployees();
        toast.success("Login account created");
      } catch (e: any) {
        toast.error(friendlyPasswordError(e) ?? "Failed to create login account");
      }
    } else if (res && mode === "create" && !form.email.trim()) {
      toast.info("Login account not created — email is required to enable dashboard login");
    }

    // On edit, apply password change if provided
    if (res && wantsPasswordChange) {
      try {
        if (employee?.user_id) {
          await resetPasswordFn({ data: { userId: employee.user_id, password: newPassword } });
          toast.success("Password updated");
        } else if (form.email.trim() && employee) {
          const { userId } = await createLoginFn({
            data: { employeeId: employee.id, email: form.email, password: newPassword },
          });
          await syncSystemAccess(userId);
          await reloadEmployees();
          toast.success("Login account created");
        }
      } catch (e: any) {
        toast.error(friendlyPasswordError(e) ?? "Failed to update password");
      }
    }

    setSaving(false);
    if (res !== null) onOpenChange(false);
  };

  const handleDelete = async () => {
    if (!employee || !onDelete) return;
    const ok = await confirm({
      title: `Delete ${employee.name}?`,
      description: employee.user_id
        ? "This will permanently delete the employee and remove their login account. This cannot be undone."
        : "This will permanently delete the employee. This cannot be undone.",
      confirmText: "Delete employee",
      destructive: true,
      requireType: employee.name,
    });
    if (!ok) return;
    setDeleting(true);
    try {
      if (employee.user_id) {
        try {
          await deleteLoginFn({ data: { userId: employee.user_id } });
        } catch (e: any) {
          toast.error(e.message ?? "Failed to remove login account");
          setDeleting(false);
          return;
        }
      }
      const removed = await onDelete(employee.id);
      if (removed) onOpenChange(false);
    } finally {
      setDeleting(false);
    }
  };

  const initials = (form.name || "?").split(" ").map((n) => n[0]).join("").slice(0, 2).toUpperCase();
  const showMultiDept = isAdmin && (systemRole === "manager" || systemRole === "executive");

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="bg-background border-border sm:max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{mode === "create" ? "Add Employee" : "Edit Employee"}</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 py-2">
          {/* 1. Photo */}
          <div className="flex items-center gap-4">
            <div className="w-20 h-20 rounded-xl overflow-hidden bg-gradient-primary flex items-center justify-center text-white font-bold text-xl shadow-glow">
              {form.photo_url ? (
                <EmployeePhoto photoRef={form.photo_url} alt="" className="w-full h-full object-cover" fallback={<span>{initials}</span>} />
              ) : (
                initials
              )}
            </div>
            <div className="flex-1 space-y-2">
              <Label>Photo</Label>
              <input
                ref={fileRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) handlePhotoUpload(file);
                  e.target.value = "";
                }}
              />
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => fileRef.current?.click()}
                disabled={uploading}
                className="glass border-glass-border"
              >
                {uploading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4" />}
                {uploading ? "Uploading…" : form.photo_url ? "Replace photo" : "Upload photo"}
              </Button>
              {form.photo_url && (
                <button
                  type="button"
                  className="ml-2 text-xs text-muted-foreground hover:text-destructive"
                  onClick={() => {
                    const prev = form.photo_url;
                    setForm({ ...form, photo_url: "" });
                    if (prev && !/^(https?:|data:|blob:)/i.test(prev)) {
                      supabase.storage.from("employee-photos").remove([prev]).catch(() => {});
                    }
                  }}
                >
                  Remove
                </button>
              )}
            </div>
          </div>

          {/* 2. Full name */}
          <div className="space-y-2">
            <Label htmlFor="name">Full name <span className="text-destructive">*</span></Label>
            <Input id="name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
          </div>

          {/* 3. Email */}
          <div className="space-y-2">
            <Label htmlFor="email">
              Email <span className="text-destructive">*</span>
            </Label>
            <Input id="email" type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} placeholder="name@company.com" />
            <p className="text-xs text-muted-foreground">Email or mobile number is required as the user ID for login.</p>
          </div>

          {/* 4. Mobile number */}
          <div className="space-y-2">
            <Label htmlFor="contact">Mobile number <span className="text-destructive">*</span></Label>
            <Input
              id="contact"
              type="tel"
              value={form.contact_number}
              onChange={(e) => setForm({ ...form, contact_number: e.target.value })}
              placeholder="+1 555 123 4567"
            />
          </div>

          {/* 5. Password */}
          {isAdmin && (
            <div className="space-y-2">
              <Label htmlFor="new-password">
                Password{mode === "create" && <span className="text-destructive"> *</span>}
              </Label>
              <div className="relative">
                <Input
                  id="new-password"
                  type={showPassword ? "text" : "password"}
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  placeholder={mode === "edit" ? "Leave blank to keep current" : "Strong password"}
                  autoComplete="new-password"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((v) => !v)}
                  className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                  aria-label={showPassword ? "Hide password" : "Show password"}
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
              {(newPassword || mode === "create") && <PasswordChecklist value={newPassword} />}
            </div>
          )}

          {/* 5b. Confirm password */}
          {isAdmin && (
            <div className="space-y-2">
              <Label htmlFor="confirm-password">
                Confirm password{mode === "create" && <span className="text-destructive"> *</span>}
              </Label>
              <div className="relative">
                <Input
                  id="confirm-password"
                  type={showConfirm ? "text" : "password"}
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder="Re-enter password"
                  autoComplete="new-password"
                />
                <button
                  type="button"
                  onClick={() => setShowConfirm((v) => !v)}
                  className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                  aria-label={showConfirm ? "Hide password" : "Show password"}
                >
                  {showConfirm ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
              {confirmPassword && newPassword !== confirmPassword && (
                <p className="text-xs text-destructive">Passwords do not match</p>
              )}
            </div>
          )}

          {/* 5c. Employee code */}
          {isAdmin && (
            <div className="space-y-2">
              <Label htmlFor="employee-code">Employee code</Label>
              <Input
                id="employee-code"
                value={form.employee_code}
                onChange={(e) => setForm({ ...form, employee_code: e.target.value })}
                placeholder="Auto-generated"
              />
            </div>
          )}

          {/* 6. Role */}
          <div className="space-y-2">
            <Label htmlFor="role">Role <span className="text-destructive">*</span></Label>
            {isAdmin ? (
              <Select value={systemRole} onValueChange={(v) => setSystemRole(v as AppRole)}>
                <SelectTrigger id="role"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {SYSTEM_ROLES.map((r) => (
                    <SelectItem key={r.value} value={r.value}>{r.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            ) : (
              <div className="px-3 py-2 rounded-lg border border-glass-border text-sm text-muted-foreground">
                {roleLabel(systemRole)}
              </div>
            )}
            {isAdmin && mode === "edit" && !employee?.user_id && (
              <div className="flex items-start gap-2 text-xs text-muted-foreground">
                <Info className="w-3.5 h-3.5 mt-0.5 shrink-0" />
                <span>Link this employee to a login account to apply system access.</span>
              </div>
            )}
            {isAdmin && (
              <div className="flex items-start gap-2 text-xs text-muted-foreground">
                <ShieldCheck className="w-3.5 h-3.5 mt-0.5 shrink-0" />
                <span>
                  Access is controlled by role permissions.{" "}
                  <Link to="/c/$slug/settings/roles" className="underline hover:text-foreground">
                    Manage in Settings → Roles & Permissions
                  </Link>
                  .
                </span>
              </div>
            )}
          </div>

          {/* 7. Department */}
          <div className="space-y-2">
            <Label>Department <span className="text-destructive">*</span></Label>
            {showMultiDept ? (
              <div>
                <div className="text-xs text-muted-foreground mb-1">
                  Select one or more departments
                </div>
                <div className="flex flex-wrap gap-2">
                  {departments.map((d) => {
                    const on = multiDepts.includes(d.id);
                    return (
                      <button
                        key={d.id}
                        type="button"
                        disabled={scopesLoading}
                        onClick={() =>
                          setMultiDepts((s) => (on ? s.filter((x) => x !== d.id) : [...s, d.id]))
                        }
                        className={cn(
                          "px-3 py-1.5 rounded-full text-xs border transition",
                          on
                            ? "border-primary bg-primary/15 text-foreground"
                            : "border-glass-border text-muted-foreground hover:text-foreground",
                        )}
                      >
                        {d.name}
                      </button>
                    );
                  })}
                </div>
              </div>
            ) : isAdmin && systemRole === "officer" ? (
              <Select
                value={officerDept || form.department_id || undefined}
                onValueChange={(v) => {
                  setOfficerDept(v);
                  setForm((f) => ({ ...f, department_id: v }));
                }}
              >
                <SelectTrigger><SelectValue placeholder="Select department…" /></SelectTrigger>
                <SelectContent>
                  {departments.map((d) => (
                    <SelectItem key={d.id} value={d.id}>{d.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            ) : (
              <Select
                value={form.department_id ?? undefined}
                onValueChange={(v) => setForm({ ...form, department_id: v })}
              >
                <SelectTrigger><SelectValue placeholder="Select department…" /></SelectTrigger>
                <SelectContent>
                  {departments.map((d) => (
                    <SelectItem key={d.id} value={d.id}>{d.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          </div>


          {/* 12. Status */}
          <div className="space-y-2">
            <Label htmlFor="status">Status</Label>
            <Select value={form.status} onValueChange={(v: "active" | "inactive") => setForm({ ...form, status: v })}>
              <SelectTrigger id="status"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="active">Active</SelectItem>
                <SelectItem value="inactive">Inactive</SelectItem>
              </SelectContent>
            </Select>
          </div>


          {/* 13. Custom fields */}
          {customFields.length > 0 && (
            <div className="space-y-3 pt-2 border-t border-glass-border">
              <div className="text-sm font-medium text-muted-foreground">Custom fields</div>
              {customFields
                .slice()
                .sort((a, b) => a.sort_order - b.sort_order)
                .map((f) => {
                  const val = (form.custom_fields ?? {})[f.id];
                  if (f.field_type === "checkbox") {
                    return (
                      <div key={f.id} className="flex items-center gap-2">
                        <Checkbox
                          id={`cf-${f.id}`}
                          checked={!!val}
                          onCheckedChange={(c) => setCF(f.id, !!c)}
                        />
                        <Label htmlFor={`cf-${f.id}`}>
                          {f.label}{f.required && <span className="text-destructive"> *</span>}
                        </Label>
                      </div>
                    );
                  }
                  if (f.field_type === "select") {
                    return (
                      <div key={f.id} className="space-y-2">
                        <Label>{f.label}{f.required && <span className="text-destructive"> *</span>}</Label>
                        <Select value={(val as string) ?? ""} onValueChange={(v) => setCF(f.id, v)}>
                          <SelectTrigger><SelectValue placeholder="Select…" /></SelectTrigger>
                          <SelectContent>
                            {(f.options ?? []).map((opt) => (
                              <SelectItem key={opt} value={opt}>{opt}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                    );
                  }
                  const type =
                    f.field_type === "number"
                      ? "number"
                      : f.field_type === "date"
                      ? "date"
                      : f.field_type === "url"
                      ? "url"
                      : "text";
                  return (
                    <div key={f.id} className="space-y-2">
                      <Label htmlFor={`cf-${f.id}`}>
                        {f.label}{f.required && <span className="text-destructive"> *</span>}
                      </Label>
                      <Input
                        id={`cf-${f.id}`}
                        type={type}
                        value={(val as string | number | undefined) ?? ""}
                        onChange={(e) => setCF(f.id, e.target.value)}
                      />
                    </div>
                  );
                })}
            </div>
          )}
        </div>
        <DialogFooter className="sm:justify-between gap-2">
          {isAdmin && mode === "edit" && employee && onDelete ? (
            <Button
              type="button"
              variant="destructive"
              onClick={handleDelete}
              disabled={deleting || saving}
              className="mr-auto"
            >
              {deleting ? <Loader2 className="w-4 h-4 animate-spin mr-1" /> : <Trash2 className="w-4 h-4 mr-1" />}
              Delete employee
            </Button>
          ) : (
            <span />
          )}
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
            <Button onClick={handleSave} disabled={saving || deleting} className="bg-gradient-primary text-white">
              {saving ? "Saving…" : mode === "create" ? "Add employee" : "Save changes"}
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
