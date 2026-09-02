import { useCallback, useEffect, useMemo, useState } from "react";
import { Pressable, SectionList, StyleSheet, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import Animated, { FadeInDown } from "react-native-reanimated";
import { QuickAddExpenseSheet } from "../components/QuickAddExpenseSheet";
import { EditTransactionModal } from "../components/EditTransactionModal";
import { Fab } from "../components/Fab";
import { MonthSelector } from "../components/MonthSelector";
import { getUnsyncedTransactions } from "../lib/localDb";
import { formatCurrency } from "../lib/format";
import { paymentMethodLabel } from "../lib/paymentMethods";
import { registerForPushNotifications } from "../lib/notifications";
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
  const [pendingCount, setPendingCount] = useState(0);

  const [monthOffset, setMonthOffset] = useState(0);
  const [sections, setSections] = useState<TransactionDaySection[]>([]);
  const [corrienteLoading, setCorrienteLoading] = useState(true);
  const [corrienteError, setCorrienteError] = useState(false);

  const [sheetVisible, setSheetVisible] = useState(false);
  const [editingTransaction, setEditingTransaction] = useState<TransactionWithProduct | null>(null);

  const monthLabel = useMemo(() => getMonthRange(monthOffset).label, [monthOffset]);
  const isCurrentMonth = monthOffset === 0;

  const refreshPendingCount = useCallback(async () => {
    try {
      const pending = await getUnsyncedTransactions();
      setPendingCount(pending.length);
    } catch {
      setPendingCount(0);
    }
  }, []);

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
      await refreshPendingCount();
    })();
  }, [userId, refreshPendingCount]);

  useEffect(() => {
    loadCorriente();
  }, [loadCorriente]);

  async function handleSaved() {
    setSheetVisible(false);
    await pushPendingTransactions(userId).catch(() => {});
    await refreshPendingCount();
    await loadCorriente();
  }

  async function handleEditSaved() {
    setEditingTransaction(null);
    await refreshPendingCount();
    await loadCorriente();
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Tus gastos</Text>
        {pendingCount > 0 && (
          <Text style={styles.pendingBadge}>{pendingCount} sin sincronizar</Text>
        )}
      </View>

      <View style={styles.monthSelectorRow}>
        <MonthSelector
          label={monthLabel}
          onPrev={() => setMonthOffset((m) => m - 1)}
          onNext={() => setMonthOffset((m) => Math.min(m + 1, 0))}
          disableNext={isCurrentMonth}
        />
      </View>

      {corrienteLoading ? (
        <View style={styles.stateBox}>
          <Text style={styles.emptyText}>Cargando...</Text>
        </View>
      ) : corrienteError ? (
        <View style={styles.stateBox}>
          <Text style={styles.emptyText}>No pudimos cargar los movimientos.</Text>
          <Pressable style={styles.retryButton} onPress={loadCorriente}>
            <Text style={styles.retryText}>Reintentar</Text>
          </Pressable>
        </View>
      ) : (
        <Animated.View key={monthOffset} entering={FadeInDown.duration(300)} style={styles.listWrapper}>
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
                    {isIncome ? "+" : "-"}
                    {formatCurrency(item.amount, item.currency)}
                  </Text>
                </Pressable>
              );
            }}
            ListEmptyComponent={
              <Text style={styles.emptyText}>Todavía no registraste gastos este mes.</Text>
            }
          />
        </Animated.View>
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
  header: { paddingTop: 60, paddingHorizontal: spacing.lg, paddingBottom: spacing.sm, gap: spacing.xs },
  headerTitle: { ...typography.headingMd, fontSize: 24, color: colors.textPrimary },
  pendingBadge: { ...typography.bodySm, color: colors.warning },
  monthSelectorRow: { alignItems: "center", paddingBottom: spacing.sm },
  listWrapper: { flex: 1 },
  listContent: { paddingHorizontal: spacing.lg, paddingBottom: 160, gap: spacing.sm },
  sectionHeader: {
    ...typography.headingMd,
    fontSize: 14,
    color: colors.textPrimary,
    paddingTop: spacing.md,
    paddingBottom: spacing.xs,
  },
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
