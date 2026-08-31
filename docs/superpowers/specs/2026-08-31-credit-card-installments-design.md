# Diseño: UI de cuotas de tarjeta de crédito

## Contexto

El schema de Supabase ya tiene una tabla `installments` (creada en `supabase/migrations/20260831120000_initial_schema.sql`) pensada para "proyectar pagos de tarjetas de crédito", pero nada en la app la usa todavía: el `QuickAddExpenseSheet` permite elegir "Crédito" como método de pago pero no pregunta la cantidad de cuotas, y no existe ninguna pantalla para ver o gestionar cuotas pendientes. Esto era uno de los "Próximos pasos" listados en `proyecto_gastos_app.md`. Este documento define cómo se captura, sincroniza y visualiza esa información.

## Alcance

1. Capturar la cantidad de cuotas al cargar un gasto con tarjeta de crédito (Quick Add).
2. Generar el cronograma de cuotas (`installments`) al sincronizar ese gasto.
3. Una pantalla nueva para ver cuotas pendientes y marcarlas como pagadas.
4. Navegación por tabs para llegar a esa pantalla.

Fuera de alcance (explícitamente descartado en esta vuelta, YAGNI): edición/borrado de una cuota individual, historial de cuotas ya pagadas, agrupación por mes, selector manual de fecha de primer vencimiento, notificaciones de vencimiento próximo.

## Reglas de negocio

- **Semántica del monto:** el usuario ingresa el **monto total de la compra** en el Clic 1/2 del Quick Add (no el monto por cuota).
- **Impacto en totales:** la `transaction` se registra por el monto total en la fecha de compra, igual que cualquier otro gasto. Las filas de `installments` son solo un cronograma de referencia — **no** se vuelven a sumar en `period_snapshots` ni en ningún total del dashboard. Esto matchea el comentario original del schema ("proyección de pagos") y evita tener que tocar la Edge Function `period-snapshot`.
- **Cálculo de cada cuota:** `amount_per_installment = round(amount / total_installments, 2)`. Si el reparto no es exacto, el resto de centavos se ajusta en la última cuota, de forma que `sum(amount_per_installment) === amount` exactamente.
- **Vencimientos:** la cuota 1 vence un mes después de la fecha de compra (mismo día del mes). Cada cuota siguiente vence un mes después de la anterior.
- **Cantidad mínima:** 1 cuota es válido (compra en un pago pero con tarjeta de crédito) — no genera fila en `installments` (no tiene sentido "proyectar" un pago que ya es el total).

## Cambios de datos y sincronización

### SQLite local (`mobile/src/lib/localDb.ts`)

- Se agrega la columna `total_installments INTEGER` a `pending_transactions`. Como hoy no existe un sistema de migraciones versionado para la DB local (solo `CREATE TABLE IF NOT EXISTS`), se agrega con un `ALTER TABLE pending_transactions ADD COLUMN total_installments INTEGER` envuelto en try/catch dentro de `openAndMigrate` (SQLite tira error si la columna ya existe; se ignora ese error puntual).
- `PendingTransactionInput` y `enqueuePendingTransaction` incorporan `totalInstallments: number | null`.

### Sync (`mobile/src/lib/sync.ts`)

En `pushPendingTransactions`, después del `insert` exitoso de la `transaction`:

- Si `tx.total_installments` es `null` o `<= 1`, no se hace nada más (comportamiento actual, sin cambios).
- Si `tx.total_installments > 1`, se calculan las N filas de cuotas (fechas y montos según las reglas de arriba) y se insertan en batch en `installments` (`user_id`, `transaction_id`, `installment_number`, `total_installments`, `amount_per_installment`, `due_date`, `status: 'pending'`).
- Si ese insert de `installments` falla, se loguea pero **no** afecta el `synced` de la transacción — la transacción ya está guardada (que es lo que importa para los totales) y no se reintenta el cronograma para no arriesgar duplicar la transacción en un reintento futuro (el insert de `transactions` no es idempotente hoy).

## UI: Quick Add (`mobile/src/components/QuickAddExpenseSheet.tsx`)

- Nuevo campo en el estado: `installments: number | null` (default `null`).
- Cuando `type === 'expense'` y `paymentMethod === 'credit_card'`, se revela una sub-sección nueva (mismo patrón visual que `essentialRow`) con:
  - Label "¿En cuántas cuotas?"
  - Pills: `3 / 6 / 9 / 12 / 18 / 24` + pill **"Otra"**.
  - Si se toca "Otra", aparece un `TextInput` numérico para cargar un valor custom (incluye poder cargar 1).
- Si el usuario cambia el método de pago a algo distinto de `credit_card`, `installments` se resetea a `null` y la sub-sección se oculta.
- `canSave` exige, cuando `paymentMethod === 'credit_card'`, que `installments` sea un entero `>= 1`.
- Selección de un producto sugerido con `usual_payment_method === 'credit_card'` precarga el pill de Crédito pero no precarga cuotas (no hay ese dato guardado); el usuario elige cuotas siempre.
- Al guardar, se pasa `totalInstallments: state.installments` a `enqueuePendingTransaction`.

## Navegación y pantalla nueva

### Dependencias nuevas

`@react-navigation/native`, `@react-navigation/bottom-tabs`, `react-native-screens`, `react-native-safe-area-context` (peer deps estándar de React Navigation en Expo).

### `App.tsx`

Pasa de renderizar `DashboardScreen` directamente a un `NavigationContainer` con `Tab.Navigator` de 2 pestañas:

- **"Gastos"** → `DashboardScreen` (como hoy, incluye el FAB y el `QuickAddExpenseSheet`).
- **"Cuotas"** → `InstallmentsScreen` (nueva).

La carga solo es posible desde la pestaña "Gastos" (coherente con el flujo de 3 clics actual; no se duplica el FAB en la pestaña de Cuotas).

### `InstallmentsScreen` (nueva, `mobile/src/screens/InstallmentsScreen.tsx`)

- Recibe `userId` como prop (mismo patrón que `DashboardScreen`).
- Query a Supabase: `installments` con `status = 'pending'`, `eq('user_id', userId)`, join `transaction:transactions(store_name, product:products(name))`, `order('due_date', { ascending: true })`.
- Header con el total pendiente: suma de `amount_per_installment` de todas las filas cargadas.
- `FlatList` de filas: nombre del producto o tienda (fallback a "Cuota" genérico si no hay ninguno), texto "Cuota N de M", monto, fecha de vencimiento formateada, botón "Marcar pagada".
- "Marcar pagada": `update installments set status = 'paid' where id = X`, con actualización optimista (se saca la fila de la lista al tocar, antes de esperar la respuesta).
- Estado vacío: "No tenés cuotas pendientes."

### Tipos (`mobile/src/types/index.ts`)

`Installment` ya existe con los campos necesarios. Se agrega un tipo local en `InstallmentsScreen` para la fila con el join (`Installment & { transaction: { store_name: string | null; product: { name: string } | null } | null }`), siguiendo el mismo patrón que `TransactionWithProduct` en `DashboardScreen`.

## Testing / verificación

Después de implementar, se levanta el dev server de Expo (web, por ser el entorno más simple para probar sin dispositivo/emulador) y se prueba el flujo real end-to-end:

1. Cargar un gasto con tarjeta de crédito a varias cuotas (ej. 3) desde el Quick Add.
2. Confirmar en Supabase (`mcp__supabase__execute_sql`) que se creó la `transaction` por el monto total y las 3 filas en `installments` con montos y `due_date` correctos.
3. Ir a la pestaña "Cuotas", confirmar que aparecen las 3 cuotas pendientes con el total correcto.
4. Marcar una cuota como pagada y confirmar que desaparece de la lista y que en Supabase su `status` pasó a `paid`.
5. Confirmar que el gasto original sigue apareciendo una sola vez en el dashboard de "Gastos" (no duplicado por las cuotas).
