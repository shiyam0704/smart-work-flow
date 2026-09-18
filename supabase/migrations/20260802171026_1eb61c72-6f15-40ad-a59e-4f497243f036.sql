REVOKE ALL ON FUNCTION public.log_audit() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.log_audit() FROM anon;
REVOKE ALL ON FUNCTION public.log_audit() FROM authenticated;