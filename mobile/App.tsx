import React, { useEffect } from "react";
import { NavigationContainer } from "@react-navigation/native";
import { createBottomTabNavigator } from "@react-navigation/bottom-tabs";
import { Text } from "react-native";
import { registerForPushNotifications } from "./notifications";
import HomeScreen    from "./screens/HomeScreen";
import LogScreen     from "./screens/LogScreen";
import ChatScreen    from "./screens/ChatScreen";
import HistoryScreen from "./screens/HistoryScreen";
import SetupScreen   from "./screens/SetupScreen";

const Tab = createBottomTabNavigator();

const icon = (label: string) => ({ color }: { color: string }) => (
  <Text style={{ fontSize: 20, color }}>{label}</Text>
);

export default function App() {
  useEffect(() => {
    registerForPushNotifications();
  }, []);

  return (
    <NavigationContainer>
      <Tab.Navigator
        screenOptions={{
          tabBarActiveTintColor: "#22c55e",
          tabBarInactiveTintColor: "#9ca3af",
          tabBarStyle: { paddingBottom: 4 },
          headerStyle: { backgroundColor: "#fff" },
          headerTitleStyle: { fontWeight: "700", color: "#111827" },
        }}
      >
        <Tab.Screen name="Today"   component={HomeScreen}    options={{ tabBarIcon: icon("🏠"), title: "MediMate" }} />
        <Tab.Screen name="Log"     component={LogScreen}     options={{ tabBarIcon: icon("📝") }} />
        <Tab.Screen name="Chat"    component={ChatScreen}    options={{ tabBarIcon: icon("💬") }} />
        <Tab.Screen name="History" component={HistoryScreen} options={{ tabBarIcon: icon("📅") }} />
        <Tab.Screen name="Setup"   component={SetupScreen}   options={{ tabBarIcon: icon("⚙️") }} />
      </Tab.Navigator>
    </NavigationContainer>
  );
}
