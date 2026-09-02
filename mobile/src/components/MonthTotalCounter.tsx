import { useEffect, useRef, useState } from "react";
import { StyleSheet, Text, View } from "react-native";
import { formatCurrency } from "../lib/format";
import { colors, spacing, typography } from "../theme";
import type { Currency } from "../types";

interface Props {
  total: number;
  isCurrentMonth: boolean;
  currency?: Currency;
}

const DURATION_MS = 700;

const LABELS: Record<Currency, { current: string; past: string }> = {
  ARS: { current: "Llevás gastado este mes", past: "Total gastado en el mes" },
  USD: { current: "Gastado en USD este mes", past: "Total gastado en USD en el mes" },
};

export function MonthTotalCounter({ total, isCurrentMonth, currency = "ARS" }: Props) {
  const [displayTotal, setDisplayTotal] = useState(0);
  const currentRef = useRef(0);

  useEffect(() => {
    const from = currentRef.current;
    const to = total;
    const start = Date.now();
    let raf: number;

    function tick() {
      const elapsed = Date.now() - start;
      const t = Math.min(1, elapsed / DURATION_MS);
      const eased = 1 - Math.pow(1 - t, 3);
      const value = from + (to - from) * eased;
      currentRef.current = value;
      setDisplayTotal(value);
      if (t < 1) raf = requestAnimationFrame(tick);
    }

    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [total]);

  const label = isCurrentMonth ? LABELS[currency].current : LABELS[currency].past;

  return (
    <View style={styles.wrapper}>
      <Text style={styles.label}>{label}</Text>
      <Text
        style={styles.total}
        numberOfLines={1}
        adjustsFontSizeToFit
        minimumFontScale={0.5}
      >
        {formatCurrency(displayTotal, currency)}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: { alignItems: "stretch", gap: spacing.xs, width: "100%" },
  label: { ...typography.bodySm, color: colors.textSecondary, textAlign: "center" },
  total: { ...typography.displayXl, fontSize: 36, color: colors.textPrimary, textAlign: "center" },
});
