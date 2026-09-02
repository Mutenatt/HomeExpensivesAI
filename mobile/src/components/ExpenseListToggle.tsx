import { Pressable, StyleSheet, Text, View } from "react-native";
import { colors, radius, spacing, typography } from "../theme";

export type ExpenseListMode = "recent" | "corriente";

interface Props {
  value: ExpenseListMode;
  onChange: (mode: ExpenseListMode) => void;
}

const OPTIONS: { value: ExpenseListMode; label: string }[] = [
  { value: "corriente", label: "Corriente" },
  { value: "recent", label: "Recientes" },
];

export function ExpenseListToggle({ value, onChange }: Props) {
  return (
    <View style={styles.wrapper}>
      {OPTIONS.map((option) => {
        const active = option.value === value;
        return (
          <Pressable
            key={option.value}
            style={[styles.pill, active && styles.pillActive]}
            onPress={() => onChange(option.value)}
          >
            <Text style={[styles.label, active && styles.labelActive]}>{option.label}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    flexDirection: "row",
    backgroundColor: colors.borderSubtle,
    borderRadius: radius.pill,
    padding: 4,
    alignSelf: "flex-start",
    gap: 4,
  },
  pill: {
    paddingVertical: spacing.xs,
    paddingHorizontal: spacing.md,
    borderRadius: radius.pill,
  },
  pillActive: {
    backgroundColor: colors.surface,
  },
  label: { ...typography.bodySm, fontWeight: "600", color: colors.textSecondary },
  labelActive: { color: colors.textPrimary },
});
