import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { provisionCompanyAdmin, resetCompanyAdminPasswordForCompany } from "./company-admin.server";

export const createCompanyAdminLogin = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((data) => z.object({
    companyId: z.string().uuid(),
    name: z.string().trim().min(1),
    email: z.string().trim().email(),
    password: z.string().min(4),
  }).parse(data))
  .handler(async ({ context, data }) => provisionCompanyAdmin(context, data));

export const resetCompanyAdminPassword = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((data) => z.object({
    companyId: z.string().uuid(),
    password: z.string().min(4),
  }).parse(data))
  .handler(async ({ context, data }) => resetCompanyAdminPasswordForCompany(context, data));