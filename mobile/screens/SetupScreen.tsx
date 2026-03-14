import React, { useState, useEffect } from "react";
import {
  View, Text, TextInput, TouchableOpacity, ScrollView,
  Alert, StyleSheet, ActivityIndicator,
} from "react-native";
import { getMedications, addMedication, deleteMedication } from "../services/api";
import { scheduleMedReminder, scheduleWalkReminder } from "../notifications";

export default function SetupScreen() {
  const [meds, setMeds]         = useState<any[]>([]);
  const [name, setName]         = useState("");
  const [dose, setDose]         = useState("");
  const [times, setTimes]       = useState("08:00");
  const [walkTime, setWalkTime] = useState("10:00");
  const [loading, setLoading]   = useState(true);
  const [saving, setSaving]     = useState(false);

  const load = async () => {
    try {
      const r = await getMedications();
      setMeds(r.data);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const handleAdd = async () => {
    if (!name.trim()) {
      Alert.alert("Missing name", "Please enter a medication name.");
      return;
    }
    setSaving(true);
    try {
      const timesArr = times.split(",").map(t => t.trim()).filter(Boolean);
      const res = await addMedication({ name: name.trim(), dose: dose.trim(), times: timesArr });
      for (const t of timesArr) {
        await scheduleMedReminder(name.trim(), t, res.data.id);
      }
      setName(""); setDose(""); setTimes("08:00");
      Alert.alert("Added!", `${name} added with reminders at ${timesArr.join(", ")}.`);
      load();
    } catch {
      Alert.alert("Error", "Could not add medication. Is the backend running?");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: number, medName: string) => {
    Alert.alert("Remove medication", `Remove ${medName}?`, [
      { text: "Cancel", style: "cancel" },
      {
        text: "Remove", style: "destructive",
        onPress: async () => {
          await deleteMedication(id);
          load();
        },
      },
    ]);
  };

  const handleWalkReminder = async () => {
    const [h, m] = walkTime.split(":").map(Number);
    await scheduleWalkReminder(h, m);
    Alert.alert("Set!", `Walk reminder set for ${walkTime} daily.`);
  };

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color="#22c55e" />
      </View>
    );
  }

  return (
    <ScrollView contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled">
      <Text style={styles.title}>Setup</Text>

      {/* Add medication */}
      <Text style={styles.section}>Add medication</Text>
      <TextInput style={styles.input} placeholder="Name (e.g. Metformin)"   value={name}  onChangeText={setName} />
      <TextInput style={styles.input} placeholder="Dose (e.g. 500mg)"       value={dose}  onChangeText={setDose} />
      <TextInput style={styles.input} placeholder="Times: 08:00 or 08:00,20:00" value={times} onChangeText={setTimes} />
      <TouchableOpacity style={styles.btn} onPress={handleAdd} disabled={saving}>
        {saving
          ? <ActivityIndicator color="#fff" />
          : <Text style={styles.btnTxt}>Add + set reminder</Text>
        }
      </TouchableOpacity>

      {/* Existing medications */}
      {meds.length > 0 && (
        <>
          <Text style={styles.section}>Your medications</Text>
          {meds.map((m: any) => (
            <View key={m.id} style={styles.row}>
              <View style={{ flex: 1 }}>
                <Text style={styles.rowName}>{m.name} {m.dose}</Text>
                <Text style={styles.rowSub}>{m.times.join(", ")}</Text>
              </View>
              <TouchableOpacity onPress={() => handleDelete(m.id, m.name)}>
                <Text style={styles.removeBtn}>Remove</Text>
              </TouchableOpacity>
            </View>
          ))}
        </>
      )}

      {/* Walk reminder */}
      <Text style={styles.section}>Daily walk reminder</Text>
      <TextInput
        style={styles.input}
        placeholder="Time (e.g. 10:00)"
        value={walkTime}
        onChangeText={setWalkTime}
      />
      <TouchableOpacity style={[styles.btn, styles.btnSecondary]} onPress={handleWalkReminder}>
        <Text style={styles.btnTxt}>Set walk reminder</Text>
      </TouchableOpacity>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  center:      { flex: 1, justifyContent: "center", alignItems: "center" },
  container:   { padding: 20, paddingBottom: 40 },
  title:       { fontSize: 22, fontWeight: "700", marginBottom: 16 },
  section:     { fontSize: 16, fontWeight: "700", marginTop: 24, marginBottom: 10, color: "#374151" },
  input:       { borderWidth: 1, borderColor: "#d1d5db", borderRadius: 8, padding: 10, fontSize: 14, marginBottom: 8, backgroundColor: "#fff" },
  btn:         { backgroundColor: "#22c55e", padding: 13, borderRadius: 10, alignItems: "center", marginBottom: 8 },
  btnSecondary:{ backgroundColor: "#3b82f6" },
  btnTxt:      { color: "#fff", fontWeight: "700", fontSize: 15 },
  row:         { flexDirection: "row", alignItems: "center", padding: 12, backgroundColor: "#f8fafc", borderRadius: 8, marginBottom: 8 },
  rowName:     { fontSize: 14, fontWeight: "600" },
  rowSub:      { fontSize: 12, color: "#6b7280", marginTop: 2 },
  removeBtn:   { color: "#ef4444", fontWeight: "600", fontSize: 14 },
});
