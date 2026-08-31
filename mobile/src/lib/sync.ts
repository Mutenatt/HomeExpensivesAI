import { supabase } from "./supabase";
import { getUnsyncedTransactions, markTransactionSynced, upsertCachedProduct } from "./localDb";
import type { PaymentMethod, Product, ProductUsualContext } from "../types";

// Trae el catálogo de productos + su contexto habitual (tienda/método de pago más
// usado) a la cache local, para que el autocompletado del Clic 2 no dependa de la red.
export async function pullProductCatalog(userId: string): Promise<void> {
  const { data: products, error: productsError } = await supabase
    .from("products")
    .select("*")
    .eq("user_id", userId)
    .returns<Product[]>();
  if (productsError) throw productsError;

  const { data: contexts } = await supabase
    .from("product_usual_context")
    .select("*")
    .eq("user_id", userId)
    .returns<ProductUsualContext[]>();

  const contextByProduct = new Map((contexts ?? []).map((c) => [c.product_id, c]));

  for (const product of products ?? []) {
    const context = contextByProduct.get(product.id);
    await upsertCachedProduct({
      id: product.id,
      name: product.name,
      isEssential: product.is_essential,
      usualStore: context?.store_name ?? null,
      usualPaymentMethod: context?.payment_method ?? null,
    });
  }
}

// Empuja los gastos cargados offline (o que fallaron al guardarse) a Supabase.
// Best-effort: los que fallan quedan pendientes para el próximo intento.
export async function pushPendingTransactions(userId: string): Promise<{ synced: number; failed: number }> {
  const pending = await getUnsyncedTransactions();
  let synced = 0;
  let failed = 0;

  for (const tx of pending) {
    let productId = tx.product_id;

    if (!productId && tx.product_name_new) {
      const { data: product, error: upsertError } = await supabase
        .from("products")
        .upsert(
          { user_id: userId, name: tx.product_name_new, is_essential: !!tx.is_essential },
          { onConflict: "user_id,name_normalized" },
        )
        .select()
        .single<Product>();

      if (upsertError || !product) {
        failed += 1;
        continue;
      }
      productId = product.id;
      await upsertCachedProduct({ id: product.id, name: product.name, isEssential: product.is_essential });
    }

    const { error: insertError } = await supabase.from("transactions").insert({
      user_id: userId,
      amount: tx.amount,
      type: tx.type,
      payment_method: tx.payment_method as PaymentMethod,
      store_name: tx.store_name,
      product_id: productId,
      date: tx.date,
    });

    if (insertError) {
      failed += 1;
      continue;
    }

    await markTransactionSynced(tx.local_id);
    synced += 1;
  }

  return { synced, failed };
}
