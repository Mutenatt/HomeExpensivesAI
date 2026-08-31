import * as SQLite from "expo-sqlite";
import type { PaymentMethod } from "../types";

const DB_NAME = "homeexpenses.db";

export type LocalDb = SQLite.SQLiteDatabase;

let dbPromise: Promise<LocalDb> | null = null;

export function getLocalDb(): Promise<LocalDb> {
  if (!dbPromise) {
    dbPromise = openAndMigrate();
  }
  return dbPromise;
}

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

export function normalizeName(name: string): string {
  return name.trim().toLowerCase();
}

export interface ProductCacheRow {
  id: string;
  name: string;
  name_normalized: string;
  is_essential: number;
  usual_store: string | null;
  usual_payment_method: PaymentMethod | null;
  updated_at: string;
}

export async function searchCachedProducts(query: string, limit = 8): Promise<ProductCacheRow[]> {
  const db = await getLocalDb();
  const normalized = normalizeName(query);
  if (!normalized) return [];
  return db.getAllAsync<ProductCacheRow>(
    `SELECT * FROM products_cache WHERE name_normalized LIKE ? ORDER BY updated_at DESC LIMIT ?`,
    [`%${normalized}%`, limit],
  );
}

export async function upsertCachedProduct(product: {
  id: string;
  name: string;
  isEssential: boolean;
  usualStore?: string | null;
  usualPaymentMethod?: PaymentMethod | null;
}): Promise<void> {
  const db = await getLocalDb();
  await db.runAsync(
    `INSERT INTO products_cache (id, name, name_normalized, is_essential, usual_store, usual_payment_method, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?)
     ON CONFLICT(id) DO UPDATE SET
       name = excluded.name,
       name_normalized = excluded.name_normalized,
       is_essential = excluded.is_essential,
       usual_store = excluded.usual_store,
       usual_payment_method = excluded.usual_payment_method,
       updated_at = excluded.updated_at`,
    [
      product.id,
      product.name,
      normalizeName(product.name),
      product.isEssential ? 1 : 0,
      product.usualStore ?? null,
      product.usualPaymentMethod ?? null,
      new Date().toISOString(),
    ],
  );
}

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

export async function getUnsyncedTransactions(): Promise<PendingTransactionRow[]> {
  const db = await getLocalDb();
  return db.getAllAsync<PendingTransactionRow>(
    `SELECT * FROM pending_transactions WHERE synced = 0 ORDER BY created_at ASC`,
  );
}

export async function markTransactionSynced(localId: string): Promise<void> {
  const db = await getLocalDb();
  await db.runAsync(`UPDATE pending_transactions SET synced = 1 WHERE local_id = ?`, [localId]);
}
