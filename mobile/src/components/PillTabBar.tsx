import { Pressable, StyleSheet, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import type { BottomTabBarProps } from "@react-navigation/bottom-tabs";
import { colors, radius, shadows, spacing, typography } from "../theme";

const ICONS: Record<string, keyof typeof Ionicons.glyphMap> = {
  Resumen: "pie-chart-outline",
  Gastos: "wallet-outline",
  Cuotas: "card-outline",
};

export function PillTabBar({ state, descriptors, navigation }: BottomTabBarProps) {
  return (
    <View style={styles.wrapper}>
      {state.routes.map((route, index) => {
        const { options } = descriptors[route.key];
        const label = (options.tabBarLabel ?? options.title ?? route.name) as string;
        const isFocused = state.index === index;
        const iconName = ICONS[route.name] ?? "ellipse-outline";

        function onPress() {
          const event = navigation.emit({ type: "tabPress", target: route.key, canPreventDefault: true });
          if (!isFocused && !event.defaultPrevented) {
            navigation.navigate(route.name);
          }
        }

        return (
          <Pressable key={route.key} style={styles.item} onPress={onPress}>
            <Ionicons
              name={iconName}
              size={20}
              color={isFocused ? colors.negative : colors.textSecondary}
            />
            <Text style={[styles.label, isFocused && styles.labelActive]}>{label}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    position: "absolute",
    left: spacing.lg,
    right: spacing.lg,
    bottom: spacing.lg,
    flexDirection: "row",
    justifyContent: "space-around",
    alignItems: "center",
    backgroundColor: colors.surface,
    borderRadius: radius.pill,
    paddingVertical: spacing.sm,
    ...shadows.soft,
  },
  item: {
    alignItems: "center",
    gap: 2,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
  },
  label: {
    ...typography.labelXs,
    fontSize: 10,
    color: colors.textSecondary,
  },
  labelActive: {
    color: colors.negative,
  },
});
