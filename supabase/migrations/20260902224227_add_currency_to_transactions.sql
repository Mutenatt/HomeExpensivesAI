-- Permite marcar un gasto/ingreso en dólares en vez de pesos. Sin conversión
-- de tipo de cambio: ARS y USD se trackean como totales independientes en
-- toda la app (ver docs/superpowers/specs/2026-09-02-usd-currency-design.md).
alter table transactions
  add column currency text not null default 'ARS'
  check (currency in ('ARS', 'USD'));
