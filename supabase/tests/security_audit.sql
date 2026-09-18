-- Read-only inspection, suitable for SQL Editor/MCP after migration.
select c.relname as table_name, c.relrowsecurity as rls_enabled
from pg_class c join pg_namespace n on n.oid = c.relnamespace
where n.nspname = 'public' and c.relkind = 'r' order by c.relname;

select schemaname, tablename, policyname, roles, cmd, qual, with_check
from pg_policies
where schemaname = 'public'
   or (schemaname = 'storage' and policyname like 'route_images_%')
order by schemaname, tablename, policyname;

select schemaname, tablename, indexname, indexdef
from pg_indexes where schemaname = 'public' order by tablename, indexname;

select p.proname, p.prosecdef as security_definer, p.proconfig,
  has_function_privilege('anon', p.oid, 'execute') as anon_execute,
  has_function_privilege('authenticated', p.oid, 'execute') as authenticated_execute
from pg_proc p join pg_namespace n on n.oid = p.pronamespace
where n.nspname = 'private';

select id, name, public from storage.buckets where id = 'route-images';

select table_name, grantee, privilege_type
from information_schema.role_table_grants
where table_schema = 'public' and grantee in ('anon', 'authenticated')
order by table_name, grantee, privilege_type;
