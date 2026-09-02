# Diseño: gastos en dólares (USD) y gráfico separado en Resumen

## Contexto

Hoy `transactions` no tiene noción de moneda: todo monto se asume en pesos (ARS), tanto en la carga (`QuickAddExpenseSheet`), la edición (`EditTransactionModal`), el listado de Gastos, y los totales/gráficos de `ResumenScreen`. El usuario quiere poder cargar gastos en dólares (marcándolos con un toggle "USD", al mismo estilo que el toggle "Esencial" ya existente) y ver, en Resumen, un total separado de lo gastado en USD ese mes — sin mezclarlo con el total en pesos.

## Alcance

1. Nueva columna `currency` en `transactions` (`'ARS' | 'USD'`, default `'ARS'`).
2. Toggle "USD" en Quick Add y en el modal de edición.
3. El toggle "Esencial" se oculta cuando la moneda es USD (no aplica: el gráfico de USD no tiene desglose esencial/no esencial).
4. Nueva tarjeta en Resumen con el total gastado en USD del mes (sin donut, sin desglose), visible solo si ese total es mayor a 0.
5. El donut/contador de ARS existente pasa a sumar **solo** filas en pesos (hoy suma todo).
6. Los montos en Gastos > Corriente muestran el prefijo correcto (`$` o `US$`) según la moneda de cada fila.
7. La función edge `period-snapshot` (notificaciones push semanales/mensuales) se corrige para sumar solo transacciones en ARS, evitando mezclar monedas en esos totales.

Fuera de alcance (YAGNI, explícitamente descartado): conversión/tipo de cambio ARS↔USD, terceras monedas, desglose esencial/no esencial para USD, mostrar la tarjeta de USD cuando el total es $0.

## Modelo de datos

### Supabase (`transactions`)

```sql
alter table transactions
  add column currency text not null default 'ARS'
  check (currency in ('ARS', 'USD'));
```

Se aplica como una migración nueva en `supabase/migrations/`, aplicada directamente al proyecto de producción (con el MCP de Supabase) y versionada en el repo. No requiere backfill: el `default 'ARS'` cubre todas las filas existentes correctamente (hoy todo es pesos).

### SQLite local (`mobile/src/lib/localDb.ts`)

Mismo patrón ya usado para `total_installments`: se agrega `currency TEXT NOT NULL DEFAULT 'ARS'` a `pending_transactions` vía `ALTER TABLE ... ADD COLUMN` envuelto en try/catch dentro de `openAndMigrate` (SQLite tira error si la columna ya existe; se ignora). `PendingTransactionInput`, `PendingTransactionRow` y `enqueuePendingTransaction` incorporan `currency: "ARS" | "USD"`.

### Sync (`mobile/src/lib/sync.ts`)

`pushPendingTransactions` incluye `currency: tx.currency` en el `.insert()` a `transactions`.

### Tipos (`mobile/src/types/index.ts`)

`Transaction.currency: "ARS" | "USD"`. `TransactionWithProduct` hereda el campo sin cambios adicionales.

## UI: carga y edición

### `QuickAddExpenseSheet.tsx`

- Nuevo campo de estado `currency: "ARS" | "USD"` (default `"ARS"`).
- Nuevo `Switch` "USD", mismo estilo visual que la fila "Esencial (canasta básica)", ubicado debajo del input de monto (antes del selector de fecha).
- El placeholder del monto cambia según la moneda: `"$ 0"` / `"US$ 0"`.
- Cuando `currency === "USD"`, la fila "Esencial (canasta básica)" no se renderiza; al guardar, si `currency === "USD"` se fuerza `isEssential: false` (no se le pregunta al usuario).
- El toggle USD está disponible tanto para `type === "expense"` como `"income"` (no está condicionado al tipo, a diferencia de "Esencial" que ya es exclusivo de gastos).
- `handleSave` pasa `currency: state.currency` a `enqueuePendingTransaction`.

### `EditTransactionModal.tsx`

- Mismo `Switch` "USD" agregado (no tenía ningún campo de moneda). Al guardar, se incluye `currency` en el `.update()` de `transactions`.
- Este modal no toca `is_essential` (vive en `products`, no en `transactions`), así que no hace falta replicar la lógica de "ocultar esencial" acá — no la tiene.

## Formato (`mobile/src/lib/format.ts`)

`formatCurrency(amount, currency: "ARS" | "USD" = "ARS")`: mismo formato de separadores (punto miles, coma decimales) para ambas monedas; el prefijo cambia entre `$` y `US$`. Se actualizan los call sites: `DashboardScreen` (filas de Corriente, pasando `item.currency`), `MonthTotalCounter` (nueva prop `currency`, default `"ARS"`), `EssentialDonutChart` (sigue fijo en ARS, no cambia).

## Resumen (`ResumenScreen.tsx`)

- `aggregateEssentialSplit` (en `mobile/src/lib/resumen.ts`) filtra internamente a `row.currency === "ARS"` antes de acumular — el donut y el contador existentes pasan a reflejar solo pesos automáticamente, sin tocar el resto de `ResumenScreen`.
- Nueva función pura `aggregateUsdExpenseTotal(rows): number`, suma de `amount` para filas con `type === "expense" && currency === "USD"`.
- En el render, debajo de la tarjeta actual (donut ARS), si `usdTotal > 0`: una segunda tarjeta (mismo estilo `styles.card`) con `MonthTotalCounter total={usdTotal} currency="USD" isCurrentMonth={isCurrentMonth}` y label "Gastado en USD este mes" / "Total gastado en USD en el mes" (mismo patrón condicional que ya usa `MonthTotalCounter` para ARS). Sin donut. Si `usdTotal === 0`, la tarjeta no se renderiza.
- La animación de entrada (`Animated.View` con `key`) ya envuelve todo el contenido de la pantalla, así que la tarjeta de USD hereda el mismo fade/slide al cambiar de mes o re-entrar a la pestaña, sin lógica adicional.

## Función edge `period-snapshot`

En la query de transacciones (`supabase/functions/period-snapshot/index.ts`, alrededor de la línea 89), se agrega `.eq("currency", "ARS")` junto al filtro existente de rango de fechas y `deleted_at is null`, para que `total_income`/`total_expense`/`total_essential` sigan representando solo pesos.

## Testing / verificación

- Unit tests (puros, jest): `formatCurrency` con ambas monedas; `aggregateEssentialSplit` ignorando filas USD; `aggregateUsdExpenseTotal` con filas mixtas ARS/USD/ingresos.
- Verificación manual end-to-end (dev server Expo web, ya logueado):
  1. Cargar un gasto en USD desde Quick Add, confirmar que el toggle "Esencial" desaparece al activar USD.
  2. Confirmar en Supabase que la fila quedó con `currency = 'USD'`.
  3. Entrar a Resumen: confirmar que el total/donut de ARS no incluye ese monto, y que aparece la tarjeta nueva de USD con el total correcto.
  4. Confirmar que en Gastos > Corriente esa fila muestra el prefijo `US$`.
  5. Editar esa transacción y cambiarla a ARS; confirmar que el total de ARS la empieza a incluir y la tarjeta de USD desaparece (o baja) según corresponda.
