import { StyleSheet, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { colors, spacing, typography } from "../theme";

export function ResumenScreen() {
  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Resumen</Text>
      </View>
      <View style={styles.body}>
        <Ionicons name="pie-chart-outline" size={40} color={colors.textSecondary} />
        <Text style={styles.comingSoon}>Próximamente</Text>
        <Text style={styles.description}>
          Acá vas a ver el total del mes, el desglose esencial vs. no esencial y tu ranking de
          categorías.
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bgBase },
  header: { paddingTop: 60, paddingHorizontal: spacing.lg, paddingBottom: spacing.sm },
  headerTitle: { ...typography.headingMd, fontSize: 24, color: colors.textPrimary },
  body: { flex: 1, alignItems: "center", justifyContent: "center", gap: spacing.sm, paddingHorizontal: 40 },
  comingSoon: { ...typography.bodyMd, color: colors.textPrimary, fontWeight: "700" },
  description: { ...typography.bodySm, color: colors.textSecondary, textAlign: "center" },
});
