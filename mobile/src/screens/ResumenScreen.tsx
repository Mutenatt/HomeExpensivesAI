import { useCallback, useEffect, useMemo, useState } from "react";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { EssentialDonutChart } from "../components/EssentialDonutChart";
import { MonthSelector } from "../components/MonthSelector";
import { MonthTotalCounter } from "../components/MonthTotalCounter";
import { getMonthRange } from "../lib/dateRange";
import { getUnsyncedTransactions } from "../lib/localDb";
import { aggregateEssentialSplit, fetchTransactionsForMonth } from "../lib/resumen";
import { colors, radius, shadows, spacing, typography } from "../theme";
import type { TransactionWithProduct } from "../types";

interface Props {
  userId: string;
}

export function ResumenScreen({ userId }: Props) {
  const [monthOffset, setMonthOffset] = useState(0);
  const [rows, setRows] = useState<TransactionWithProduct[]>([]);
  const [pendingCount, setPendingCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  const monthLabel = useMemo(() => getMonthRange(monthOffset).label, [monthOffset]);
  const isCurrentMonth = monthOffset === 0;

  const load = useCallback(async () => {
    setLoading(true);
    setError(false);
    try {
      const data = await fetchTransactionsForMonth(userId, monthOffset);
      setRows(data);
    } catch {
      setError(true);
      setLoading(false);
      return;
    }

    // El conteo de "sin sincronizar" es secundario (cola local de SQLite):
    // si falla, no debe tirar abajo el resumen que ya cargó bien.
    if (isCurrentMonth) {
      try {
        const pending = await getUnsyncedTransactions();
        setPendingCount(pending.length);
      } catch {
        setPendingCount(0);
      }
    } else {
      setPendingCount(0);
    }
    setLoading(false);
  }, [userId, monthOffset, isCurrentMonth]);

  useEffect(() => {
    load();
  }, [load]);

  const split = useMemo(() => aggregateEssentialSplit(rows), [rows]);

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Resumen</Text>
      </View>

      <ScrollView contentContainerStyle={styles.content}>
        <MonthSelector
          label={monthLabel}
          onPrev={() => setMonthOffset((m) => m - 1)}
          onNext={() => setMonthOffset((m) => Math.min(m + 1, 0))}
          disableNext={isCurrentMonth}
        />

        {loading ? (
          <View style={styles.stateBox}>
            <Text style={styles.stateText}>Cargando...</Text>
          </View>
        ) : error ? (
          <View style={styles.stateBox}>
            <Text style={styles.stateText}>No pudimos cargar el resumen.</Text>
            <Pressable style={styles.retryButton} onPress={load}>
              <Text style={styles.retryText}>Reintentar</Text>
            </Pressable>
          </View>
        ) : rows.length === 0 ? (
          <View style={styles.stateBox}>
            <Text style={styles.stateText}>Todavía no registraste gastos este mes.</Text>
          </View>
        ) : (
          <>
            <MonthTotalCounter total={split.totalExpense} isCurrentMonth={isCurrentMonth} />
            {isCurrentMonth && pendingCount > 0 && (
              <Text style={styles.pendingBadge}>{pendingCount} sin sincronizar</Text>
            )}
            <View style={styles.card}>
              <EssentialDonutChart
                totalEssential={split.totalEssential}
                totalNonEssential={split.totalNonEssential}
              />
            </View>
          </>
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bgBase },
  header: { paddingTop: 60, paddingHorizontal: spacing.lg, paddingBottom: spacing.sm },
  headerTitle: { ...typography.headingMd, fontSize: 24, color: colors.textPrimary },
  content: {
    paddingHorizontal: spacing.lg,
    paddingBottom: 160,
    gap: spacing.lg,
    alignItems: "center",
  },
  pendingBadge: { ...typography.bodySm, color: colors.warning },
  card: {
    width: "100%",
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    padding: spacing.lg,
    alignItems: "center",
    ...shadows.soft,
  },
  stateBox: { alignItems: "center", gap: spacing.sm, marginTop: spacing.xl },
  stateText: { ...typography.bodySm, color: colors.textSecondary, textAlign: "center" },
  retryButton: {
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.lg,
    borderRadius: radius.pill,
    backgroundColor: colors.negative,
  },
  retryText: { ...typography.bodySm, color: "#fff", fontWeight: "700" },
});
