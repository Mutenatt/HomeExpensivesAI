import { StatusBar } from 'expo-status-bar';
import { useEffect, useState } from 'react';
import { ActivityIndicator, StyleSheet, View } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { NavigationContainer } from '@react-navigation/native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { createDrawerNavigator } from '@react-navigation/drawer';
import type { Session } from '@supabase/supabase-js';
import { AppDrawerContent } from './src/components/AppDrawerContent';
import { PillTabBar } from './src/components/PillTabBar';
import { AuthScreen } from './src/screens/AuthScreen';
import { DashboardScreen } from './src/screens/DashboardScreen';
import { InstallmentsScreen } from './src/screens/InstallmentsScreen';
import { ResumenScreen } from './src/screens/ResumenScreen';
import { PresupuestosScreen } from './src/screens/PresupuestosScreen';
import { AjustesScreen } from './src/screens/AjustesScreen';
import { supabase } from './src/lib/supabase';
import { getLocalDb } from './src/lib/localDb';
import { colors } from './src/theme';

const Tab = createBottomTabNavigator();
const Drawer = createDrawerNavigator();

function AppTabs({ userId }: { userId: string }) {
  return (
    <Tab.Navigator screenOptions={{ headerShown: false }} tabBar={(props) => <PillTabBar {...props} />}>
      <Tab.Screen name="Resumen">{() => <ResumenScreen />}</Tab.Screen>
      <Tab.Screen name="Gastos">{() => <DashboardScreen userId={userId} />}</Tab.Screen>
      <Tab.Screen name="Cuotas">{() => <InstallmentsScreen userId={userId} />}</Tab.Screen>
    </Tab.Navigator>
  );
}

function AppDrawer({ userId, email }: { userId: string; email?: string }) {
  return (
    <NavigationContainer>
      <Drawer.Navigator
        screenOptions={{ headerShown: false }}
        drawerContent={(props) => <AppDrawerContent {...props} email={email} />}
      >
        <Drawer.Screen name="Home">{() => <AppTabs userId={userId} />}</Drawer.Screen>
        <Drawer.Screen name="Presupuestos" component={PresupuestosScreen} />
        <Drawer.Screen name="Ajustes">{() => <AjustesScreen email={email} />}</Drawer.Screen>
      </Drawer.Navigator>
    </NavigationContainer>
  );
}

export default function App() {
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    getLocalDb();
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session);
      setLoading(false);
    });
    const { data: subscription } = supabase.auth.onAuthStateChange((_event, newSession) => {
      setSession(newSession);
    });
    return () => subscription.subscription.unsubscribe();
  }, []);

  if (loading) {
    return (
      <View style={styles.container}>
        <ActivityIndicator size="large" />
      </View>
    );
  }

  return (
    <GestureHandlerRootView style={styles.flex}>
      {session ? (
        <AppDrawer userId={session.user.id} email={session.user.email} />
      ) : (
        <AuthScreen />
      )}
      <StatusBar style="auto" />
    </GestureHandlerRootView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  container: {
    flex: 1,
    backgroundColor: colors.bgBase,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
