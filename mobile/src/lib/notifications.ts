import * as Device from "expo-device";
import * as Notifications from "expo-notifications";
import { supabase } from "./supabase";

// Registra el token de push del dispositivo para que la Edge Function
// `period-snapshot` pueda avisar al cerrar el corte semanal/mensual.
export async function registerForPushNotifications(userId: string): Promise<void> {
  if (!Device.isDevice) return; // los simuladores no reciben push

  const { status: existingStatus } = await Notifications.getPermissionsAsync();
  let finalStatus = existingStatus;
  if (existingStatus !== "granted") {
    const { status } = await Notifications.requestPermissionsAsync();
    finalStatus = status;
  }
  if (finalStatus !== "granted") return;

  const { data: token } = await Notifications.getExpoPushTokenAsync();

  await supabase
    .from("push_tokens")
    .upsert({ user_id: userId, expo_push_token: token }, { onConflict: "user_id,expo_push_token" });
}
