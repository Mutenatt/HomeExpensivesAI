import { useCallback, useEffect, useState } from "react";
import { FlatList, Pressable, StyleSheet, Text, View } from "react-native";
import { QuickAddExpenseSheet } from "../components/QuickAddExpenseSheet";
import { getUnsyncedTransactions } from "../lib/localDb";
import { paymentMethodLabel } from "../lib/paymentMethods";
import { registerForPushNotifications } from "../lib/notifications";
import { supabase } from "../lib/supabase";
import { pullProductCatalog, pushPendingTransactions } from "../lib/sync";
import type { Transaction } from "../types";

interface Props {
  userId: string;
}

type TransactionWithProduct = Transaction & { product: { name: string } | null };

export function DashboardScreen({ userId }: Props) {
  const [transactions, setTransactions] = useState<TransactionWithProduct[]>([]);
  const [pendingCount, setPendingCount] = useState(0);
  const [sheetVisible, setSheetVisible] = useState(false);

  const refresh = useCallback(async () => {
    const { data } = await supabase
      .from("transactions")
      .select("*, product:products(name)")
      .eq("user_id", userId)
      .is("deleted_at", null)
      .order("date", { ascending: false })
      .limit(30)
      .returns<TransactionWithProduct[]>();
    setTransactions(data ?? []);

    const pending = await getUnsyncedTransactions();
    setPendingCount(pending.length);
  }, [userId]);

  useEffect(() => {
    (async () => {
      await pullProductCatalog(userId).catch(() => {});
      await pushPendingTransactions(userId).catch(() => {});
      await registerForPushNotifications(userId).catch(() => {});
      await refresh();
    })();
  }, [userId, refresh]);

  async function handleSaved() {
    setSheetVisible(false);
    await pushPendingTransactions(userId).catch(() => {});
    await refresh();
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Tus gastos</Text>
        {pendingCount > 0 && (
          <Text style={styles.pendingBadge}>{pendingCount} sin sincronizar</Text>
        )}
      </View>

      <FlatList
        data={transactions}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.listContent}
        renderItem={({ item }) => (
          <View style={styles.row}>
            <View>
              <Text style={styles.rowTitle}>{item.product?.name ?? (item.type === "income" ? "Ingreso" : "Gasto")}</Text>
              <Text style={styles.rowSubtitle}>
                {item.store_name ? `${item.store_name} · ` : ""}
                {paymentMethodLabel(item.payment_method)}
              </Text>
            </View>
            <Text style={[styles.rowAmount, item.type === "income" ? styles.income : styles.expense]}>
              {item.type === "income" ? "+" : "-"}${item.amount.toFixed(2)}
            </Text>
          </View>
        )}
        ListEmptyComponent={<Text style={styles.emptyText}>Todavía no registraste ningún gasto.</Text>}
      />

      <Pressable style={styles.fab} onPress={() => setSheetVisible(true)}>
        <Text style={styles.fabText}>+ Gasto</Text>
      </Pressable>

      <QuickAddExpenseSheet
        visible={sheetVisible}
        onClose={() => setSheetVisible(false)}
        onSaved={handleSaved}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#fff" },
  header: { paddingTop: 60, paddingHorizontal: 20, paddingBottom: 12 },
  headerTitle: { fontSize: 24, fontWeight: "700" },
  pendingBadge: { color: "#b45309", marginTop: 4 },
  listContent: { paddingHorizontal: 20, paddingBottom: 120 },
  row: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: "#f2f2f2",
  },
  rowTitle: { fontSize: 16, fontWeight: "600" },
  rowSubtitle: { fontSize: 13, color: "#888", marginTop: 2 },
  rowAmount: { fontSize: 16, fontWeight: "700" },
  income: { color: "#16a34a" },
  expense: { color: "#dc2626" },
  emptyText: { textAlign: "center", color: "#888", marginTop: 40 },
  fab: {
    position: "absolute",
    right: 20,
    bottom: 40,
    backgroundColor: "#16a34a",
    paddingVertical: 16,
    paddingHorizontal: 24,
    borderRadius: 30,
    elevation: 4,
    shadowColor: "#000",
    shadowOpacity: 0.2,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 2 },
  },
  fabText: { color: "#fff", fontWeight: "700", fontSize: 16 },
});
