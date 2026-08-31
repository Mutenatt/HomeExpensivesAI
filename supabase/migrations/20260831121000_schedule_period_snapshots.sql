-- Agenda los cortes semanal (lunes) y mensual (día 1) que invocan la Edge Function
-- `period-snapshot` vía pg_cron + pg_net.
--
-- Requisito manual antes de que esto funcione (no se puede versionar en un archivo
-- de migración por seguridad: expondría el service_role key en el repo):
--   select vault.create_secret('https://<project-ref>.supabase.co', 'project_url');
--   select vault.create_secret('<service-role-key>', 'service_role_key');
-- Correrlo una vez desde el SQL editor del proyecto (no en una migración commiteada).

create extension if not exists pg_cron with schema extensions;
create extension if not exists pg_net with schema extensions;

-- Lunes 11:00 UTC = 08:00 ART (Argentina es UTC-3 todo el año, sin horario de verano).
select cron.schedule(
    'weekly-expense-snapshot',
    '0 11 * * 1',
    $$
    select net.http_post(
        url := (select decrypted_secret from vault.decrypted_secrets where name = 'project_url')
            || '/functions/v1/period-snapshot',
        headers := jsonb_build_object(
            'Content-Type', 'application/json',
            'Authorization', 'Bearer ' || (
                select decrypted_secret from vault.decrypted_secrets where name = 'service_role_key'
            )
        ),
        body := jsonb_build_object('period_type', 'weekly')
    ) as request_id;
    $$
);

-- Día 1 de cada mes, 11:00 UTC = 08:00 ART.
select cron.schedule(
    'monthly-expense-snapshot',
    '0 11 1 * *',
    $$
    select net.http_post(
        url := (select decrypted_secret from vault.decrypted_secrets where name = 'project_url')
            || '/functions/v1/period-snapshot',
        headers := jsonb_build_object(
            'Content-Type', 'application/json',
            'Authorization', 'Bearer ' || (
                select decrypted_secret from vault.decrypted_secrets where name = 'service_role_key'
            )
        ),
        body := jsonb_build_object('period_type', 'monthly')
    ) as request_id;
    $$
);
