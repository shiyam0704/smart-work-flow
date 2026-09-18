import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

async function assertAdmin(context: { supabase: any; userId: string }) {
  const { data, error } = await context.supabase
    .from("user_roles")
    .select("role")
    .eq("user_id", context.userId);
  if (error) throw new Error(error.message);
  const roles = (data ?? []).map((r: { role: string }) => r.role);
  if (!roles.includes("admin") && !roles.includes("super_admin")) {
    throw new Response("Forbidden", { status: 403 });
  }
}

const APP_ROLES = ["super_admin", "admin", "manager", "executive", "officer", "staff"] as const;
type AppRoleStr = (typeof APP_ROLES)[number];

async function assertAdminOfCompany(
  context: { supabase: any; userId: string },
  companyId: string,
) {
  const { data, error } = await context.supabase
    .from("user_roles")
    .select("role, company_id")
    .eq("user_id", context.userId);
  if (error) throw new Error(error.message);
  const rows = (data ?? []) as { role: string; company_id: string | null }[];
  const isSuper = rows.some((r) => r.role === "super_admin");
  if (isSuper) return;
  const isCompanyAdmin = rows.some(
    (r) => r.role === "admin" && (r.company_id === null || r.company_id === companyId),
  );
  if (!isCompanyAdmin) throw new Response("Forbidden", { status: 403 });
}

async function findUserIdByEmail(admin: any, email: string): Promise<string | null> {
  const target = email.trim().toLowerCase();
  // Scan pages until we find the user or run out. Small tenants only; capped.
  for (let page = 1; page <= 20; page++) {
    const { data, error } = await admin.auth.admin.listUsers({ page, perPage: 200 });
    if (error) throw new Error(error.message);
    const match = data.users.find((u: any) => (u.email ?? "").toLowerCase() === target);
    if (match) return match.id;
    if (data.users.length < 200) return null;
  }
  return null;
}

export const createEmployeeLogin = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((input: unknown) =>
    z
      .object({
        employeeId: z.string().uuid(),
        email: z.string().email(),
        password: z.string().min(6),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    await assertAdmin(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    let userId: string | null = null;
    const created = await supabaseAdmin.auth.admin.createUser({
      email: data.email,
      password: data.password,
      email_confirm: true,
    });
    if (created.error) {
      // If the user already exists, reuse it and update the password.
      const existingId = await findUserIdByEmail(supabaseAdmin, data.email);
      if (!existingId) throw new Error(created.error.message);
      const upd = await supabaseAdmin.auth.admin.updateUserById(existingId, {
        password: data.password,
        email_confirm: true,
      });
      if (upd.error) throw new Error(upd.error.message);
      userId = existingId;
    } else {
      userId = created.data.user?.id ?? null;
    }
    if (!userId) throw new Error("Failed to obtain user id");

    const { error: linkErr } = await supabaseAdmin
      .from("employees")
      .update({ user_id: userId })
      .eq("id", data.employeeId);
    if (linkErr) throw new Error(linkErr.message);

    // Seed a default user_roles row scoped to the employee's company so the
    // workspace login gate accepts them immediately. Callers (e.g. the Edit
    // Employee modal) can subsequently upgrade the role via
    // setEmployeeSystemAccess.
    const { data: emp, error: empErr } = await supabaseAdmin
      .from("employees")
      .select("company_id, role")
      .eq("id", data.employeeId)
      .maybeSingle();
    if (empErr) throw new Error(empErr.message);
    const companyId = (emp as any)?.company_id as string | null;
    if (companyId) {
      const raw = String((emp as any)?.role ?? "").trim().toLowerCase();
      const map: Record<string, AppRoleStr> = {
        admin: "admin",
        manager: "manager",
        executive: "executive",
        officer: "officer",
        staff: "staff",
        employee: "staff",
      };
      const seedRole: AppRoleStr = map[raw] ?? "staff";
      await supabaseAdmin
        .from("user_roles")
        .delete()
        .eq("user_id", userId)
        .eq("company_id", companyId);
      const { error: rErr } = await supabaseAdmin
        .from("user_roles")
        .insert({ user_id: userId, role: seedRole, company_id: companyId });
      if (rErr) throw new Error(rErr.message);
    }

    return { userId };
  });

export const setEmployeeSystemAccess = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((input: unknown) =>
    z
      .object({
        userId: z.string().uuid(),
        role: z.enum(APP_ROLES),
        departmentIds: z.array(z.string().uuid()).default([]),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    // Resolve target company from the linked employee record.
    const { data: emp, error: empErr } = await supabaseAdmin
      .from("employees")
      .select("company_id")
      .eq("user_id", data.userId)
      .maybeSingle();
    if (empErr) throw new Error(empErr.message);
    const companyId = (emp as any)?.company_id as string | null;
    if (!companyId) throw new Error("Employee is not linked to a company");
    await assertAdminOfCompany(context, companyId);

    // Replace user_roles for this user within this company only.
    const { error: delRolesErr } = await supabaseAdmin
      .from("user_roles")
      .delete()
      .eq("user_id", data.userId)
      .eq("company_id", companyId);
    if (delRolesErr) throw new Error(delRolesErr.message);
    const { error: insRoleErr } = await supabaseAdmin
      .from("user_roles")
      .insert({ user_id: data.userId, role: data.role, company_id: companyId });
    if (insRoleErr) throw new Error(insRoleErr.message);

    // Replace user_role_departments for this user within this company only.
    const { error: delScopeErr } = await supabaseAdmin
      .from("user_role_departments")
      .delete()
      .eq("user_id", data.userId)
      .eq("company_id", companyId);
    if (delScopeErr) throw new Error(delScopeErr.message);
    if (
      (data.role === "manager" || data.role === "executive" || data.role === "officer") &&
      data.departmentIds.length
    ) {
      const rows = data.departmentIds.map((d) => ({
        user_id: data.userId,
        role: data.role,
        department_id: d,
        company_id: companyId,
      }));
      const { error } = await supabaseAdmin.from("user_role_departments").insert(rows);
      if (error) throw new Error(error.message);
    }
    return { ok: true };
  });

export const resetEmployeePassword = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((input: unknown) =>
    z.object({ userId: z.string().uuid(), password: z.string().min(6) }).parse(input),
  )
  .handler(async ({ data, context }) => {
    await assertAdmin(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin.auth.admin.updateUserById(data.userId, {
      password: data.password,
    });
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const deleteEmployeeLogin = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((input: unknown) =>
    z.object({ userId: z.string().uuid() }).parse(input),
  )
  .handler(async ({ data, context }) => {
    await assertAdmin(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    await supabaseAdmin.from("user_role_departments").delete().eq("user_id", data.userId);
    await supabaseAdmin.from("user_roles").delete().eq("user_id", data.userId);
    const { error } = await supabaseAdmin.auth.admin.deleteUser(data.userId);
    if (error && !/not.*found/i.test(error.message)) {
      throw new Error(error.message);
    }
    return { ok: true };
  });

export const revokeEmployeeSession = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((input: unknown) =>
    z.object({ userId: z.string().uuid() }).parse(input),
  )
  .handler(async ({ data, context }) => {
    await assertAdmin(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin.auth.admin.signOut(data.userId, "global");
    if (error && !/not.*found/i.test(error.message)) {
      // best-effort; do not fail caller
      console.error("revokeEmployeeSession:", error.message);
    }
    return { ok: true };
  });