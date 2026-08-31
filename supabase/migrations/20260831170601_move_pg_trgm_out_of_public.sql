-- El advisor de seguridad marca pg_trgm en el schema public como riesgo
-- (extension_in_public). Se mueve a extensions, el schema estándar de Supabase
-- para extensiones, sin afectar el índice gin que ya la usa.
alter extension pg_trgm set schema extensions;
