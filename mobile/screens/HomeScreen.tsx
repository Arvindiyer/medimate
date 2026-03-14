import React, { useEffect, useState, useCallback } from "react";
import {
  View, Text, ScrollView, StyleSheet, RefreshControl, ActivityIndicator,
} from "react-native";
import { getDueReminders, getTodayLogs, getFoodRec } from "../services/api";

export default function HomeScreen() {
  const [overdue, setOverdue]     = useState<any[]>([]);
  const [logs, setLogs]           = useState<any[]>([]);
  const [foodRec, setFoodRec]     = useState("");
  const [refreshing, setRefreshing] = useState(false);
  const [loading, setLoading]     = useState(true);

  const load = useCallback(async () => {
    try {
      const [reminders, today, food] = await Promise.all([
        getDueReminders(),
        getTodayLogs(),
        getFoodRec(),
      ]);
      setOverdue(reminders.data);
      setLogs(today.data);
      setFoodRec(food.data.recommendation);
    } catch (e) {
      // backend not reachable yet — fail silently
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const onRefresh = () => { setRefreshing(true); load(); };

  const walkedToday = logs.some((l: any) => l.type === "walk");
  const greeting = () => {
    const h = new Date().getHours();
    if (h < 12) return "Good morning";
    if (h < 17) return "Good afternoon";
    return "Good evening";
  };

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color="#22c55e" />
      </View>
    );
  }

  return (
    <ScrollView
      contentContainerStyle={styles.container}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
    >
      <Text style={styles.title}>{greeting()}</Text>
      <Text style={styles.subtitle}>{new Date().toDateString()}</Text>

      {/* Overdue medications */}
      {overdue.length > 0 && (
        <View style={styles.alertBox}>
          <Text style={styles.alertTitle}>Overdue medications</Text>
          {overdue.map((r: any, i: number) => (
            <Text key={i} style={styles.alertItem}>
              {r.name} {r.dose} — was due at {r.time}
            </Text>
          ))}
        </View>
      )}

      {/* Walk status */}
      <View style={[styles.card, walkedToday && styles.cardDone]}>
        <Text style={styles.cardTitle}>
          {walkedToday ? "Walk done today" : "Walk not yet logged"}
        </Text>
      </View>

      {/* Food recommendation */}
      {foodRec ? (
        <View style={styles.foodCard}>
          <Text style={styles.foodTitle}>Meal suggestion</Text>
          <Text style={styles.foodText}>{foodRec}</Text>
        </View>
      ) : null}

      {/* Today summary */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>
          Today's activity ({logs.length} {logs.length === 1 ? "entry" : "entries"})
        </Text>
        {logs.length === 0 && (
          <Text style={styles.empty}>Nothing logged yet — use the Log tab to get started.</Text>
        )}
        {logs.slice(0, 6).map((l: any, i: number) => (
          <Text key={i} style={styles.logItem}>
            {l.timestamp.slice(11, 16)}  {l.type}{l.notes ? ` — ${l.notes}` : ""}
          </Text>
        ))}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  center:       { flex: 1, justifyContent: "center", alignItems: "center" },
  container:    { padding: 20, paddingBottom: 40 },
  title:        { fontSize: 26, fontWeight: "700", marginBottom: 2 },
  subtitle:     { fontSize: 14, color: "#6b7280", marginBottom: 20 },
  alertBox:     { backgroundColor: "#fef2f2", borderLeftWidth: 4, borderLeftColor: "#ef4444", padding: 14, borderRadius: 8, marginBottom: 14 },
  alertTitle:   { fontWeight: "700", color: "#991b1b", marginBottom: 6 },
  alertItem:    { color: "#991b1b", fontSize: 13, marginBottom: 2 },
  card:         { backgroundColor: "#f1f5f9", padding: 14, borderRadius: 10, marginBottom: 10 },
  cardDone:     { backgroundColor: "#dcfce7" },
  cardTitle:    { fontSize: 15, fontWeight: "600" },
  foodCard:     { backgroundColor: "#fefce8", padding: 14, borderRadius: 10, marginBottom: 14 },
  foodTitle:    { fontWeight: "700", marginBottom: 6 },
  foodText:     { fontSize: 14, lineHeight: 22 },
  section:      { marginTop: 10 },
  sectionTitle: { fontWeight: "700", marginBottom: 8, fontSize: 15 },
  empty:        { color: "#9ca3af", fontSize: 13 },
  logItem:      { fontSize: 13, color: "#555", marginBottom: 4 },
});
