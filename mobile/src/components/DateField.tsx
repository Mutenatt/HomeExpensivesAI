import { useState } from "react";
import { Platform, Pressable, StyleSheet, Text, View } from "react-native";
import { colors, radius, spacing, typography } from "../theme";

const NativeDateTimePicker =
  Platform.OS !== "web" ? require("@react-native-community/datetimepicker").default : null;

interface Props {
  value: Date | null;
  onChange: (date: Date | null) => void;
}

function formatDate(date: Date): string {
  const day = String(date.getDate()).padStart(2, "0");
  const month = String(date.getMonth() + 1).padStart(2, "0");
  return `${day}/${month}/${date.getFullYear()}`;
}

function toInputValue(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export function DateField({ value, onChange }: Props) {
  const [webEditing, setWebEditing] = useState(false);
  const [nativePickerVisible, setNativePickerVisible] = useState(false);

  function handleChangePress() {
    if (Platform.OS === "web") {
      setWebEditing(true);
    } else {
      setNativePickerVisible(true);
    }
  }

  return (
    <View style={styles.row}>
      <Text style={styles.label}>{value ? formatDate(value) : "Hoy"}</Text>

      {value ? (
        <Pressable onPress={() => onChange(null)}>
          <Text style={styles.link}>Usar hoy</Text>
        </Pressable>
      ) : (
        <Pressable onPress={handleChangePress}>
          <Text style={styles.link}>Cambiar fecha</Text>
        </Pressable>
      )}

      {Platform.OS === "web" && webEditing && (
        <input
          type="date"
          autoFocus
          value={toInputValue(value ?? new Date())}
          max={toInputValue(new Date())}
          onChange={(e: any) => {
            const [y, m, d] = e.target.value.split("-").map(Number);
            if (y && m && d) onChange(new Date(y, m - 1, d));
            setWebEditing(false);
          }}
          onBlur={() => setWebEditing(false)}
          style={webInputStyle}
        />
      )}

      {Platform.OS !== "web" && nativePickerVisible && (
        <NativeDateTimePicker
          value={value ?? new Date()}
          mode="date"
          maximumDate={new Date()}
          onChange={(_event: unknown, selected?: Date) => {
            setNativePickerVisible(false);
            if (selected) onChange(selected);
          }}
        />
      )}
    </View>
  );
}

const webInputStyle = {
  fontFamily: "inherit",
  fontSize: 13,
  color: colors.textPrimary,
  border: `1px solid ${colors.borderSubtle}`,
  borderRadius: radius.sm,
  padding: "4px 8px",
};

const styles = StyleSheet.create({
  row: { flexDirection: "row", alignItems: "center", gap: spacing.sm },
  label: { ...typography.bodySm, color: colors.textPrimary, fontWeight: "600" },
  link: { ...typography.bodySm, fontSize: 12, color: colors.negative },
});
