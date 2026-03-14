import React, { useEffect, useState } from "react";
import { View, Text, ScrollView, StyleSheet, ActivityIndicator } from "react-native";
import { getHistory } from "../services/api";

export default function HistoryScreen() {
  const [logs, setLogs]     = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    getHistory(7)
      .then(r => setLogs(r.data))
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color="#22c55e" />
      </View>
    );
  }

  // Group by date
  const byDate: Record<string, any[]> = {};
  for (const log of logs) {
    const d = log.timestamp.slice(0, 10);
    if (!byDate[d]) byDate[d] = [];
    byDate[d].push(log);
  }

  const dates = Object.keys(byDate).sort().reverse();

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <Text style={styles.title}>Last 7 days</Text>

      {dates.length === 0 && (
        <Text style={styles.empty}>No activity logged yet.</Text>
      )}

      {dates.map(date => {
        const entries = byDate[date];
        const meds  = entries.filter(e => e.type === "medicine").length;
        const walks = entries.filter(e => e.type === "walk").length;
        const ex    = entries.filter(e => e.type === "exercise").length;

        return (
          <View key={date} style={styles.day}>
            <Text style={styles.dateLabel}>
              {new Date(date + "T12:00:00").toDateString()}
            </Text>

            <View style={styles.pills}>
              {meds  > 0 && <View style={[styles.pill, styles.medPill]}><Text style={styles.pillTxt}>{meds} med{meds > 1 ? "s" : ""}</Text></View>}
              {walks > 0 && <View style={[styles.pill, styles.walkPill]}><Text style={styles.pillTxt}>walked</Text></View>}
              {ex    > 0 && <View style={[styles.pill, styles.exPill]}>  <Text style={styles.pillTxt}>exercise</Text></View>}
            </View>

            {entries.map((e, i) => (
              <Text key={i} style={styles.entry}>
                {e.timestamp.slice(11, 16)}  {e.type}{e.notes ? ` — ${e.notes}` : ""}
              </Text>
            ))}
          </View>
        );
      })}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  center:    { flex: 1, justifyContent: "center", alignItems: "center" },
  container: { padding: 20, paddingBottom: 40 },
  title:     { fontSize: 22, fontWeight: "700", marginBottom: 16 },
  empty:     { color: "#9ca3af", fontSize: 14 },
  day:       { marginBottom: 24, borderLeftWidth: 3, borderLeftColor: "#22c55e", paddingLeft: 12 },
  dateLabel: { fontWeight: "700", marginBottom: 6, fontSize: 15 },
  pills:     { flexDirection: "row", flexWrap: "wrap", gap: 6, marginBottom: 6 },
  pill:      { borderRadius: 999, paddingHorizontal: 10, paddingVertical: 3 },
  medPill:   { backgroundColor: "#dcfce7" },
  walkPill:  { backgroundColor: "#dbeafe" },
  exPill:    { backgroundColor: "#fef9c3" },
  pillTxt:   { fontSize: 12, fontWeight: "600" },
  entry:     { fontSize: 12, color: "#6b7280", marginBottom: 2 },
});
