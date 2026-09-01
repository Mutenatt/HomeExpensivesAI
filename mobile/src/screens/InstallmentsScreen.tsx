import { useCallback, useEffect, useState } from "react";
import { FlatList, Pressable, StyleSheet, Text, View } from "react-native";
import { QuickAddExpenseSheet } from "../components/QuickAddExpenseSheet";
import { Fab } from "../components/Fab";
import { supabase } from "../lib/supabase";
import { colors, radius, shadows, spacing, typography } from "../theme";
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
  const [sheetVisible, setSheetVisible] = useState(false);

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

  async function handleSaved() {
    setSheetVisible(false);
    await refresh();
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
  headerTotal: { ...typography.bodySm, color: colors.textSecondary, marginTop: 4 },
  listContent: { paddingHorizontal: spacing.lg, paddingBottom: 160, gap: spacing.sm },
  row: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.md,
    borderRadius: radius.md,
    backgroundColor: colors.surface,
    ...shadows.soft,
  },
  rowInfo: { flex: 1, paddingRight: spacing.md },
  rowTitle: { ...typography.bodyMd, color: colors.textPrimary, fontWeight: "700" },
  rowSubtitle: { ...typography.bodySm, color: colors.textSecondary, marginTop: 2 },
  rowActions: { alignItems: "flex-end", gap: spacing.xs },
  rowAmount: { ...typography.bodyMd, color: colors.textPrimary, fontWeight: "700" },
  payButton: {
    backgroundColor: colors.positive,
    paddingVertical: spacing.xs,
    paddingHorizontal: spacing.sm,
    borderRadius: radius.sm,
  },
  payButtonText: { color: "#fff", fontSize: 12, fontWeight: "700" },
  emptyText: { ...typography.bodySm, textAlign: "center", color: colors.textSecondary, marginTop: 40 },
});
