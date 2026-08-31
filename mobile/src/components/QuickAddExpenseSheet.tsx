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
import type { PaymentMethod, TransactionType } from "../types";

interface Props {
  visible: boolean;
  onClose: () => void;
  onSaved: () => void;
}

const emptyState = {
  amount: "",
  type: "expense" as TransactionType,
  productQuery: "",
  suggestions: [] as ProductCacheRow[],
  selectedProduct: null as ProductCacheRow | null,
  storeName: "",
  paymentMethod: null as PaymentMethod | null,
  isEssential: false,
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
  const canSave = parsedAmount > 0 && state.paymentMethod !== null && !saving;

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
                onPress={() => setState((s) => ({ ...s, paymentMethod: pm.value }))}
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
  backdrop: { flex: 1, backgroundColor: "rgba(0,0,0,0.4)", justifyContent: "flex-end" },
  sheet: { backgroundColor: "#fff", borderTopLeftRadius: 20, borderTopRightRadius: 20, padding: 20, gap: 12 },
  typeRow: { flexDirection: "row", gap: 8 },
  typePill: { paddingVertical: 6, paddingHorizontal: 14, borderRadius: 16, backgroundColor: "#eee" },
  typePillActive: { backgroundColor: "#1f2937" },
  typePillText: { color: "#1f2937", fontWeight: "600" },
  typePillTextActive: { color: "#fff" },
  amountInput: { fontSize: 36, fontWeight: "700", paddingVertical: 8 },
  input: { borderWidth: 1, borderColor: "#ddd", borderRadius: 10, paddingHorizontal: 12, paddingVertical: 10 },
  suggestionsBox: { maxHeight: 160, borderWidth: 1, borderColor: "#eee", borderRadius: 10 },
  suggestionRow: { paddingVertical: 10, paddingHorizontal: 12, borderBottomWidth: 1, borderBottomColor: "#f2f2f2" },
  suggestionText: { fontSize: 15, fontWeight: "500" },
  suggestionSubtext: { fontSize: 12, color: "#888" },
  essentialRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  essentialLabel: { fontSize: 14, color: "#333" },
  paymentRow: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  paymentPill: { paddingVertical: 6, paddingHorizontal: 12, borderRadius: 16, backgroundColor: "#eee" },
  paymentPillActive: { backgroundColor: "#2563eb" },
  paymentPillText: { color: "#1f2937", fontSize: 13 },
  paymentPillTextActive: { color: "#fff" },
  actionsRow: { flexDirection: "row", gap: 12, marginTop: 8 },
  cancelButton: { flex: 1, padding: 14, alignItems: "center", borderRadius: 10, backgroundColor: "#f3f4f6" },
  cancelButtonText: { color: "#1f2937", fontWeight: "600" },
  saveButton: { flex: 2, padding: 14, alignItems: "center", borderRadius: 10, backgroundColor: "#16a34a" },
  saveButtonDisabled: { backgroundColor: "#9ca3af" },
  saveButtonText: { color: "#fff", fontWeight: "700" },
});
