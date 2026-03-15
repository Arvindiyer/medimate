import React, { useEffect, useState } from 'react';
import {
  View, Text, ScrollView, StyleSheet, TouchableOpacity,
  TextInput, Alert, ActivityIndicator,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { getMedications, addMedication, deleteMedication, getHistory } from '../services/api';
import { scheduleMedReminder, scheduleWalkReminder } from '../notifications';
import { C, R } from '../theme';

export default function ProfileScreen() {
  const [meds, setMeds]         = useState<any[]>([]);
  const [logs, setLogs]         = useState<any[]>([]);
  const [name, setName]         = useState('');
  const [dose, setDose]         = useState('');
  const [times, setTimes]       = useState('08:00');
  const [walkTime, setWalkTime] = useState('10:00');
  const [showAdd, setShowAdd]   = useState(false);
  const [loading, setLoading]   = useState(true);
  const [saving, setSaving]     = useState(false);

  const load = async () => {
    try {
      const [m, h] = await Promise.all([getMedications(), getHistory(7)]);
      setMeds(m.data);
      setLogs(h.data);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const handleAdd = async () => {
    if (!name.trim()) {
      Alert.alert('Missing name', 'Please enter a medication name.');
      return;
    }
    setSaving(true);
    try {
      const timesArr = times.split(',').map(t => t.trim()).filter(Boolean);
      const res = await addMedication({ name: name.trim(), dose: dose.trim(), times: timesArr });
      for (const t of timesArr) await scheduleMedReminder(name.trim(), t, res.data.id);
      setName(''); setDose(''); setTimes('08:00'); setShowAdd(false);
      Alert.alert('Added!', `${name} added successfully.`);
      load();
    } catch {
      Alert.alert('Error', 'Could not add. Is the backend running?');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = (id: number, medName: string) => {
    Alert.alert('Remove medication', `Remove ${medName}?`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Remove', style: 'destructive',
        onPress: async () => { await deleteMedication(id); load(); },
      },
    ]);
  };

  const handleWalkReminder = async () => {
    const parts = walkTime.split(':').map(Number);
    await scheduleWalkReminder(parts[0], parts[1]);
    Alert.alert('Set!', `Walk reminder set for ${walkTime} daily.`);
  };

  // Group history by date
  const byDate: Record<string, any[]> = {};
  for (const log of logs) {
    const d = log.timestamp.slice(0, 10);
    if (!byDate[d]) byDate[d] = [];
    byDate[d].push(log);
  }
  const dates = Object.keys(byDate).sort().reverse();

  if (loading) {
    return <View style={styles.center}><ActivityIndicator size="large" color={C.t500} /></View>;
  }

  return (
    <ScrollView
      contentContainerStyle={styles.container}
      keyboardShouldPersistTaps="handled"
      showsVerticalScrollIndicator={false}
    >
      {/* ── Avatar Card ── */}
      <LinearGradient
        colors={['#0a6259', '#4a4de3']}
        style={styles.avatarCard}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
      >
        <View style={styles.avatarCircle}>
          <Text style={styles.avatarTxt}>MG</Text>
        </View>
        <Text style={styles.profileName}>Margaret G.</Text>
        <Text style={styles.profileSub}>MediMate Member</Text>
      </LinearGradient>

      {/* ── Medications ── */}
      <View style={styles.section}>
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>My Medications</Text>
          <TouchableOpacity onPress={() => setShowAdd(!showAdd)}>
            <Text style={styles.addLink}>{showAdd ? 'Cancel' : '+ Add'}</Text>
          </TouchableOpacity>
        </View>

        {showAdd && (
          <View style={styles.addForm}>
            <TextInput
              style={styles.input}
              placeholder="Name (e.g. Metformin)"
              value={name}
              onChangeText={setName}
              placeholderTextColor={C.s400}
            />
            <TextInput
              style={styles.input}
              placeholder="Dose (e.g. 500mg)"
              value={dose}
              onChangeText={setDose}
              placeholderTextColor={C.s400}
            />
            <TextInput
              style={styles.input}
              placeholder="Times: 08:00 or 08:00,20:00"
              value={times}
              onChangeText={setTimes}
              placeholderTextColor={C.s400}
            />
            <TouchableOpacity style={styles.saveBtn} onPress={handleAdd} disabled={saving}>
              {saving
                ? <ActivityIndicator color={C.white} />
                : <Text style={styles.saveBtnTxt}>Save Medication</Text>
              }
            </TouchableOpacity>
          </View>
        )}

        {meds.length === 0 && !showAdd && (
          <Text style={styles.empty}>No medications yet. Tap + Add to get started.</Text>
        )}

        {meds.map((m: any) => (
          <View key={m.id} style={styles.medRow}>
            <View style={styles.medIcon}>
              <Text style={{ fontSize: 18 }}>💊</Text>
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.medName}>{m.name} {m.dose}</Text>
              <Text style={styles.medTimes}>{(m.times ?? []).join(', ')}</Text>
            </View>
            <TouchableOpacity onPress={() => handleDelete(m.id, m.name)}>
              <Text style={styles.removeBtn}>Remove</Text>
            </TouchableOpacity>
          </View>
        ))}
      </View>

      {/* ── Walk Reminder ── */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Walk Reminder</Text>
        <View style={styles.reminderRow}>
          <TextInput
            style={[styles.input, { flex: 1, marginBottom: 0 }]}
            placeholder="10:00"
            value={walkTime}
            onChangeText={setWalkTime}
            placeholderTextColor={C.s400}
          />
          <TouchableOpacity style={styles.setBtn} onPress={handleWalkReminder}>
            <Text style={styles.setBtnTxt}>Set</Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* ── 7-Day History ── */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>7-Day History</Text>

        {dates.length === 0 && (
          <Text style={styles.empty}>No activity logged yet.</Text>
        )}

        {dates.map(d => {
          const entries     = byDate[d];
          const medsCount   = entries.filter(e => e.type === 'medicine').length;
          const walked      = entries.some(e => e.type === 'walk');
          const exercised   = entries.some(e => e.type === 'exercise');
          return (
            <View key={d} style={styles.dayRow}>
              <Text style={styles.dateLabel}>
                {new Date(d + 'T12:00:00').toLocaleDateString('en-US', {
                  weekday: 'short', month: 'short', day: 'numeric',
                })}
              </Text>
              <View style={styles.pills}>
                {medsCount > 0 && (
                  <View style={[styles.pill, { backgroundColor: C.t100 }]}>
                    <Text style={[styles.pillTxt, { color: C.t700 }]}>{medsCount} med{medsCount > 1 ? 's' : ''}</Text>
                  </View>
                )}
                {walked && (
                  <View style={[styles.pill, { backgroundColor: C.i50 }]}>
                    <Text style={[styles.pillTxt, { color: C.i500 }]}>walked</Text>
                  </View>
                )}
                {exercised && (
                  <View style={[styles.pill, { backgroundColor: C.a50 }]}>
                    <Text style={[styles.pillTxt, { color: C.a500 }]}>exercise</Text>
                  </View>
                )}
              </View>
            </View>
          );
        })}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  center:       { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: C.s50 },
  container:    { paddingBottom: 100, backgroundColor: C.s50 },

  avatarCard:   { margin: 20, borderRadius: R.card, padding: 24, alignItems: 'center' },
  avatarCircle: { width: 68, height: 68, borderRadius: 34, backgroundColor: 'rgba(255,255,255,0.22)', alignItems: 'center', justifyContent: 'center', marginBottom: 12 },
  avatarTxt:    { color: C.white, fontWeight: '800', fontSize: 24 },
  profileName:  { color: C.white, fontSize: 20, fontWeight: '800', letterSpacing: -0.4 },
  profileSub:   { color: 'rgba(255,255,255,0.65)', fontSize: 13, fontWeight: '600', marginTop: 4 },

  section: {
    marginHorizontal: 20,
    marginBottom: 16,
    backgroundColor: C.white,
    borderRadius: R.card,
    padding: 18,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 14,
  },
  sectionHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 },
  sectionTitle:  { fontSize: 15, fontWeight: '800', color: C.s700 },
  addLink:       { fontSize: 14, fontWeight: '700', color: C.t700 },

  addForm:       { marginBottom: 12 },
  input: {
    borderWidth: 1,
    borderColor: C.s200,
    borderRadius: 10,
    padding: 10,
    fontSize: 14,
    marginBottom: 8,
    backgroundColor: C.s50,
    color: C.s700,
  },
  saveBtn:       { backgroundColor: C.t700, borderRadius: 12, padding: 13, alignItems: 'center' },
  saveBtnTxt:    { color: C.white, fontWeight: '700', fontSize: 15 },

  empty:         { color: C.s400, fontSize: 13, fontWeight: '500' },

  medRow:        { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 10 },
  medIcon:       { width: 40, height: 40, borderRadius: 13, backgroundColor: C.t50, alignItems: 'center', justifyContent: 'center' },
  medName:       { fontSize: 14, fontWeight: '700', color: C.s700 },
  medTimes:      { fontSize: 12, color: C.s400, marginTop: 2 },
  removeBtn:     { color: C.r500, fontWeight: '600', fontSize: 13 },

  reminderRow:   { flexDirection: 'row', gap: 10, alignItems: 'center' },
  setBtn:        { backgroundColor: C.t700, borderRadius: 12, paddingHorizontal: 20, paddingVertical: 12 },
  setBtnTxt:     { color: C.white, fontWeight: '700', fontSize: 14 },

  dayRow:        { marginBottom: 10 },
  dateLabel:     { fontSize: 13, fontWeight: '700', color: C.s700, marginBottom: 5 },
  pills:         { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  pill:          { borderRadius: 20, paddingHorizontal: 10, paddingVertical: 3 },
  pillTxt:       { fontSize: 12, fontWeight: '600' },
});
