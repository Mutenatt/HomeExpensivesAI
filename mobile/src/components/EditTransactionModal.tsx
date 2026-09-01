import { useEffect, useState } from "react";
import { Modal, Pressable, StyleSheet, Text, TextInput, View } from "react-native";
import { DateField } from "./DateField";
import { supabase } from "../lib/supabase";
import { PAYMENT_METHODS } from "../lib/paymentMethods";
import { colors, radius, spacing, typography } from "../theme";
import type { PaymentMethod, Transaction, TransactionType } from "../types";

interface Props {
  transaction: (Transaction & { product: { name: string } | null }) | null;
  onClose: () => void;
  onSaved: () => void;
}

export function EditTransactionModal({ transaction, onClose, onSaved }: Props) {
  const [amount, setAmount] = useState("");
  const [type, setType] = useState<TransactionType>("expense");
  const [storeName, setStoreName] = useState("");
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod | null>(null);
  const [date, setDate] = useState<Date | null>(null);
  const [saving, setSaving] = useState(false);
  const [confirmingDelete, setConfirmingDelete] = useState(false);

  useEffect(() => {
    if (!transaction) return;
    setAmount(String(transaction.amount));
    setType(transaction.type);
    setStoreName(transaction.store_name ?? "");
    setPaymentMethod(transaction.payment_method);
    setDate(new Date(transaction.date));
    setConfirmingDelete(false);
  }, [transaction]);

  if (!transaction) return null;

  const parsedAmount = Number(amount.replace(",", "."));
  const canSave = parsedAmount > 0 && paymentMethod !== null && !saving;

  async function handleSave() {
    if (!canSave || !transaction || paymentMethod === null) return;
    setSaving(true);
    try {
      const { error } = await supabase
        .from("transactions")
        .update({
          amount: parsedAmount,
          type,
          store_name: storeName.trim() || null,
          payment_method: paymentMethod,
          date: (date ?? new Date()).toISOString(),
        })
        .eq("id", transaction.id)
        .eq("user_id", transaction.user_id);
      if (!error) {
        onSaved();
      }
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete() {
    if (!transaction) return;
    setSaving(true);
    try {
      await supabase.from("installments").delete().eq("transaction_id", transaction.id);
      const { error } = await supabase
        .from("transactions")
        .update({ deleted_at: new Date().toISOString() })
        .eq("id", transaction.id)
        .eq("user_id", transaction.user_id);
      if (!error) {
        onSaved();
      }
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal visible={!!transaction} animationType="slide" transparent onRequestClose={onClose}>
      <View style={styles.backdrop}>
        <View style={styles.sheet}>
          <Text style={styles.title}>Editar {transaction.product?.name ?? "gasto"}</Text>

          <View style={styles.typeRow}>
            {(["expense", "income"] as TransactionType[]).map((t) => (
              <Pressable
                key={t}
                style={[styles.typePill, type === t && styles.typePillActive]}
                onPress={() => setType(t)}
              >
                <Text style={[styles.typePillText, type === t && styles.typePillTextActive]}>
                  {t === "expense" ? "Gasto" : "Ingreso"}
                </Text>
              </Pressable>
            ))}
          </View>

          <TextInput
            style={styles.amountInput}
            placeholder="$ 0"
            keyboardType="decimal-pad"
            value={amount}
            onChangeText={setAmount}
          />

          <DateField value={date} onChange={setDate} />

          <TextInput
            style={styles.input}
            placeholder="Tienda (opcional)"
            value={storeName}
            onChangeText={setStoreName}
          />

          <View style={styles.paymentRow}>
            {PAYMENT_METHODS.map((pm) => (
              <Pressable
                key={pm.value}
                style={[styles.paymentPill, paymentMethod === pm.value && styles.paymentPillActive]}
                onPress={() => setPaymentMethod(pm.value)}
              >
                <Text
                  style={[
                    styles.paymentPillText,
                    paymentMethod === pm.value && styles.paymentPillTextActive,
                  ]}
                >
                  {pm.label}
                </Text>
              </Pressable>
            ))}
          </View>

          {confirmingDelete ? (
            <View style={styles.confirmRow}>
              <Text style={styles.confirmText}>¿Eliminar este gasto?</Text>
              <Pressable style={styles.confirmNo} onPress={() => setConfirmingDelete(false)}>
                <Text style={styles.confirmNoText}>No</Text>
              </Pressable>
              <Pressable style={styles.confirmYes} onPress={handleDelete} disabled={saving}>
                <Text style={styles.confirmYesText}>Sí, eliminar</Text>
              </Pressable>
            </View>
          ) : (
            <View style={styles.actionsRow}>
              <Pressable style={styles.deleteButton} onPress={() => setConfirmingDelete(true)}>
                <Text style={styles.deleteButtonText}>Eliminar</Text>
              </Pressable>
              <Pressable style={styles.cancelButton} onPress={onClose}>
                <Text style={styles.cancelButtonText}>Cancelar</Text>
              </Pressable>
              <Pressable
                style={[styles.saveButton, !canSave && styles.saveButtonDisabled]}
                onPress={handleSave}
                disabled={!canSave}
              >
                <Text style={styles.saveButtonText}>Guardar</Text>
              </Pressable>
            </View>
          )}
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: "rgba(76,58,45,0.35)", justifyContent: "flex-end" },
  sheet: {
    backgroundColor: colors.surface,
    borderTopLeftRadius: radius.lg,
    borderTopRightRadius: radius.lg,
    padding: spacing.lg,
    gap: spacing.md,
  },
  title: { ...typography.headingMd, fontSize: 17, color: colors.textPrimary },
  typeRow: { flexDirection: "row", gap: spacing.sm },
  typePill: { paddingVertical: spacing.xs, paddingHorizontal: spacing.md, borderRadius: radius.pill, backgroundColor: colors.borderSubtle },
  typePillActive: { backgroundColor: colors.textPrimary },
  typePillText: { ...typography.bodySm, color: colors.textPrimary, fontWeight: "600" },
  typePillTextActive: { color: "#fff" },
  amountInput: { ...typography.displayXl, fontSize: 28, paddingVertical: spacing.xs, color: colors.textPrimary },
  input: {
    borderWidth: 1,
    borderColor: colors.borderSubtle,
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    color: colors.textPrimary,
  },
  paymentRow: { flexDirection: "row", flexWrap: "wrap", gap: spacing.sm },
  paymentPill: { paddingVertical: spacing.xs, paddingHorizontal: spacing.sm, borderRadius: radius.pill, backgroundColor: colors.borderSubtle },
  paymentPillActive: { backgroundColor: colors.negative },
  paymentPillText: { color: colors.textPrimary, fontSize: 13 },
  paymentPillTextActive: { color: "#fff" },
  actionsRow: { flexDirection: "row", gap: spacing.sm, marginTop: spacing.xs },
  deleteButton: { paddingVertical: spacing.md, paddingHorizontal: spacing.md, borderRadius: radius.md, backgroundColor: colors.negativeSurface },
  deleteButtonText: { color: colors.negative, fontWeight: "700" },
  cancelButton: { flex: 1, padding: spacing.md, alignItems: "center", borderRadius: radius.md, backgroundColor: colors.borderSubtle },
  cancelButtonText: { color: colors.textPrimary, fontWeight: "600" },
  saveButton: { flex: 1, padding: spacing.md, alignItems: "center", borderRadius: radius.md, backgroundColor: colors.positive },
  saveButtonDisabled: { backgroundColor: colors.textSecondary },
  saveButtonText: { color: "#fff", fontWeight: "700" },
  confirmRow: { flexDirection: "row", alignItems: "center", gap: spacing.sm, marginTop: spacing.xs },
  confirmText: { ...typography.bodySm, color: colors.textPrimary, flex: 1 },
  confirmNo: { paddingVertical: spacing.sm, paddingHorizontal: spacing.md, borderRadius: radius.md, backgroundColor: colors.borderSubtle },
  confirmNoText: { color: colors.textPrimary, fontWeight: "600" },
  confirmYes: { paddingVertical: spacing.sm, paddingHorizontal: spacing.md, borderRadius: radius.md, backgroundColor: colors.negative },
  confirmYesText: { color: "#fff", fontWeight: "700" },
});
