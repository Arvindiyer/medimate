import React, { useCallback, useState, useContext } from 'react';
import {
  View, Text, ScrollView, StyleSheet,
  RefreshControl, ActivityIndicator, TouchableOpacity,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useFocusEffect } from '@react-navigation/native';
import { getDueReminders, getTodayLogs, getMedications, getUser } from '../services/api';
import { getUserId, getUserName } from '../services/storage';
import { VoiceContext } from '../VoiceContext';
import { C, R } from '../theme';

export default function HomeScreen() {
  const [overdue, setOverdue]       = useState<any[]>([]);
  const [logs, setLogs]             = useState<any[]>([]);
  const [meds, setMeds]             = useState<any[]>([]);
  const [user, setUser]             = useState<any>(null);
  const [loading, setLoading]       = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const openVoice = useContext(VoiceContext);

  const load = useCallback(async () => {
    try {
      const uid = getUserId();
      const [remRes, logsRes, medsRes, userRes] = await Promise.all([
        getDueReminders(), getTodayLogs(), getMedications(), getUser(uid),
      ]);
      setOverdue(remRes.data ?? []);
      setLogs(logsRes.data ?? []);
      setMeds(medsRes.data ?? []);
      setUser(userRes.data ?? null);
    } catch {
      // backend unreachable
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  // Refresh whenever this tab comes into focus
  useFocusEffect(useCallback(() => { load(); }, [load]));

  const onRefresh = () => { setRefreshing(true); load(); };

  const totalMedSlots = meds.reduce((acc: number, m: any) => acc + (m.times?.length ?? 1), 0);
  const takenMeds     = logs.filter((l: any) => l.type === 'medicine').length;
  const walkedToday   = logs.some((l: any) => l.type === 'walk');
  const pct = Math.min(100, Math.round(
    (totalMedSlots > 0 ? (takenMeds / totalMedSlots) * 70 : 0) +
    (walkedToday ? 20 : 0)
  ));

  const hour = new Date().getHours();
  const greeting = hour < 12 ? 'Good Morning' : hour < 17 ? 'Good Afternoon' : 'Good Evening';
  const firstName = (user?.name ?? getUserName() ?? 'there').split(' ')[0];

  const aiText = totalMedSlots > 0
    ? `You've taken ${takenMeds} of ${totalMedSlots} medication${totalMedSlots !== 1 ? 's' : ''} today.${
        !walkedToday ? " Your daily walk is still due — just 20 minutes helps!" : " Great job staying active!"
      }`
    : 'Set up your medications in Profile to get personalised health insights.';

  if (loading) {
    return <View style={styles.center}><ActivityIndicator size="large" color={C.t500} /></View>;
  }

  return (
    <ScrollView
      contentContainerStyle={styles.container}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={C.t500} />}
      showsVerticalScrollIndicator={false}
    >
      {/* ── Greeting ── */}
      <View style={styles.header}>
        <Text style={styles.greetLabel}>{greeting} 👋</Text>
        <Text style={styles.greetName}>{firstName}</Text>
      </View>

      {/* ── Health Summary card ── */}
      <LinearGradient
        colors={['#0a6259', '#4a4de3']}
        style={styles.summaryCard}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 0.9 }}
      >
        <Text style={styles.summaryLabel}>HEALTH SUMMARY</Text>
        <Text style={styles.summaryText}>{aiText}</Text>
        <View style={styles.chipRow}>
          <View style={[styles.chip, styles.chipGreen]}>
            <Text style={[styles.chipTxt, styles.chipTxtGreen]}>{pct}% On Track</Text>
          </View>
          {!walkedToday && (
            <View style={styles.chip}><Text style={styles.chipTxt}>Walk Due</Text></View>
          )}
          {overdue.length > 0 && (
            <View style={styles.chip}>
              <Text style={styles.chipTxt}>{overdue.length} Med{overdue.length > 1 ? 's' : ''} Left</Text>
            </View>
          )}
        </View>
      </LinearGradient>

      {/* ── Voice CTA ── */}
      <TouchableOpacity style={styles.voiceCard} onPress={openVoice} activeOpacity={0.85}>
        <LinearGradient
          colors={[C.t500, C.i500]}
          style={styles.voiceCircle}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
        >
          <Text style={styles.voiceIcon}>🎤</Text>
        </LinearGradient>
        <View style={{ flex: 1 }}>
          <Text style={styles.voiceTitle}>Speak to MediMate</Text>
          <Text style={styles.voiceSub}>Log meds, ask questions, get food suggestions</Text>
        </View>
        <Text style={styles.voiceArrow}>›</Text>
      </TouchableOpacity>

      {/* ── Pending meds ── */}
      {overdue.length > 0 && (
        <>
          <Text style={styles.sectionTitle}>Up Next</Text>
          {overdue.slice(0, 3).map((r: any, i: number) => (
            <View key={i} style={styles.medCard}>
              <View style={styles.medIcon}><Text style={{ fontSize: 20 }}>💊</Text></View>
              <View style={{ flex: 1 }}>
                <Text style={styles.medName}>{r.name} {r.dose}</Text>
                <Text style={styles.medTime}>Due {r.time}</Text>
              </View>
              <TouchableOpacity style={styles.voiceLogBtn} onPress={openVoice} activeOpacity={0.8}>
                <Text style={styles.voiceLogTxt}>🎤 Log</Text>
              </TouchableOpacity>
            </View>
          ))}
        </>
      )}

      {/* Only show "all done" if every scheduled slot has been taken */}
      {meds.length > 0 && totalMedSlots > 0 && takenMeds >= totalMedSlots && (
        <View style={styles.allDone}>
          <Text style={styles.allDoneTxt}>All medications taken today 🎉</Text>
        </View>
      )}

      {/* Spacer above tab bar */}
      <View style={{ height: 30 }} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  center:       { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: C.s50 },
  container:    { paddingBottom: 20, backgroundColor: C.s50 },

  header:       { paddingHorizontal: 22, paddingTop: 20, paddingBottom: 6 },
  greetLabel:   { fontSize: 22, fontWeight: '800', color: C.s700, letterSpacing: -0.3 },
  greetName:    { fontSize: 30, fontWeight: '900', color: C.t700, letterSpacing: -0.8, marginTop: 2 },

  summaryCard:  { marginHorizontal: 20, marginTop: 16, borderRadius: R.card, padding: 20 },
  summaryLabel: { fontSize: 10, fontWeight: '700', color: 'rgba(255,255,255,0.55)', letterSpacing: 1.5, marginBottom: 8 },
  summaryText:  { fontSize: 15, fontWeight: '600', color: '#fff', lineHeight: 22 },
  chipRow:      { flexDirection: 'row', gap: 7, marginTop: 14, flexWrap: 'wrap' },
  chip:         { backgroundColor: 'rgba(255,255,255,0.13)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.17)', borderRadius: 20, paddingHorizontal: 11, paddingVertical: 4 },
  chipTxt:      { fontSize: 11, fontWeight: '700', color: 'rgba(255,255,255,0.88)' },
  chipGreen:    { backgroundColor: 'rgba(94,234,212,0.18)', borderColor: 'rgba(94,234,212,0.28)' },
  chipTxtGreen: { color: '#5eead4' },

  voiceCard: {
    flexDirection: 'row', alignItems: 'center', gap: 14,
    marginHorizontal: 20, marginTop: 14,
    backgroundColor: C.white, borderRadius: R.card, padding: 16,
    elevation: 2, shadowColor: '#000', shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.07, shadowRadius: 12,
    borderWidth: 1, borderColor: C.t100,
  },
  voiceCircle: { width: 52, height: 52, borderRadius: 26, alignItems: 'center', justifyContent: 'center' },
  voiceIcon:   { fontSize: 22 },
  voiceTitle:  { fontSize: 15, fontWeight: '800', color: C.s700 },
  voiceSub:    { fontSize: 12, color: C.s400, fontWeight: '500', marginTop: 2 },
  voiceArrow:  { fontSize: 24, color: C.s400, fontWeight: '300' },

  sectionTitle: { fontSize: 13, fontWeight: '800', color: C.s700, marginTop: 18, marginBottom: 8, marginHorizontal: 22 },

  medCard: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    marginHorizontal: 20, marginBottom: 8,
    backgroundColor: C.white, borderRadius: 18,
    paddingVertical: 12, paddingHorizontal: 14,
    elevation: 1, shadowColor: '#000', shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05, shadowRadius: 6,
  },
  medIcon:    { width: 40, height: 40, borderRadius: 13, backgroundColor: C.t50, alignItems: 'center', justifyContent: 'center' },
  medName:    { fontSize: 14, fontWeight: '700', color: C.s700 },
  medTime:    { fontSize: 11, color: C.s400, fontWeight: '600', marginTop: 1 },
  voiceLogBtn:{ backgroundColor: C.t50, borderRadius: 10, paddingHorizontal: 10, paddingVertical: 6, borderWidth: 1, borderColor: C.t100 },
  voiceLogTxt:{ color: C.t700, fontSize: 12, fontWeight: '700' },

  allDone:    { marginHorizontal: 20, marginTop: 14, backgroundColor: C.t50, borderRadius: 18, padding: 16, alignItems: 'center', borderWidth: 1, borderColor: C.t100 },
  allDoneTxt: { fontSize: 14, fontWeight: '600', color: C.t700 },
});
