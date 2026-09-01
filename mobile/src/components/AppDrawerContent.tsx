import { Pressable, StyleSheet, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import type { DrawerContentComponentProps } from "@react-navigation/drawer";
import { colors, radius, spacing, typography } from "../theme";
import { supabase } from "../lib/supabase";

const ITEMS: { route: string; label: string; icon: keyof typeof Ionicons.glyphMap; nested?: boolean }[] = [
  { route: "Resumen", label: "Resumen", icon: "pie-chart-outline", nested: true },
  { route: "Gastos", label: "Gastos", icon: "wallet-outline", nested: true },
  { route: "Cuotas", label: "Cuotas", icon: "card-outline", nested: true },
  { route: "Presupuestos", label: "Presupuestos", icon: "trending-up-outline" },
  { route: "Ajustes", label: "Ajustes", icon: "settings-outline" },
];

interface Props extends DrawerContentComponentProps {
  email?: string;
}

export function AppDrawerContent({ navigation, state, email }: Props) {
  const activeDrawerRoute = state.routes[state.index];
  const nestedState = activeDrawerRoute?.state as { index?: number; routes?: { name: string }[] } | undefined;
  const activeRouteName =
    activeDrawerRoute?.name === "Home"
      ? nestedState?.routes?.[nestedState?.index ?? 0]?.name
      : activeDrawerRoute?.name;
  const initial = (email ?? "?").charAt(0).toUpperCase();

  return (
    <View style={styles.container}>
      <View style={styles.profile}>
        <View style={styles.avatar}>
          <Text style={styles.avatarText}>{initial}</Text>
        </View>
        <Text style={styles.email} numberOfLines={1}>
          {email}
        </Text>
      </View>

      {ITEMS.map((item) => {
        const isActive = item.route === activeRouteName;
        return (
          <Pressable
            key={item.route}
            style={[styles.item, isActive && styles.itemActive]}
            onPress={() =>
              item.nested
                ? navigation.navigate("Home", { screen: item.route })
                : navigation.navigate(item.route)
            }
          >
            <Ionicons
              name={item.icon}
              size={18}
              color={isActive ? colors.negative : colors.textPrimary}
            />
            <Text style={[styles.itemLabel, isActive && styles.itemLabelActive]}>{item.label}</Text>
          </Pressable>
        );
      })}

      <Pressable style={styles.logout} onPress={() => supabase.auth.signOut()}>
        <Ionicons name="log-out-outline" size={18} color={colors.negative} />
        <Text style={styles.logoutLabel}>Cerrar sesión</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.surface, paddingTop: 60, paddingHorizontal: spacing.lg },
  profile: { flexDirection: "row", alignItems: "center", gap: spacing.sm, marginBottom: spacing.xl },
  avatar: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: colors.negative,
    alignItems: "center",
    justifyContent: "center",
  },
  avatarText: { color: "#fff", fontWeight: "700", fontSize: 14 },
  email: { ...typography.bodySm, color: colors.textPrimary, flexShrink: 1 },
  item: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.sm,
    borderRadius: radius.md,
    marginBottom: 2,
  },
  itemActive: { backgroundColor: colors.negativeSurface },
  itemLabel: { ...typography.bodyMd, color: colors.textPrimary },
  itemLabelActive: { color: colors.negative, fontWeight: "700" },
  logout: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    marginTop: spacing.xl,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.sm,
  },
  logoutLabel: { ...typography.bodyMd, color: colors.negative },
});
