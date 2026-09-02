import { useCallback, useEffect, useMemo, useState } from "react";
import { FlatList, Pressable, SectionList, StyleSheet, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { QuickAddExpenseSheet } from "../components/QuickAddExpenseSheet";
import { EditTransactionModal } from "../components/EditTransactionModal";
import { ExpenseListToggle, type ExpenseListMode } from "../components/ExpenseListToggle";
import { Fab } from "../components/Fab";
import { MonthSelector } from "../components/MonthSelector";
import { getUnsyncedTransactions } from "../lib/localDb";
import { paymentMethodLabel } from "../lib/paymentMethods";
import { registerForPushNotifications } from "../lib/notifications";
import { supabase } from "../lib/supabase";
import { pullProductCatalog, pushPendingTransactions } from "../lib/sync";
import { getMonthRange, formatArtTime } from "../lib/dateRange";
import { fetchTransactionsForMonth } from "../lib/resumen";
import { groupTransactionsIntoSections, type TransactionDaySection } from "../lib/transactionGrouping";
import { colors, radius, shadows, spacing, typography } from "../theme";
import type { TransactionWithProduct } from "../types";

interface Props {
  userId: string;
}

function rowIcon(item: TransactionWithProduct): {
  name: keyof typeof Ionicons.glyphMap;
  bg: string;
  tint: string;
} {
  if (item.type === "income") {
    return { name: "arrow-down-circle-outline", bg: colors.positiveSurface, tint: colors.positive };
  }
  if (item.product?.is_essential) {
    return { name: "basket-outline", bg: colors.essentialSurface, tint: colors.essential };
  }
  return { name: "bag-outline", bg: colors.nonEssentialSurface, tint: colors.nonEssential };
}

export function DashboardScreen({ userId }: Props) {
  const [mode, setMode] = useState<ExpenseListMode>("corriente");

  const [transactions, setTransactions] = useState<TransactionWithProduct[]>([]);
  const [pendingCount, setPendingCount] = useState(0);

  const [monthOffset, setMonthOffset] = useState(0);
  const [sections, setSections] = useState<TransactionDaySection[]>([]);
  const [corrienteLoading, setCorrienteLoading] = useState(true);
  const [corrienteError, setCorrienteError] = useState(false);

  const [sheetVisible, setSheetVisible] = useState(false);
  const [editingTransaction, setEditingTransaction] = useState<TransactionWithProduct | null>(null);

  const monthLabel = useMemo(() => getMonthRange(monthOffset).label, [monthOffset]);
  const isCurrentMonth = monthOffset === 0;

  const refresh = useCallback(async () => {
    const { data } = await supabase
      .from("transactions")
      .select("*, product:products(name, is_essential)")
      .eq("user_id", userId)
      .is("deleted_at", null)
      .order("date", { ascending: false })
      .limit(30)
      .returns<TransactionWithProduct[]>();
    setTransactions(data ?? []);

    const pending = await getUnsyncedTransactions();
    setPendingCount(pending.length);
  }, [userId]);

  const loadCorriente = useCallback(async () => {
    setCorrienteLoading(true);
    setCorrienteError(false);
    try {
      const rows = await fetchTransactionsForMonth(userId, monthOffset);
      setSections(groupTransactionsIntoSections(rows));
    } catch {
      setCorrienteError(true);
    } finally {
      setCorrienteLoading(false);
    }
  }, [userId, monthOffset]);

  useEffect(() => {
    (async () => {
      await pullProductCatalog(userId).catch(() => {});
      await pushPendingTransactions(userId).catch(() => {});
      await registerForPushNotifications(userId).catch(() => {});
      await refresh();
    })();
  }, [userId, refresh]);

  useEffect(() => {
    loadCorriente();
  }, [loadCorriente]);

  async function handleSaved() {
    setSheetVisible(false);
    await pushPendingTransactions(userId).catch(() => {});
    await refresh();
    await loadCorriente();
  }

  async function handleEditSaved() {
    setEditingTransaction(null);
    await refresh();
    await loadCorriente();
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Tus gastos</Text>
        {pendingCount > 0 && (
          <Text style={styles.pendingBadge}>{pendingCount} sin sincronizar</Text>
        )}
        <View style={styles.toggleRow}>
          <ExpenseListToggle value={mode} onChange={setMode} />
        </View>
      </View>

      {mode === "corriente" ? (
        <>
          <View style={styles.monthSelectorRow}>
            <MonthSelector
              label={monthLabel}
              onPrev={() => setMonthOffset((m) => m - 1)}
              onNext={() => setMonthOffset((m) => Math.min(m + 1, 0))}
              disableNext={isCurrentMonth}
            />
          </View>

          {corrienteError ? (
            <View style={styles.stateBox}>
              <Text style={styles.emptyText}>No pudimos cargar los movimientos.</Text>
              <Pressable style={styles.retryButton} onPress={loadCorriente}>
                <Text style={styles.retryText}>Reintentar</Text>
              </Pressable>
            </View>
          ) : (
            <SectionList
              sections={sections}
              keyExtractor={(item) => item.id}
              contentContainerStyle={styles.listContent}
              renderSectionHeader={({ section }) => (
                <Text style={styles.sectionHeader}>{section.title}</Text>
              )}
              renderItem={({ item }) => {
                const isIncome = item.type === "income";
                const icon = rowIcon(item);
                return (
                  <Pressable style={styles.corrienteRow} onPress={() => setEditingTransaction(item)}>
                    <Text style={styles.rowTime}>{formatArtTime(item.date)}</Text>
                    <View style={[styles.iconCircle, { backgroundColor: icon.bg }]}>
                      <Ionicons name={icon.name} size={18} color={icon.tint} />
                    </View>
                    <View style={styles.rowBody}>
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
                  </Pressable>
                );
              }}
              ListEmptyComponent={
                !corrienteLoading ? (
                  <Text style={styles.emptyText}>Todavía no registraste gastos este mes.</Text>
                ) : null
              }
            />
          )}
        </>
      ) : (
        <FlatList
          data={transactions}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.listContent}
          renderItem={({ item }) => {
            const isIncome = item.type === "income";
            return (
              <Pressable
                style={[styles.row, isIncome ? styles.rowIncome : styles.rowExpense]}
                onPress={() => setEditingTransaction(item)}
              >
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
              </Pressable>
            );
          }}
          ListEmptyComponent={<Text style={styles.emptyText}>Todavía no registraste ningún gasto.</Text>}
        />
      )}

      <Fab onPress={() => setSheetVisible(true)} />

      <QuickAddExpenseSheet
        visible={sheetVisible}
        onClose={() => setSheetVisible(false)}
        onSaved={handleSaved}
      />

      <EditTransactionModal
        transaction={editingTransaction}
        onClose={() => setEditingTransaction(null)}
        onSaved={handleEditSaved}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bgBase },
  header: { paddingTop: 60, paddingHorizontal: spacing.lg, paddingBottom: spacing.sm, gap: spacing.sm },
  headerTitle: { ...typography.headingMd, fontSize: 24, color: colors.textPrimary },
  pendingBadge: { ...typography.bodySm, color: colors.warning },
  toggleRow: { marginTop: spacing.xs },
  monthSelectorRow: { alignItems: "center", paddingBottom: spacing.sm },
  listContent: { paddingHorizontal: spacing.lg, paddingBottom: 160, gap: spacing.sm },
  sectionHeader: {
    ...typography.headingMd,
    fontSize: 14,
    color: colors.textPrimary,
    paddingTop: spacing.md,
    paddingBottom: spacing.xs,
  },
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
  corrienteRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    borderRadius: radius.md,
    backgroundColor: colors.surface,
    ...shadows.soft,
    marginBottom: spacing.sm,
  },
  rowTime: { ...typography.bodySm, color: colors.textSecondary, width: 40 },
  iconCircle: { width: 36, height: 36, borderRadius: 18, alignItems: "center", justifyContent: "center" },
  rowBody: { flex: 1 },
  rowTitle: { ...typography.bodyMd, color: colors.textPrimary, fontWeight: "700" },
  rowSubtitle: { ...typography.bodySm, color: colors.textSecondary, marginTop: 2 },
  rowAmount: { ...typography.bodyMd, fontWeight: "700" },
  income: { color: colors.positive },
  expense: { color: colors.negative },
  emptyText: { ...typography.bodySm, textAlign: "center", color: colors.textSecondary, marginTop: 40 },
  stateBox: { alignItems: "center", gap: spacing.sm, marginTop: 40, paddingHorizontal: spacing.lg },
  retryButton: {
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.lg,
    borderRadius: radius.pill,
    backgroundColor: colors.negative,
  },
  retryText: { ...typography.bodySm, color: "#fff", fontWeight: "700" },
});
