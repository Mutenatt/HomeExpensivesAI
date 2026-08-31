-- HomeExpensivesAI: esquema inicial
-- Ver proyecto_gastos_app.md y el plan en .claude para el contexto de diseño.

create extension if not exists pg_trgm;

-- =========================================================
-- 1. products: catálogo para autocompletado y variación de precio
-- =========================================================
create table products (
    id uuid primary key default gen_random_uuid(),
    user_id uuid references auth.users(id) not null,
    name text not null,
    name_normalized text generated always as (lower(trim(name))) stored,
    is_essential boolean not null default false,
    created_at timestamptz not null default timezone('utc'::text, now())
);

-- Evita duplicados por espacios/mayúsculas (ej. "Harina 0000" vs "harina 0000 ")
create unique index products_user_name_normalized_key
    on products (user_id, name_normalized);

-- Autocompletado difuso (búsqueda por substring/similaridad)
create index products_name_trgm_idx
    on products using gin (name gin_trgm_ops);

-- =========================================================
-- 2. transactions: núcleo de gastos e ingresos
-- =========================================================
create table transactions (
    id uuid primary key default gen_random_uuid(),
    user_id uuid references auth.users(id) not null,
    amount decimal(12, 2) not null check (amount > 0),
    type text not null check (type in ('income', 'expense')),
    payment_method text not null check (
        payment_method in ('cash', 'debit_card', 'credit_card', 'bank_transfer', 'digital_wallet')
    ),
    store_name text,
    product_id uuid references products(id) on delete set null,
    date timestamptz not null default timezone('utc'::text, now()),
    created_at timestamptz not null default timezone('utc'::text, now()),
    -- Soft delete: nunca borrar físicamente una transacción, rompe el historial de precios.
    deleted_at timestamptz
);

create index transactions_user_date_idx
    on transactions (user_id, date)
    where deleted_at is null;

-- =========================================================
-- 3. installments: proyección de pagos de tarjeta de crédito
-- =========================================================
create table installments (
    id uuid primary key default gen_random_uuid(),
    transaction_id uuid references transactions(id) on delete cascade not null,
    user_id uuid references auth.users(id) not null,
    installment_number integer not null,
    total_installments integer not null,
    amount_per_installment decimal(12, 2) not null check (amount_per_installment > 0),
    due_date date not null,
    status text not null default 'pending' check (status in ('pending', 'paid')),
    created_at timestamptz not null default timezone('utc'::text, now())
);

create index installments_user_due_date_idx
    on installments (user_id, due_date);

-- =========================================================
-- 4. period_snapshots: cortes semanal/mensual persistidos
--    (poblada por la Edge Function + pg_cron, ver supabase/functions/period-snapshot)
-- =========================================================
create table period_snapshots (
    id uuid primary key default gen_random_uuid(),
    user_id uuid references auth.users(id) not null,
    period_type text not null check (period_type in ('weekly', 'monthly')),
    period_start date not null,
    period_end date not null,
    total_income decimal(12, 2) not null default 0,
    total_expense decimal(12, 2) not null default 0,
    total_essential decimal(12, 2) not null default 0,
    created_at timestamptz not null default timezone('utc'::text, now()),
    unique (user_id, period_type, period_start)
);

create index period_snapshots_user_idx
    on period_snapshots (user_id, period_type, period_start desc);

-- =========================================================
-- 5. Vistas
-- =========================================================

-- Historial de precios con variación % respecto a la compra anterior del mismo producto.
-- security_invoker: sin esto, la vista corre con privilegios del creador y expondría
-- filas de todos los usuarios sin pasar por RLS.
create view price_history
with (security_invoker = true) as
select
    t.id as transaction_id,
    p.id as product_id,
    p.name as product_name,
    t.store_name,
    t.amount as price,
    t.date,
    lag(t.amount) over (partition by p.id order by t.date) as previous_price,
    round(
        (
            (t.amount - lag(t.amount) over (partition by p.id order by t.date))
            / nullif(lag(t.amount) over (partition by p.id order by t.date), 0)
        ) * 100,
        2
    ) as price_change_pct
from transactions t
join products p on t.product_id = p.id
where t.type = 'expense' and t.deleted_at is null;

-- Contexto habitual por producto: tienda y método de pago más usados,
-- para precargar el Clic 2 del flujo de carga rápida.
create view product_usual_context
with (security_invoker = true) as
select distinct on (product_id)
    product_id,
    user_id,
    store_name,
    payment_method,
    use_count
from (
    select
        product_id,
        user_id,
        store_name,
        payment_method,
        count(*) as use_count
    from transactions
    where product_id is not null and type = 'expense' and deleted_at is null
    group by product_id, user_id, store_name, payment_method
) usage_counts
order by product_id, use_count desc;

-- =========================================================
-- 6. Row Level Security
-- =========================================================
alter table products enable row level security;
alter table transactions enable row level security;
alter table installments enable row level security;
alter table period_snapshots enable row level security;

create policy "Users manage own products" on products
    for all
    to authenticated
    using ((select auth.uid()) = user_id)
    with check ((select auth.uid()) = user_id);

-- transactions: sin política de DELETE a propósito. El borrado es lógico
-- (UPDATE deleted_at) para no perder el historial de precios/inflación.
create policy "Users select own transactions" on transactions
    for select
    to authenticated
    using ((select auth.uid()) = user_id);

create policy "Users insert own transactions" on transactions
    for insert
    to authenticated
    with check ((select auth.uid()) = user_id);

create policy "Users update own transactions" on transactions
    for update
    to authenticated
    using ((select auth.uid()) = user_id)
    with check ((select auth.uid()) = user_id);

create policy "Users manage own installments" on installments
    for all
    to authenticated
    using ((select auth.uid()) = user_id)
    with check ((select auth.uid()) = user_id);

create policy "Users manage own period snapshots" on period_snapshots
    for all
    to authenticated
    using ((select auth.uid()) = user_id)
    with check ((select auth.uid()) = user_id);
