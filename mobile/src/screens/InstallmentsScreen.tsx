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
