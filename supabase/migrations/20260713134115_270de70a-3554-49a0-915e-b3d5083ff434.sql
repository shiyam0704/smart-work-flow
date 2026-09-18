ALTER TABLE public.role_permissions ALTER COLUMN company_id SET NOT NULL;
ALTER TABLE public.role_permissions DROP CONSTRAINT IF EXISTS role_permissions_role_permission_key_key;
ALTER TABLE public.role_permissions ADD CONSTRAINT role_permissions_company_role_perm_key UNIQUE (company_id, role, permission_key);