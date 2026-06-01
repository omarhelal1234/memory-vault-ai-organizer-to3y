-- Trigger functions run in trigger context regardless of EXECUTE grant.
-- Revoke API-facing EXECUTE so they cannot be called via /rest/v1/rpc.
revoke execute on function public.handle_new_user() from public, anon, authenticated;
revoke execute on function public.enforce_category_parent_owner() from public, anon, authenticated;
