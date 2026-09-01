import { useCallback, useEffect, useState } from "react";
import { FlatList, StyleSheet, Text, View } from "react-native";
import { QuickAddExpenseSheet } from "../components/QuickAddExpenseSheet";
import { Fab } from "../components/Fab";
import { getUnsyncedTransactions } from "../lib/localDb";
import { paymentMethodLabel } from "../lib/paymentMethods";
import { registerForPushNotifications } from "../lib/notifications";
import { supabase } from "../lib/supabase";
import { pullProductCatalog, pushPendingTransactions } from "../lib/sync";
import { colors, radius, shadows, spacing, typography } from "../theme";
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
        renderItem={({ item }) => {
          const isIncome = item.type === "income";
          return (
            <View style={[styles.row, isIncome ? styles.rowIncome : styles.rowExpense]}>
              <View>
                <Text style={styles.rowTitle}>
                  {item.product?.name ?? (isIncome ? "Ingreso" : "Gasto")}
                </Text>
                <Text style={styles.rowSubtitle}>
                  {item.store_name ? `${item.store_name} · ` : ""}
                  {paymentMethodLabel(item.payment_method)}
                </Text>
              </View>
              <Text style={[styles.rowAmount, isIncome ? styles.income : styles.expense]}>
                {isIncome ? "+" : "-"}${item.amount.toFixed(2)}
              </Text>
            </View>
          );
        }}
        ListEmptyComponent={<Text style={styles.emptyText}>Todavía no registraste ningún gasto.</Text>}
      />

      <Fab onPress={() => setSheetVisible(true)} />

      <QuickAddExpenseSheet
        visible={sheetVisible}
        onClose={() => setSheetVisible(false)}
        onSaved={handleSaved}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bgBase },
  header: { paddingTop: 60, paddingHorizontal: spacing.lg, paddingBottom: spacing.sm },
  headerTitle: { ...typography.headingMd, fontSize: 24, color: colors.textPrimary },
  pendingBadge: { ...typography.bodySm, color: colors.warning, marginTop: 4 },
  listContent: { paddingHorizontal: spacing.lg, paddingBottom: 160, gap: spacing.sm },
  row: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.md,
    borderRadius: radius.md,
    ...shadows.soft,
  },
  rowIncome: { backgroundColor: colors.positiveSurface },
  rowExpense: { backgroundColor: colors.negativeSurface },
  rowTitle: { ...typography.bodyMd, color: colors.textPrimary, fontWeight: "700" },
  rowSubtitle: { ...typography.bodySm, color: colors.textSecondary, marginTop: 2 },
  rowAmount: { ...typography.bodyMd, fontWeight: "700" },
  income: { color: colors.positive },
  expense: { color: colors.negative },
  emptyText: { ...typography.bodySm, textAlign: "center", color: colors.textSecondary, marginTop: 40 },
});
