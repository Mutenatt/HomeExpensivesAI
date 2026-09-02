import { Pressable, StyleSheet, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { colors, radius, shadows, spacing, typography } from "../theme";

interface Props {
  label: string;
  onPrev: () => void;
  onNext: () => void;
  disableNext: boolean;
}

export function MonthSelector({ label, onPrev, onNext, disableNext }: Props) {
  return (
    <View style={styles.wrapper}>
      <Pressable style={styles.arrow} onPress={onPrev} hitSlop={8}>
        <Ionicons name="chevron-back" size={18} color={colors.textPrimary} />
      </Pressable>
      <Text style={styles.label}>{label}</Text>
      <Pressable
        style={[styles.arrow, disableNext && styles.arrowDisabled]}
        onPress={onNext}
        disabled={disableNext}
        hitSlop={8}
      >
        <Ionicons
          name="chevron-forward"
          size={18}
          color={disableNext ? colors.borderSubtle : colors.textPrimary}
        />
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    alignSelf: "center",
    backgroundColor: colors.surface,
    borderRadius: radius.pill,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    gap: spacing.md,
    ...shadows.soft,
  },
  arrow: {
    width: 28,
    height: 28,
    alignItems: "center",
    justifyContent: "center",
  },
  arrowDisabled: {
    opacity: 0.4,
  },
  label: { ...typography.headingMd, color: colors.textPrimary, textTransform: "capitalize" },
});
