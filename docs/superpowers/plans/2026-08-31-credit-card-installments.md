# UI de Cuotas de Tarjeta de Crédito — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [x]`) syntax for tracking.

**Goal:** Permitir cargar la cantidad de cuotas al registrar un gasto con tarjeta de crédito, generar el cronograma de pagos en Supabase, y ver/gestionar las cuotas pendientes desde una pantalla nueva.

**Architecture:** El monto total se sigue registrando como una única `transaction` (sin cambios en los totales/period-snapshot). Al sincronizar esa transacción, se calcula y persiste un cronograma de `installments` (ya soportado por el schema de Supabase existente, sin migraciones nuevas). Se agrega una pantalla nueva con navegación por tabs (React Navigation) para listar y marcar cuotas como pagadas.

**Tech Stack:** Expo SDK 57, React Native 0.86, TypeScript (strict), Supabase JS, expo-sqlite, React Navigation (bottom-tabs) — nuevo en este plan. Jest + ts-jest — nuevo en este plan, solo para la lógica pura de cálculo.

## Global Constraints

- Spec de referencia: `docs/superpowers/specs/2026-08-31-credit-card-installments-design.md` — toda ambigüedad se resuelve a favor de lo que ahí está escrito.
- El schema remoto de Supabase (`installments`, con `total_installments`, `amount_per_installment`, `due_date`, `status`) ya existe (`supabase/migrations/20260831120000_initial_schema.sql`). **No se necesita ninguna migración de Supabase nueva** para este plan.
- Copy de la UI en español, consistente con el resto de la app (`AuthScreen`, `DashboardScreen`, `QuickAddExpenseSheet`).
- Paleta de colores existente a reutilizar: verde `#16a34a` (acciones positivas/guardar), rojo `#dc2626` (gasto), azul `#2563eb` (acción primaria/pill activa), grises `#888`/`#f2f2f2` (texto secundario/separadores). No introducir colores nuevos.
- Este repo no tiene framework de testing de UI/integración. Este plan agrega Jest únicamente para la lógica pura de `mobile/src/lib/installments.ts` (sin dependencias de React Native). El resto de las tareas se verifica manualmente contra el dev server de Expo (modo web) y consultas directas a Supabase, como se definió en la sección "Testing/verificación" del spec.
- Instalación de paquetes nativos de Expo (React Navigation y sus peer deps): usar siempre `npx expo install <paquete>` en vez de `npm install`, para que Expo resuelva versiones compatibles con el SDK 57 del proyecto.
- La tabla local `pending_transactions` (SQLite) no tiene un sistema de migraciones versionado — solo `CREATE TABLE IF NOT EXISTS`. Este plan introduce el primer `ALTER TABLE ... ADD COLUMN` envuelto en try/catch como patrón para agregar columnas nuevas sin romper instalaciones existentes de la app.

---

### Task 1: Lógica de cálculo del cronograma de cuotas

**Files:**
- Create: `mobile/src/lib/installments.ts`
- Create: `mobile/src/lib/installments.test.ts`
- Create: `mobile/jest.config.js`
- Modify: `mobile/package.json` (agrega devDependencies y script `test`)

**Interfaces:**
- Produces: `calculateInstallmentSchedule(totalAmount: number, totalInstallments: number, purchaseDate: Date): InstallmentScheduleItem[]`, donde `InstallmentScheduleItem = { installment_number: number; total_installments: number; amount_per_installment: number; due_date: string }` (`due_date` en formato `"YYYY-MM-DD"`). Usado por Task 3 (`sync.ts`).

- [x] **Step 1: Instalar Jest y ts-jest**

Run: `cd mobile && npm install --save-dev jest ts-jest @types/jest`
Expected: `mobile/package.json` y `mobile/package-lock.json` actualizados con las 3 dependencias nuevas en `devDependencies`.

- [x] **Step 2: Configurar Jest**

Crear `mobile/jest.config.js`:

```js
/** @type {import('jest').Config} */
module.exports = {
  preset: "ts-jest",
  testEnvironment: "node",
  testPathIgnorePatterns: ["/node_modules/"],
};
```

Agregar en `mobile/package.json`, dentro de `"scripts"`:

```json
"test": "jest"
```

- [x] **Step 3: Escribir los tests (deben fallar primero)**

Crear `mobile/src/lib/installments.test.ts`:

```ts
import { calculateInstallmentSchedule } from "./installments";

describe("calculateInstallmentSchedule", () => {
  it("devuelve [] cuando hay 1 cuota o menos", () => {
    expect(calculateInstallmentSchedule(1000, 1, new Date(2026, 7, 31))).toEqual([]);
    expect(calculateInstallmentSchedule(1000, 0, new Date(2026, 7, 31))).toEqual([]);
  });

  it("reparte el monto exacto cuando divide justo, con fechas mensuales clampeadas a fin de mes", () => {
    const schedule = calculateInstallmentSchedule(120000, 12, new Date(2026, 7, 31)); // 31 ago 2026

    expect(schedule).toHaveLength(12);
    expect(schedule.every((item) => item.amount_per_installment === 10000)).toBe(true);
    expect(schedule.reduce((sum, item) => sum + item.amount_per_installment, 0)).toBe(120000);

    // Ago 31 + 1 mes -> Set no tiene día 31, clampea a Sep 30
    expect(schedule[0].due_date).toBe("2026-09-30");
    // Ago 31 + 4 meses -> Dic 31
    expect(schedule[3].due_date).toBe("2026-12-31");
    // Ago 31 + 6 meses -> Feb 2027 (no bisiesto) tiene 28 días
    expect(schedule[5].due_date).toBe("2027-02-28");
    // Ago 31 + 12 meses -> Ago 31 2027
    expect(schedule[11].due_date).toBe("2027-08-31");
  });

  it("pone el resto del redondeo en la última cuota", () => {
    const schedule = calculateInstallmentSchedule(100, 3, new Date(2026, 0, 15));

    expect(schedule).toHaveLength(3);
    expect(schedule[0].amount_per_installment).toBe(33.33);
    expect(schedule[1].amount_per_installment).toBe(33.33);
    expect(schedule[2].amount_per_installment).toBe(33.34);
    expect(schedule.reduce((sum, item) => sum + item.amount_per_installment, 0)).toBeCloseTo(100, 2);
  });

  it("clampea a 29 de febrero en año bisiesto", () => {
    const schedule = calculateInstallmentSchedule(200, 1 /* placeholder, se pisa abajo */, new Date(2028, 0, 31));
    // 1 cuota no genera cronograma; forzamos 2 cuotas para poder observar el clamp en la cuota 1.
    const scheduleWithTwo = calculateInstallmentSchedule(200, 2, new Date(2028, 0, 31)); // 31 ene 2028 (bisiesto)
    expect(scheduleWithTwo[0].due_date).toBe("2028-02-29");
    expect(schedule).toEqual([]);
  });

  it("numera las cuotas correctamente y repite total_installments en cada item", () => {
    const schedule = calculateInstallmentSchedule(300, 3, new Date(2026, 5, 10));
    expect(schedule.map((item) => item.installment_number)).toEqual([1, 2, 3]);
    expect(schedule.every((item) => item.total_installments === 3)).toBe(true);
  });
});
```

- [x] **Step 4: Correr los tests y verificar que fallan**

Run: `cd mobile && npm test`
Expected: FAIL — `Cannot find module './installments'` (el archivo `installments.ts` todavía no existe).

- [x] **Step 5: Implementar `calculateInstallmentSchedule`**

Crear `mobile/src/lib/installments.ts`:

```ts
export interface InstallmentScheduleItem {
  installment_number: number;
  total_installments: number;
  amount_per_installment: number;
  due_date: string;
}

// Suma `months` a `date` y clampea el día al último día del mes destino
// cuando el día original no existe ahí (ej. 31 ene + 1 mes -> 28/29 feb).
function addMonthsClamped(date: Date, months: number): Date {
  const targetMonthIndex = date.getMonth() + months;
  const year = date.getFullYear() + Math.floor(targetMonthIndex / 12);
  const month = ((targetMonthIndex % 12) + 12) % 12;
  const lastDayOfTargetMonth = new Date(year, month + 1, 0).getDate();
  const day = Math.min(date.getDate(), lastDayOfTargetMonth);
  return new Date(year, month, day);
}

function toDateOnly(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

// El monto ingresado es el total de la compra; se reparte en `totalInstallments`
// cuotas iguales. El resto de centavos por redondeo queda en la última cuota,
// para que la suma cierre exacto con el total (se trabaja en centavos enteros
// para evitar errores de punto flotante).
export function calculateInstallmentSchedule(
  totalAmount: number,
  totalInstallments: number,
  purchaseDate: Date,
): InstallmentScheduleItem[] {
  if (totalInstallments <= 1) return [];

  const totalCents = Math.round(totalAmount * 100);
  const baseCents = Math.floor(totalCents / totalInstallments);
  const lastCents = totalCents - baseCents * (totalInstallments - 1);

  const schedule: InstallmentScheduleItem[] = [];
  for (let i = 1; i <= totalInstallments; i++) {
    const cents = i === totalInstallments ? lastCents : baseCents;
    schedule.push({
      installment_number: i,
      total_installments: totalInstallments,
      amount_per_installment: cents / 100,
      due_date: toDateOnly(addMonthsClamped(purchaseDate, i)),
    });
  }
  return schedule;
}
```

- [x] **Step 6: Correr los tests y verificar que pasan**

Run: `cd mobile && npm test`
Expected: PASS — 5 tests, 0 failures.

- [x] **Step 7: Commit**

```bash
cd mobile
git add package.json package-lock.json jest.config.js src/lib/installments.ts src/lib/installments.test.ts
git commit -m "feat: calcular cronograma de cuotas de tarjeta de crédito"
```

---

### Task 2: Cola local de sincronización — soporte para cuotas

**Files:**
- Modify: `mobile/src/lib/localDb.ts:17-49` (migración de columna nueva)
- Modify: `mobile/src/lib/localDb.ts:105-136` (`PendingTransactionInput`, `enqueuePendingTransaction`)
- Modify: `mobile/src/lib/localDb.ts:138-150` (`PendingTransactionRow`)

**Interfaces:**
- Consumes: nada nuevo de otras tareas.
- Produces: `PendingTransactionInput.totalInstallments: number | null` y `PendingTransactionRow.total_installments: number | null`. Usado por Task 3 (`sync.ts`) y Task 4 (`QuickAddExpenseSheet.tsx`).

- [x] **Step 1: Agregar la columna `total_installments` a `pending_transactions`**

En `mobile/src/lib/localDb.ts`, dentro de `openAndMigrate` (después del `db.execAsync` que crea las tablas, antes del `return db;`):

```ts
async function openAndMigrate(): Promise<LocalDb> {
  const db = await SQLite.openDatabaseAsync(DB_NAME);
  await db.execAsync(`
    PRAGMA journal_mode = WAL;

    CREATE TABLE IF NOT EXISTS products_cache (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      name_normalized TEXT NOT NULL,
      is_essential INTEGER NOT NULL DEFAULT 0,
      usual_store TEXT,
      usual_payment_method TEXT,
      updated_at TEXT NOT NULL
    );
    CREATE INDEX IF NOT EXISTS idx_products_cache_name_normalized
      ON products_cache (name_normalized);

    CREATE TABLE IF NOT EXISTS pending_transactions (
      local_id TEXT PRIMARY KEY,
      amount REAL NOT NULL,
      type TEXT NOT NULL,
      payment_method TEXT NOT NULL,
      store_name TEXT,
      product_id TEXT,
      product_name_new TEXT,
      is_essential INTEGER NOT NULL DEFAULT 0,
      date TEXT NOT NULL,
      created_at TEXT NOT NULL,
      synced INTEGER NOT NULL DEFAULT 0
    );
  `);

  // SQLite no soporta "ADD COLUMN IF NOT EXISTS": si la columna ya existe
  // (instalaciones previas de la app), el ALTER falla y se ignora ese error.
  try {
    await db.execAsync(`ALTER TABLE pending_transactions ADD COLUMN total_installments INTEGER;`);
  } catch {
    // columna ya presente, no-op
  }

  return db;
}
```

- [x] **Step 2: Extender `PendingTransactionInput` y `enqueuePendingTransaction`**

Reemplazar la interfaz y función actuales:

```ts
export interface PendingTransactionInput {
  localId: string;
  amount: number;
  type: "income" | "expense";
  paymentMethod: PaymentMethod;
  storeName: string | null;
  productId: string | null;
  productNameNew: string | null;
  isEssential: boolean;
  date: string;
  totalInstallments: number | null;
}

export async function enqueuePendingTransaction(input: PendingTransactionInput): Promise<void> {
  const db = await getLocalDb();
  await db.runAsync(
    `INSERT INTO pending_transactions
       (local_id, amount, type, payment_method, store_name, product_id, product_name_new, is_essential, date, created_at, synced, total_installments)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0, ?)`,
    [
      input.localId,
      input.amount,
      input.type,
      input.paymentMethod,
      input.storeName,
      input.productId,
      input.productNameNew,
      input.isEssential ? 1 : 0,
      input.date,
      new Date().toISOString(),
      input.totalInstallments,
    ],
  );
}
```

- [x] **Step 3: Extender `PendingTransactionRow`**

```ts
export interface PendingTransactionRow {
  local_id: string;
  amount: number;
  type: "income" | "expense";
  payment_method: PaymentMethod;
  store_name: string | null;
  product_id: string | null;
  product_name_new: string | null;
  is_essential: number;
  date: string;
  created_at: string;
  synced: number;
  total_installments: number | null;
}
```

- [x] **Step 4: Verificar tipos**

Run: `cd mobile && npx tsc --noEmit`
Expected: sin errores nuevos (los llamadores de `enqueuePendingTransaction`/`enqueuePendingTransaction` todavía no pasan `totalInstallments` — eso se corrige en Task 4; hasta entonces es esperable un error de tipo en `QuickAddExpenseSheet.tsx` marcando que falta la propiedad `totalInstallments`. Confirmar que ese es el único archivo con error nuevo).

- [x] **Step 5: Commit**

```bash
cd mobile
git add src/lib/localDb.ts
git commit -m "feat: soportar cantidad de cuotas en la cola local de gastos pendientes"
```

---

### Task 3: Generar el cronograma de cuotas al sincronizar

**Files:**
- Modify: `mobile/src/lib/sync.ts:35-83` (`pushPendingTransactions`)

**Interfaces:**
- Consumes: `calculateInstallmentSchedule` de Task 1 (`./installments`); `PendingTransactionRow.total_installments` de Task 2.
- Produces: nada nuevo consumido por otras tareas — es el punto final de la cadena de sync.

- [x] **Step 1: Importar la función de cálculo**

En `mobile/src/lib/sync.ts`, agregar el import junto a los existentes:

```ts
import { calculateInstallmentSchedule } from "./installments";
```

- [x] **Step 2: Capturar el id de la transacción insertada y generar las cuotas**

Reemplazar el bloque del insert de `transactions` en `pushPendingTransactions` (dentro del `for (const tx of pending)`):

```ts
    const { data: insertedTx, error: insertError } = await supabase
      .from("transactions")
      .insert({
        user_id: userId,
        amount: tx.amount,
        type: tx.type,
        payment_method: tx.payment_method as PaymentMethod,
        store_name: tx.store_name,
        product_id: productId,
        date: tx.date,
      })
      .select("id")
      .single<{ id: string }>();

    if (insertError || !insertedTx) {
      failed += 1;
      continue;
    }

    if (tx.payment_method === "credit_card" && tx.total_installments && tx.total_installments > 1) {
      const schedule = calculateInstallmentSchedule(tx.amount, tx.total_installments, new Date(tx.date));
      const { error: installmentsError } = await supabase.from("installments").insert(
        schedule.map((item) => ({
          transaction_id: insertedTx.id,
          user_id: userId,
          installment_number: item.installment_number,
          total_installments: item.total_installments,
          amount_per_installment: item.amount_per_installment,
          due_date: item.due_date,
          status: "pending" as const,
        })),
      );

      if (installmentsError) {
        // Best-effort: la transacción ya se guardó y es la fuente de verdad
        // para los totales. No reintentamos el cronograma para no arriesgar
        // duplicar la transacción en un reintento (el insert de transactions
        // no es idempotente).
        console.warn("No se pudo generar el cronograma de cuotas:", installmentsError.message);
      }
    }

    await markTransactionSynced(tx.local_id);
    synced += 1;
```

Este bloque reemplaza por completo el `insert` original (que no capturaba el id) y todo lo que iba desde ahí hasta el `synced += 1;` final del loop.

- [x] **Step 3: Verificar tipos**

Run: `cd mobile && npx tsc --noEmit`
Expected: sin errores nuevos en `sync.ts`.

- [x] **Step 4: Commit**

```bash
cd mobile
git add src/lib/sync.ts
git commit -m "feat: generar cronograma de cuotas al sincronizar gastos con tarjeta de crédito"
```

---

### Task 4: Quick Add — capturar cantidad de cuotas

**Files:**
- Modify: `mobile/src/components/QuickAddExpenseSheet.tsx`

**Interfaces:**
- Consumes: `PendingTransactionInput.totalInstallments` de Task 2.
- Produces: nada consumido por otras tareas (es la punta de la UI).

- [x] **Step 1: Agregar la constante de opciones y el estado nuevo**

Agregar arriba del componente, después de los imports:

```ts
const INSTALLMENT_OPTIONS = [3, 6, 9, 12, 18, 24];
```

Reemplazar `emptyState`:

```ts
const emptyState = {
  amount: "",
  type: "expense" as TransactionType,
  productQuery: "",
  suggestions: [] as ProductCacheRow[],
  selectedProduct: null as ProductCacheRow | null,
  storeName: "",
  paymentMethod: null as PaymentMethod | null,
  isEssential: false,
  installments: null as number | null,
  showCustomInstallmentsInput: false,
};
```

- [x] **Step 2: Resetear cuotas al cambiar de método de pago**

Reemplazar el `onPress` de los pills de `PAYMENT_METHODS`:

```tsx
{PAYMENT_METHODS.map((pm) => (
  <Pressable
    key={pm.value}
    style={[styles.paymentPill, state.paymentMethod === pm.value && styles.paymentPillActive]}
    onPress={() =>
      setState((s) => ({
        ...s,
        paymentMethod: pm.value,
        installments: pm.value === "credit_card" ? s.installments : null,
        showCustomInstallmentsInput: pm.value === "credit_card" ? s.showCustomInstallmentsInput : false,
      }))
    }
  >
```

(el resto del `Pressable` — `Text` interno — queda igual)

- [x] **Step 3: Agregar la sub-sección de cuotas**

Insertar este bloque JSX inmediatamente después del `paymentRow` (View con los pills de método de pago) y antes de `actionsRow`:

```tsx
{state.type === "expense" && state.paymentMethod === "credit_card" && (
  <View style={styles.installmentsSection}>
    <Text style={styles.essentialLabel}>¿En cuántas cuotas?</Text>
    <View style={styles.paymentRow}>
      {INSTALLMENT_OPTIONS.map((n) => (
        <Pressable
          key={n}
          style={[
            styles.paymentPill,
            state.installments === n && !state.showCustomInstallmentsInput && styles.paymentPillActive,
          ]}
          onPress={() => setState((s) => ({ ...s, installments: n, showCustomInstallmentsInput: false }))}
        >
          <Text
            style={[
              styles.paymentPillText,
              state.installments === n && !state.showCustomInstallmentsInput && styles.paymentPillTextActive,
            ]}
          >
            {n}
          </Text>
        </Pressable>
      ))}
      <Pressable
        style={[styles.paymentPill, state.showCustomInstallmentsInput && styles.paymentPillActive]}
        onPress={() => setState((s) => ({ ...s, showCustomInstallmentsInput: true, installments: null }))}
      >
        <Text style={[styles.paymentPillText, state.showCustomInstallmentsInput && styles.paymentPillTextActive]}>
          Otra
        </Text>
      </Pressable>
    </View>
    {state.showCustomInstallmentsInput && (
      <TextInput
        style={styles.input}
        placeholder="Cantidad de cuotas"
        keyboardType="number-pad"
        value={state.installments !== null ? String(state.installments) : ""}
        onChangeText={(text) => {
          const parsed = parseInt(text, 10);
          setState((s) => ({
            ...s,
            installments: Number.isFinite(parsed) && parsed > 0 ? parsed : null,
          }));
        }}
      />
    )}
  </View>
)}
```

- [x] **Step 4: Agregar el estilo `installmentsSection`**

En el `StyleSheet.create` al final del archivo, agregar:

```ts
installmentsSection: { gap: 8 },
```

- [x] **Step 5: Actualizar `canSave` y `handleSave`**

Reemplazar:

```ts
const parsedAmount = Number(state.amount.replace(",", "."));
const needsInstallments = state.type === "expense" && state.paymentMethod === "credit_card";
const canSave =
  parsedAmount > 0 &&
  state.paymentMethod !== null &&
  (!needsInstallments || (state.installments !== null && state.installments >= 1)) &&
  !saving;

async function handleSave() {
  if (!canSave || state.paymentMethod === null) return;
  setSaving(true);
  try {
    const localId = `${Date.now()}-${Math.random().toString(36).slice(2)}`;
    await enqueuePendingTransaction({
      localId,
      amount: parsedAmount,
      type: state.type,
      paymentMethod: state.paymentMethod,
      storeName: state.storeName.trim() || null,
      productId: state.selectedProduct?.id ?? null,
      productNameNew:
        !state.selectedProduct && state.productQuery.trim() ? state.productQuery.trim() : null,
      isEssential: state.isEssential,
      date: new Date().toISOString(),
      totalInstallments: needsInstallments ? state.installments : null,
    });
    reset();
    onSaved();
  } finally {
    setSaving(false);
  }
}
```

- [x] **Step 6: Verificar tipos**

Run: `cd mobile && npx tsc --noEmit`
Expected: 0 errores (el error de `totalInstallments` faltante de la Task 2 queda resuelto).

- [x] **Step 7: Verificación manual en el dev server**

Run: `cd mobile && npm run web`
En el navegador: abrir el Quick Add (`+ Gasto`), tocar el pill "Crédito" → debe aparecer la sub-sección "¿En cuántas cuotas?" con los pills 3/6/9/12/18/24 y "Otra". Tocar "Otra" → debe aparecer un input numérico. Cambiar el método de pago a "Efectivo" → la sub-sección debe desaparecer. Con "Crédito" seleccionado y sin elegir cuotas, el botón "Guardar" debe quedar deshabilitado; al elegir una cantidad, se habilita.
Expected: comportamiento descrito se cumple visualmente.

- [x] **Step 8: Commit**

```bash
cd mobile
git add src/components/QuickAddExpenseSheet.tsx
git commit -m "feat: capturar cantidad de cuotas al cargar un gasto con tarjeta de crédito"
```

---

### Task 5: Navegación por tabs y pantalla de Cuotas pendientes

**Files:**
- Modify: `mobile/package.json` (nuevas dependencias)
- Create: `mobile/src/screens/InstallmentsScreen.tsx`
- Modify: `mobile/App.tsx`

**Interfaces:**
- Consumes: `Installment` type de `mobile/src/types/index.ts` (ya existe, sin cambios); `supabase` client de `mobile/src/lib/supabase.ts`.
- Produces: `InstallmentsScreen({ userId }: { userId: string })`, componente React default export nombrado, consumido por `App.tsx`.

- [x] **Step 1: Instalar React Navigation**

Run: `cd mobile && npx expo install @react-navigation/native react-native-screens react-native-safe-area-context @react-navigation/bottom-tabs`
Expected: `mobile/package.json` actualizado con las 4 dependencias en `dependencies` (no dev), versiones resueltas por Expo para SDK 57.

- [x] **Step 2: Crear `InstallmentsScreen`**

Crear `mobile/src/screens/InstallmentsScreen.tsx`:

```tsx
import { useCallback, useEffect, useState } from "react";
import { FlatList, Pressable, StyleSheet, Text, View } from "react-native";
import { supabase } from "../lib/supabase";
import type { Installment } from "../types";

interface Props {
  userId: string;
}

type InstallmentWithTransaction = Installment & {
  transaction: { store_name: string | null; product: { name: string } | null } | null;
};

function formatDueDate(dueDate: string): string {
  const [year, month, day] = dueDate.split("-");
  return `${day}/${month}/${year}`;
}

export function InstallmentsScreen({ userId }: Props) {
  const [installments, setInstallments] = useState<InstallmentWithTransaction[]>([]);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    const { data } = await supabase
      .from("installments")
      .select("*, transaction:transactions(store_name, product:products(name))")
      .eq("user_id", userId)
      .eq("status", "pending")
      .order("due_date", { ascending: true })
      .returns<InstallmentWithTransaction[]>();
    setInstallments(data ?? []);
    setLoading(false);
  }, [userId]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  async function handleMarkPaid(id: string) {
    setInstallments((current) => current.filter((item) => item.id !== id));
    const { error } = await supabase
      .from("installments")
      .update({ status: "paid" })
      .eq("id", id)
      .eq("user_id", userId);
    if (error) {
      await refresh();
    }
  }

  const total = installments.reduce((sum, item) => sum + item.amount_per_installment, 0);

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Cuotas pendientes</Text>
        {!loading && <Text style={styles.headerTotal}>Total: ${total.toFixed(2)}</Text>}
      </View>

      <FlatList
        data={installments}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.listContent}
        renderItem={({ item }) => (
          <View style={styles.row}>
            <View style={styles.rowInfo}>
              <Text style={styles.rowTitle}>
                {item.transaction?.product?.name ?? item.transaction?.store_name ?? "Cuota"}
              </Text>
              <Text style={styles.rowSubtitle}>
                Cuota {item.installment_number} de {item.total_installments} · vence{" "}
                {formatDueDate(item.due_date)}
              </Text>
            </View>
            <View style={styles.rowActions}>
              <Text style={styles.rowAmount}>${item.amount_per_installment.toFixed(2)}</Text>
              <Pressable style={styles.payButton} onPress={() => handleMarkPaid(item.id)}>
                <Text style={styles.payButtonText}>Marcar pagada</Text>
              </Pressable>
            </View>
          </View>
        )}
        ListEmptyComponent={
          !loading ? <Text style={styles.emptyText}>No tenés cuotas pendientes.</Text> : null
        }
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#fff" },
  header: { paddingTop: 60, paddingHorizontal: 20, paddingBottom: 12 },
  headerTitle: { fontSize: 24, fontWeight: "700" },
  headerTotal: { fontSize: 15, color: "#555", marginTop: 4 },
  listContent: { paddingHorizontal: 20, paddingBottom: 40 },
  row: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: "#f2f2f2",
  },
  rowInfo: { flex: 1, paddingRight: 12 },
  rowTitle: { fontSize: 16, fontWeight: "600" },
  rowSubtitle: { fontSize: 13, color: "#888", marginTop: 2 },
  rowActions: { alignItems: "flex-end", gap: 6 },
  rowAmount: { fontSize: 16, fontWeight: "700" },
  payButton: {
    backgroundColor: "#16a34a",
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderRadius: 8,
  },
  payButtonText: { color: "#fff", fontSize: 12, fontWeight: "600" },
  emptyText: { textAlign: "center", color: "#888", marginTop: 40 },
});
```

- [x] **Step 3: Wire la navegación por tabs en `App.tsx`**

Reemplazar el contenido completo de `mobile/App.tsx`:

```tsx
import { StatusBar } from 'expo-status-bar';
import { useEffect, useState } from 'react';
import { ActivityIndicator, StyleSheet, View } from 'react-native';
import { NavigationContainer } from '@react-navigation/native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import type { Session } from '@supabase/supabase-js';
import { AuthScreen } from './src/screens/AuthScreen';
import { DashboardScreen } from './src/screens/DashboardScreen';
import { InstallmentsScreen } from './src/screens/InstallmentsScreen';
import { supabase } from './src/lib/supabase';
import { getLocalDb } from './src/lib/localDb';

const Tab = createBottomTabNavigator();

function AppTabs({ userId }: { userId: string }) {
  return (
    <NavigationContainer>
      <Tab.Navigator screenOptions={{ headerShown: false }}>
        <Tab.Screen name="Gastos">{() => <DashboardScreen userId={userId} />}</Tab.Screen>
        <Tab.Screen name="Cuotas">{() => <InstallmentsScreen userId={userId} />}</Tab.Screen>
      </Tab.Navigator>
    </NavigationContainer>
  );
}

export default function App() {
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    getLocalDb();
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session);
      setLoading(false);
    });
    const { data: subscription } = supabase.auth.onAuthStateChange((_event, newSession) => {
      setSession(newSession);
    });
    return () => subscription.subscription.unsubscribe();
  }, []);

  if (loading) {
    return (
      <View style={styles.container}>
        <ActivityIndicator size="large" />
      </View>
    );
  }

  return (
    <>
      {session ? <AppTabs userId={session.user.id} /> : <AuthScreen />}
      <StatusBar style="auto" />
    </>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
    alignItems: 'center',
    justifyContent: 'center',
  },
});
```

- [x] **Step 4: Verificar tipos**

Run: `cd mobile && npx tsc --noEmit`
Expected: 0 errores.

- [x] **Step 5: Verificación manual en el dev server**

Run: `cd mobile && npm run web`
Expected: la app carga con una barra de tabs abajo ("Gastos" / "Cuotas"). La pestaña "Gastos" se ve y funciona igual que antes (FAB, lista, Quick Add). La pestaña "Cuotas" muestra "No tenés cuotas pendientes." (todavía no se cargó ningún gasto en cuotas).

- [x] **Step 6: Commit**

```bash
cd mobile
git add package.json package-lock.json src/screens/InstallmentsScreen.tsx App.tsx
git commit -m "feat: agregar navegación por tabs y pantalla de cuotas pendientes"
```

---

### Task 6: Verificación end-to-end del flujo completo

**Files:** ninguno (solo verificación; si aparece algún bug se corrige en el archivo correspondiente y se commitea aparte).

- [x] **Step 1: Cargar un gasto en cuotas**

Run: `cd mobile && npm run web` (si no sigue corriendo de la Task 5)
En el navegador: loguearse (o registrarse) con un usuario de prueba. Tocar `+ Gasto`, ingresar monto `12000`, tipo "Gasto", producto "Notebook", tienda "Tienda X", método de pago "Crédito", cuotas "3", guardar.

- [x] **Step 2: Confirmar en Supabase que se creó la transacción y las 3 cuotas**

Usar `mcp__supabase__execute_sql` contra el proyecto `pxqjejfqmeskgqjncfdi`:

```sql
select t.id, t.amount, t.payment_method, i.installment_number, i.total_installments, i.amount_per_installment, i.due_date, i.status
from transactions t
join installments i on i.transaction_id = t.id
where t.store_name = 'Tienda X'
order by i.installment_number;
```

Expected: 3 filas. `amount_per_installment` de las 2 primeras = `4000`, la tercera = `4000` (12000/3 divide exacto). `due_date` de la cuota 1 = un mes después de la fecha de hoy (mismo día, salvo clamp de fin de mes). `status = 'pending'` en las 3.

- [x] **Step 3: Confirmar que la pestaña "Cuotas" muestra las 3 cuotas y el total correcto**

En el navegador: ir a la pestaña "Cuotas".
Expected: 3 filas "Notebook · Cuota N de 3 · vence DD/MM/AAAA" con monto `$4000.00` cada una, header "Total: $12000.00".

- [x] **Step 4: Marcar una cuota como pagada**

En el navegador: tocar "Marcar pagada" en la primera cuota.
Expected: la fila desaparece de la lista inmediatamente y el total baja a `$8000.00`.

Verificar en Supabase:

```sql
select installment_number, status from installments
where transaction_id = (select id from transactions where store_name = 'Tienda X')
order by installment_number;
```

Expected: la cuota 1 tiene `status = 'paid'`, las cuotas 2 y 3 siguen en `'pending'`.

- [x] **Step 5: Confirmar que el gasto no se duplicó en el dashboard**

En el navegador: ir a la pestaña "Gastos".
Expected: aparece un único registro "Notebook" por `$12000.00` (el monto total de la compra, no una fila por cuota).

- [x] **Step 6: Limpiar los datos de prueba (opcional)**

Run vía `mcp__supabase__execute_sql`:

```sql
delete from transactions where store_name = 'Tienda X';
```

Expected: las `installments` asociadas se borran en cascada (`on delete cascade` en `installments.transaction_id`).
