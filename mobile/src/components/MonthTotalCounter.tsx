import { StyleSheet, Text, View } from "react-native";
import { colors, spacing, typography } from "../theme";

interface Props {
  total: number;
  isCurrentMonth: boolean;
}

export function MonthTotalCounter({ total, isCurrentMonth }: Props) {
  return (
    <View style={styles.wrapper}>
      <Text style={styles.label}>
        {isCurrentMonth ? "Llevás gastado este mes" : "Total gastado en el mes"}
      </Text>
      <Text style={styles.total}>${total.toFixed(2)}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: { alignItems: "center", gap: spacing.xs },
  label: { ...typography.bodySm, color: colors.textSecondary },
  total: { ...typography.displayXl, fontSize: 40, color: colors.textPrimary },
});
