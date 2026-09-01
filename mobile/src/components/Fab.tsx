import { Pressable, StyleSheet } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { Ionicons } from "@expo/vector-icons";
import { colors, shadows } from "../theme";

interface Props {
  onPress: () => void;
}

export function Fab({ onPress }: Props) {
  return (
    <Pressable style={styles.wrapper} onPress={onPress}>
      <LinearGradient
        colors={[colors.accentGradientStart, colors.accentGradientEnd]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={styles.fab}
      >
        <Ionicons name="add" size={28} color="#fff" />
      </LinearGradient>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    position: "absolute",
    right: 20,
    bottom: 100,
    ...shadows.fab,
  },
  fab: {
    width: 56,
    height: 56,
    borderRadius: 28,
    alignItems: "center",
    justifyContent: "center",
  },
});
