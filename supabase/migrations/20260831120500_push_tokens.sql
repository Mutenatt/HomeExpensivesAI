-- Tokens de Expo Push por dispositivo, usados por la Edge Function de period-snapshot
-- para notificar el cierre de cada corte semanal/mensual.

create table push_tokens (
    id uuid primary key default gen_random_uuid(),
    user_id uuid references auth.users(id) not null,
    expo_push_token text not null,
    created_at timestamptz not null default timezone('utc'::text, now()),
    unique (user_id, expo_push_token)
);

alter table push_tokens enable row level security;

create policy "Users manage own push tokens" on push_tokens
    for all
    to authenticated
    using ((select auth.uid()) = user_id)
    with check ((select auth.uid()) = user_id);
