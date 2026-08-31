import { useState } from "react";
import { Pressable, StyleSheet, Text, TextInput, View } from "react-native";
import { supabase } from "../lib/supabase";

export function AuthScreen() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [mode, setMode] = useState<"sign-in" | "sign-up">("sign-in");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit() {
    setLoading(true);
    setError(null);
    const { error: authError } =
      mode === "sign-in"
        ? await supabase.auth.signInWithPassword({ email, password })
        : await supabase.auth.signUp({ email, password });
    setLoading(false);
    if (authError) setError(authError.message);
  }

  return (
    <View style={styles.container}>
      <Text style={styles.title}>HomeExpensivesAI</Text>
      <TextInput
        style={styles.input}
        placeholder="Email"
        autoCapitalize="none"
        keyboardType="email-address"
        value={email}
        onChangeText={setEmail}
      />
      <TextInput
        style={styles.input}
        placeholder="Contraseña"
        secureTextEntry
        value={password}
        onChangeText={setPassword}
      />
      {error && <Text style={styles.error}>{error}</Text>}
      <Pressable style={styles.button} onPress={handleSubmit} disabled={loading}>
        <Text style={styles.buttonText}>{mode === "sign-in" ? "Ingresar" : "Crear cuenta"}</Text>
      </Pressable>
      <Pressable onPress={() => setMode(mode === "sign-in" ? "sign-up" : "sign-in")}>
        <Text style={styles.switchModeText}>
          {mode === "sign-in" ? "¿No tenés cuenta? Creá una" : "¿Ya tenés cuenta? Ingresá"}
        </Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, justifyContent: "center", padding: 24, gap: 12, backgroundColor: "#fff" },
  title: { fontSize: 28, fontWeight: "700", marginBottom: 16, textAlign: "center" },
  input: { borderWidth: 1, borderColor: "#ddd", borderRadius: 10, paddingHorizontal: 12, paddingVertical: 12 },
  button: { backgroundColor: "#2563eb", padding: 14, borderRadius: 10, alignItems: "center", marginTop: 8 },
  buttonText: { color: "#fff", fontWeight: "700" },
  switchModeText: { textAlign: "center", color: "#2563eb", marginTop: 12 },
  error: { color: "#dc2626" },
});
