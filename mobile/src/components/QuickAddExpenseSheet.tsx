import { useState } from "react";
import {
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  View,
} from "react-native";
import { enqueuePendingTransaction } from "../lib/localDb";
import { PAYMENT_METHODS } from "../lib/paymentMethods";
import { searchCachedProducts, type ProductCacheRow } from "../lib/localDb";
import { colors, radius, spacing, typography } from "../theme";
import type { PaymentMethod, TransactionType } from "../types";

interface Props {
  visible: boolean;
  onClose: () => void;
  onSaved: () => void;
}

const INSTALLMENT_OPTIONS = [3, 6, 9, 12, 18, 24];

const emptyState = {
  amount: "",
  type: "expense" as TransactionType,
  productQuery: "",
  suggestions: [] as ProductCacheRow[],
  selectedProduct: null as ProductCacheRow | null,
  storeName: "",
  paymentMethod: null as PaymentMethod | null,
  isEssential: false,
  installments: null as number | null,
  showCustomInstallmentsInput: false,
};

export function QuickAddExpenseSheet({ visible, onClose, onSaved }: Props) {
  const [state, setState] = useState(emptyState);
  const [saving, setSaving] = useState(false);

  function reset() {
    setState(emptyState);
  }

  async function handleProductQueryChange(text: string) {
    setState((s) => ({ ...s, productQuery: text, selectedProduct: null }));
    const suggestions = await searchCachedProducts(text);
    setState((s) => ({ ...s, suggestions }));
  }

  function handleSelectSuggestion(product: ProductCacheRow) {
    // Clic 2: la sugerencia precarga tienda y método de pago habituales.
    setState((s) => ({
      ...s,
      selectedProduct: product,
      productQuery: product.name,
      suggestions: [],
      storeName: product.usual_store ?? s.storeName,
      paymentMethod: product.usual_payment_method ?? s.paymentMethod,
      isEssential: !!product.is_essential,
    }));
  }

  const parsedAmount = Number(state.amount.replace(",", "."));
  const needsInstallments = state.type === "expense" && state.paymentMethod === "credit_card";
  const canSave =
    parsedAmount > 0 &&
    state.paymentMethod !== null &&
    (!needsInstallments || (state.installments !== null && state.installments >= 1)) &&
    !saving;

  async function handleSave() {
    if (!canSave || state.paymentMethod === null) return;
    setSaving(true);
    try {
      const localId = `${Date.now()}-${Math.random().toString(36).slice(2)}`;
      await enqueuePendingTransaction({
        localId,
        amount: parsedAmount,
        type: state.type,
        paymentMethod: state.paymentMethod,
        storeName: state.storeName.trim() || null,
        productId: state.selectedProduct?.id ?? null,
        productNameNew:
          !state.selectedProduct && state.productQuery.trim() ? state.productQuery.trim() : null,
        isEssential: state.isEssential,
        date: new Date().toISOString(),
        totalInstallments: needsInstallments ? state.installments : null,
      });
      reset();
      onSaved();
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <View style={styles.backdrop}>
        <View style={styles.sheet}>
          <View style={styles.typeRow}>
            {(["expense", "income"] as TransactionType[]).map((t) => (
              <Pressable
                key={t}
                style={[styles.typePill, state.type === t && styles.typePillActive]}
                onPress={() => setState((s) => ({ ...s, type: t }))}
              >
                <Text style={[styles.typePillText, state.type === t && styles.typePillTextActive]}>
                  {t === "expense" ? "Gasto" : "Ingreso"}
                </Text>
              </Pressable>
            ))}
          </View>

          <TextInput
            style={styles.amountInput}
            placeholder="$ 0"
            keyboardType="decimal-pad"
            autoFocus
            value={state.amount}
            onChangeText={(text) => setState((s) => ({ ...s, amount: text }))}
          />

          {state.type === "expense" && (
            <>
              <TextInput
                style={styles.input}
                placeholder="¿Qué compraste? (ej. Harina 0000)"
                value={state.productQuery}
                onChangeText={handleProductQueryChange}
              />
              {state.suggestions.length > 0 && (
                <View style={styles.suggestionsBox}>
                  <ScrollView keyboardShouldPersistTaps="handled">
                    {state.suggestions.map((item) => (
                      <Pressable
                        key={item.id}
                        style={styles.suggestionRow}
                        onPress={() => handleSelectSuggestion(item)}
                      >
                        <Text style={styles.suggestionText}>{item.name}</Text>
                        {item.usual_store ? (
                          <Text style={styles.suggestionSubtext}>{item.usual_store}</Text>
                        ) : null}
                      </Pressable>
                    ))}
                  </ScrollView>
                </View>
              )}

              <TextInput
                style={styles.input}
                placeholder="Tienda (opcional)"
                value={state.storeName}
                onChangeText={(text) => setState((s) => ({ ...s, storeName: text }))}
              />

              <View style={styles.essentialRow}>
                <Text style={styles.essentialLabel}>Esencial (canasta básica)</Text>
                <Switch
                  value={state.isEssential}
                  onValueChange={(value) => setState((s) => ({ ...s, isEssential: value }))}
                />
              </View>
            </>
          )}

          <View style={styles.paymentRow}>
            {PAYMENT_METHODS.map((pm) => (
              <Pressable
                key={pm.value}
                style={[styles.paymentPill, state.paymentMethod === pm.value && styles.paymentPillActive]}
                onPress={() =>
                  setState((s) => ({
                    ...s,
                    paymentMethod: pm.value,
                    installments: pm.value === "credit_card" ? s.installments : null,
                    showCustomInstallmentsInput: pm.value === "credit_card" ? s.showCustomInstallmentsInput : false,
                  }))
                }
              >
                <Text
                  style={[
                    styles.paymentPillText,
                    state.paymentMethod === pm.value && styles.paymentPillTextActive,
                  ]}
                >
                  {pm.label}
                </Text>
              </Pressable>
            ))}
          </View>

          {state.type === "expense" && state.paymentMethod === "credit_card" && (
            <View style={styles.installmentsSection}>
              <Text style={styles.essentialLabel}>¿En cuántas cuotas?</Text>
              <View style={styles.paymentRow}>
                {INSTALLMENT_OPTIONS.map((n) => (
                  <Pressable
                    key={n}
                    style={[
                      styles.paymentPill,
                      state.installments === n && !state.showCustomInstallmentsInput && styles.paymentPillActive,
                    ]}
                    onPress={() => setState((s) => ({ ...s, installments: n, showCustomInstallmentsInput: false }))}
                  >
                    <Text
                      style={[
                        styles.paymentPillText,
                        state.installments === n && !state.showCustomInstallmentsInput && styles.paymentPillTextActive,
                      ]}
                    >
                      {n}
                    </Text>
                  </Pressable>
                ))}
                <Pressable
                  style={[styles.paymentPill, state.showCustomInstallmentsInput && styles.paymentPillActive]}
                  onPress={() => setState((s) => ({ ...s, showCustomInstallmentsInput: true, installments: null }))}
                >
                  <Text style={[styles.paymentPillText, state.showCustomInstallmentsInput && styles.paymentPillTextActive]}>
                    Otra
                  </Text>
                </Pressable>
              </View>
              {state.showCustomInstallmentsInput && (
                <TextInput
                  style={styles.input}
                  placeholder="Cantidad de cuotas"
                  keyboardType="number-pad"
                  value={state.installments !== null ? String(state.installments) : ""}
                  onChangeText={(text) => {
                    const parsed = parseInt(text, 10);
                    setState((s) => ({
                      ...s,
                      installments: Number.isFinite(parsed) && parsed > 0 ? parsed : null,
                    }));
                  }}
                />
              )}
            </View>
          )}

          <View style={styles.actionsRow}>
            <Pressable
              style={styles.cancelButton}
              onPress={() => {
                reset();
                onClose();
              }}
            >
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
  typeRow: { flexDirection: "row", gap: spacing.sm },
  typePill: { paddingVertical: spacing.xs, paddingHorizontal: spacing.md, borderRadius: radius.pill, backgroundColor: colors.borderSubtle },
  typePillActive: { backgroundColor: colors.textPrimary },
  typePillText: { ...typography.bodySm, color: colors.textPrimary, fontWeight: "600" },
  typePillTextActive: { color: "#fff" },
  amountInput: { ...typography.displayXl, paddingVertical: spacing.xs, color: colors.textPrimary },
  input: {
    borderWidth: 1,
    borderColor: colors.borderSubtle,
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    color: colors.textPrimary,
  },
  suggestionsBox: { maxHeight: 160, borderWidth: 1, borderColor: colors.borderSubtle, borderRadius: radius.md },
  suggestionRow: { paddingVertical: spacing.sm, paddingHorizontal: spacing.md, borderBottomWidth: 1, borderBottomColor: colors.borderSubtle },
  suggestionText: { ...typography.bodyMd, color: colors.textPrimary },
  suggestionSubtext: { ...typography.bodySm, fontSize: 12, color: colors.textSecondary },
  essentialRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  essentialLabel: { ...typography.bodySm, color: colors.textPrimary },
  paymentRow: { flexDirection: "row", flexWrap: "wrap", gap: spacing.sm },
  installmentsSection: { gap: spacing.sm },
  paymentPill: { paddingVertical: spacing.xs, paddingHorizontal: spacing.sm, borderRadius: radius.pill, backgroundColor: colors.borderSubtle },
  paymentPillActive: { backgroundColor: colors.negative },
  paymentPillText: { color: colors.textPrimary, fontSize: 13 },
  paymentPillTextActive: { color: "#fff" },
  actionsRow: { flexDirection: "row", gap: spacing.md, marginTop: spacing.xs },
  cancelButton: { flex: 1, padding: spacing.md, alignItems: "center", borderRadius: radius.md, backgroundColor: colors.borderSubtle },
  cancelButtonText: { color: colors.textPrimary, fontWeight: "600" },
  saveButton: { flex: 2, padding: spacing.md, alignItems: "center", borderRadius: radius.md, backgroundColor: colors.positive },
  saveButtonDisabled: { backgroundColor: colors.textSecondary },
  saveButtonText: { color: "#fff", fontWeight: "700" },
});
