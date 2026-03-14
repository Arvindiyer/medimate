import React, { useEffect, useState } from "react";
import {
  View, Text, TouchableOpacity, ScrollView, StyleSheet,
  TextInput, Alert, ActivityIndicator,
} from "react-native";
import { getMedications, logActivity, getTodayLogs } from "../services/api";

export default function LogScreen() {
  const [meds, setMeds]       = useState<any[]>([]);
  const [todayLogs, setLogs]  = useState<any[]>([]);
  const [walkMin, setWalkMin] = useState("20");
  const [exNote, setExNote]   = useState("");
  const [loading, setLoading] = useState(true);
  const [logging, setLogging] = useState<string | null>(null);

  const load = async () => {
    try {
      const [m, l] = await Promise.all([getMedications(), getTodayLogs()]);
      setMeds(m.data);
      setLogs(l.data);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const loggedMedIds = new Set(todayLogs.filter((l: any) => l.type === "medicine").map((l: any) => l.med_id));
  const walkedToday  = todayLogs.some((l: any) => l.type === "walk");

  const handleMed = async (med: any) => {
    setLogging(`med-${med.id}`);
    try {
      await logActivity("medicine", med.id, `Took ${med.name} ${med.dose}`);
      Alert.alert("Logged!", `${med.name} marked as taken.`);
      load();
    } finally {
      setLogging(null);
    }
  };

  const handleWalk = async () => {
    setLogging("walk");
    try {
      await logActivity("walk", undefined, `${walkMin} minutes`);
      Alert.alert("Great job!", `${walkMin}-minute walk logged.`);
      load();
    } finally {
      setLogging(null);
    }
  };

  const handleExercise = async () => {
    setLogging("exercise");
    try {
      await logActivity("exercise", undefined, exNote || "Exercise done");
      Alert.alert("Nice work!", "Exercise logged.");
      setExNote("");
      load();
    } finally {
      setLogging(null);
    }
  };

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color="#22c55e" />
      </View>
    );
  }

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <Text style={styles.title}>Log Today</Text>

      {/* Medications */}
      <Text style={styles.section}>Medications</Text>
      {meds.length === 0 && (
        <Text style={styles.empty}>No medications set up yet. Go to the Setup tab.</Text>
      )}
      {meds.map((med: any) => {
        const done = loggedMedIds.has(med.id);
        const isLogging = logging === `med-${med.id}`;
        return (
          <TouchableOpacity
            key={med.id}
            style={[styles.row, done && styles.rowDone]}
            onPress={() => !done && handleMed(med)}
            disabled={done || !!logging}
          >
            {isLogging
              ? <ActivityIndicator color="#22c55e" />
              : <Text style={styles.rowText}>{done ? "✓  " : "    "}{med.name} {med.dose}</Text>
            }
            <Text style={styles.rowSub}>{med.times.join(", ")}</Text>
          </TouchableOpacity>
        );
      })}

      {/* Walk */}
      <Text style={styles.section}>Walk</Text>
      {walkedToday ? (
        <View style={styles.rowDone}>
          <Text style={styles.rowText}>Walk logged today</Text>
        </View>
      ) : (
        <View style={styles.row}>
          <Text style={styles.rowText}>Minutes walked</Text>
          <TextInput
            style={styles.input}
            value={walkMin}
            onChangeText={setWalkMin}
            keyboardType="number-pad"
          />
          <TouchableOpacity
            style={styles.btn}
            onPress={handleWalk}
            disabled={!!logging}
          >
            {logging === "walk"
              ? <ActivityIndicator color="#fff" />
              : <Text style={styles.btnText}>Log</Text>
            }
          </TouchableOpacity>
        </View>
      )}

      {/* Exercise */}
      <Text style={styles.section}>Exercise</Text>
      <View style={styles.row}>
        <TextInput
          style={[styles.input, { flex: 1 }]}
          placeholder="e.g. 10 min stretching"
          value={exNote}
          onChangeText={setExNote}
        />
        <TouchableOpacity
          style={styles.btn}
          onPress={handleExercise}
          disabled={!!logging}
        >
          {logging === "exercise"
            ? <ActivityIndicator color="#fff" />
            : <Text style={styles.btnText}>Log</Text>
          }
        </TouchableOpacity>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  center:   { flex: 1, justifyContent: "center", alignItems: "center" },
  container:{ padding: 20, paddingBottom: 40 },
  title:    { fontSize: 22, fontWeight: "700", marginBottom: 16 },
  section:  { fontSize: 16, fontWeight: "700", marginTop: 20, marginBottom: 8, color: "#374151" },
  empty:    { color: "#9ca3af", fontSize: 13, marginBottom: 8 },
  row:      { backgroundColor: "#f8fafc", padding: 14, borderRadius: 10, marginBottom: 10, flexDirection: "row", alignItems: "center", flexWrap: "wrap", gap: 8 },
  rowDone:  { backgroundColor: "#dcfce7", padding: 14, borderRadius: 10, marginBottom: 10 },
  rowText:  { fontSize: 15, fontWeight: "600", flex: 1 },
  rowSub:   { fontSize: 12, color: "#6b7280" },
  input:    { borderWidth: 1, borderColor: "#d1d5db", borderRadius: 8, padding: 8, fontSize: 14, minWidth: 60 },
  btn:      { backgroundColor: "#22c55e", paddingHorizontal: 14, paddingVertical: 8, borderRadius: 8, minWidth: 48, alignItems: "center" },
  btnText:  { color: "#fff", fontWeight: "600", fontSize: 14 },
});
