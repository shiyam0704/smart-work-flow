async function requireSuperAdmin(context: any) {
  const { data, error } = await context.supabase
    .from("user_roles")
    .select("role")
    .eq("user_id", context.userId);
  if (error) throw new Error(error.message);
  if (!(data ?? []).some((r: { role: string }) => r.role === "super_admin")) {
    throw new Error("Only platform admins can manage company admin logins");
  }
}

async function findUserByEmail(supabaseAdmin: any, email: string) {
  const target = email.toLowerCase();
  for (let page = 1; page <= 100; page += 1) {
    const { data, error } = await supabaseAdmin.auth.admin.listUsers({ page, perPage: 100 });
    if (error) throw new Error(error.message);
    const found = data.users.find((u: { email?: string | null }) => u.email?.toLowerCase() === target);
    if (found) return found;
    if (data.users.length < 100) return null;
  }
  return null;
}

export interface CompanyAdminProvisionInput {
  companyId: string;
  name: string;
  email: string;
  password: string;
}

export async function provisionCompanyAdmin(context: any, input: CompanyAdminProvisionInput) {
  await requireSuperAdmin(context);
  const email = input.email.toLowerCase();

  const { data: company, error: companyError } = await context.supabase
    .from("companies")
    .select("id")
    .eq("id", input.companyId)
    .maybeSingle();
  if (companyError) throw new Error(companyError.message);
  if (!company) throw new Error("Company not found");

  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  let user = await findUserByEmail(supabaseAdmin, email);
  if (user) {
    const { data: existingRoles, error: rolesError } = await context.supabase
      .from("user_roles")
      .select("role, company_id")
      .eq("user_id", user.id);
    if (rolesError) throw new Error(rolesError.message);
    if ((existingRoles ?? []).some((r: { role: string }) => r.role === "super_admin")) {
      throw new Error("This email is already a platform admin");
    }
    const otherCompanyRole = (existingRoles ?? []).find(
      (r: { company_id: string | null }) => r.company_id && r.company_id !== input.companyId,
    );
    if (otherCompanyRole) {
      throw new Error("This email already belongs to another company");
    }

    const { error: updateError } = await supabaseAdmin.auth.admin.updateUserById(user.id, {
      password: input.password,
      email_confirm: true,
      user_metadata: { full_name: input.name },
    });
    if (updateError) throw new Error(updateError.message);
  } else {
    const { data, error } = await supabaseAdmin.auth.admin.createUser({
      email,
      password: input.password,
      email_confirm: true,
      user_metadata: { full_name: input.name },
    });
    if (error) throw new Error(error.message);
    if (!data.user) throw new Error("Unable to create admin login");
    user = data.user;
  }

  const { error: roleError } = await context.supabase
    .from("user_roles")
    .upsert(
      { user_id: user.id, role: "admin", company_id: input.companyId },
      { onConflict: "user_id,role" },
    );
  if (roleError) throw new Error(roleError.message);

  const { data: existingAdmin, error: adminLookupError } = await context.supabase
    .from("company_admins")
    .select("id")
    .eq("company_id", input.companyId)
    .ilike("email", email)
    .maybeSingle();
  if (adminLookupError) throw new Error(adminLookupError.message);

  if (existingAdmin?.id) {
    const { error } = await context.supabase
      .from("company_admins")
      .update({ name: input.name, email })
      .eq("id", existingAdmin.id);
    if (error) throw new Error(error.message);
  } else {
    const { error } = await context.supabase
      .from("company_admins")
      .insert({ company_id: input.companyId, name: input.name, email });
    if (error) throw new Error(error.message);
  }

  return { userId: user.id };
}

export async function resetCompanyAdminPasswordForCompany(
  context: any,
  data: { companyId: string; password: string },
) {
  await requireSuperAdmin(context);
  const { data: admin, error } = await context.supabase
    .from("company_admins")
    .select("name, email")
    .eq("company_id", data.companyId)
    .order("created_at", { ascending: true })
    .limit(1)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!admin) throw new Error("No company admin is on file");
  return provisionCompanyAdmin(context, {
    companyId: data.companyId,
    name: admin.name,
    email: admin.email,
    password: data.password,
  });
}