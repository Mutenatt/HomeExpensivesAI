import { Pressable, StyleSheet, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { colors, radius, spacing, typography } from "../theme";
import { supabase } from "../lib/supabase";

interface Props {
  email?: string;
}

const ROWS: { icon: keyof typeof Ionicons.glyphMap; label: string }[] = [
  { icon: "person-outline", label: "Perfil" },
  { icon: "card-outline", label: "Métodos de pago" },
  { icon: "pricetag-outline", label: "Categorías" },
];

export function AjustesScreen({ email }: Props) {
  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Ajustes</Text>
        {email && <Text style={styles.headerSubtitle}>{email}</Text>}
      </View>

      <View style={styles.list}>
        {ROWS.map((row) => (
          <View key={row.label} style={styles.row}>
            <Ionicons name={row.icon} size={18} color={colors.textPrimary} />
            <Text style={styles.rowLabel}>{row.label}</Text>
          </View>
        ))}
      </View>

      <Pressable style={styles.logout} onPress={() => supabase.auth.signOut()}>
        <Ionicons name="log-out-outline" size={18} color={colors.negative} />
        <Text style={styles.logoutLabel}>Cerrar sesión</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bgBase },
  header: { paddingTop: 60, paddingHorizontal: spacing.lg, paddingBottom: spacing.sm },
  headerTitle: { ...typography.headingMd, fontSize: 24, color: colors.textPrimary },
  headerSubtitle: { ...typography.bodySm, color: colors.textSecondary, marginTop: 2 },
  list: { paddingHorizontal: spacing.lg, marginTop: spacing.md },
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.md,
    marginBottom: spacing.sm,
  },
  rowLabel: { ...typography.bodyMd, color: colors.textPrimary },
  logout: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    marginHorizontal: spacing.lg,
    marginTop: spacing.lg,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.md,
    backgroundColor: colors.negativeSurface,
    borderRadius: radius.md,
  },
  logoutLabel: { ...typography.bodyMd, color: colors.negative, fontWeight: "700" },
});
