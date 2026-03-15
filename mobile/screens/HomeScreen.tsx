import React, { useEffect, useState, useCallback, useRef } from 'react';
import {
  View, Text, ScrollView, StyleSheet,
  RefreshControl, ActivityIndicator, TouchableOpacity, Animated,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { getDueReminders, getTodayLogs, getMedications } from '../services/api';
import { C, R } from '../theme';
import ProgressRing from '../components/ProgressRing';

function StatRow({
  label, value, sub, fillColor, fill,
}: {
  label: string; value: string; sub: string; fillColor: string; fill: number;
}) {
  const anim = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.timing(anim, { toValue: fill, duration: 1300, useNativeDriver: false }).start();
  }, [fill]);
  const width = anim.interpolate({ inputRange: [0, 100], outputRange: ['0%', '100%'] });
  return (
    <View style={styles.statRow}>
      <Text style={styles.statLabel}>{label}</Text>
      <Text style={styles.statValue}>
        {value} <Text style={styles.statSub}>{sub}</Text>
      </Text>
      <View style={styles.barTrack}>
        <Animated.View style={[styles.barFill, { backgroundColor: fillColor, width }]} />
      </View>
    </View>
  );
}

function QuickStat({ icon, value, label }: { icon: string; value: string; label: string }) {
  return (
    <View style={styles.qCard}>
      <Text style={{ fontSize: 22 }}>{icon}</Text>
      <Text style={styles.qValue}>{value}</Text>
      <Text style={styles.qLabel}>{label}</Text>
    </View>
  );
}

export default function HomeScreen() {
  const [overdue, setOverdue]       = useState<any[]>([]);
  const [logs, setLogs]             = useState<any[]>([]);
  const [meds, setMeds]             = useState<any[]>([]);
  const [loading, setLoading]       = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const blink = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    const anim = Animated.loop(
      Animated.sequence([
        Animated.timing(blink, { toValue: 0.25, duration: 1250, useNativeDriver: true }),
        Animated.timing(blink, { toValue: 1,    duration: 1250, useNativeDriver: true }),
      ])
    );
    anim.start();
    return () => anim.stop();
  }, []);

  const load = useCallback(async () => {
    try {
      const [remRes, logsRes, medsRes] = await Promise.all([
        getDueReminders(), getTodayLogs(), getMedications(),
      ]);
      setOverdue(remRes.data);
      setLogs(logsRes.data);
      setMeds(medsRes.data);
    } catch {
      // backend unreachable
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);
  const onRefresh = () => { setRefreshing(true); load(); };

  const totalMedSlots  = meds.reduce((acc: number, m: any) => acc + (m.times?.length ?? 1), 0);
  const takenMeds      = logs.filter((l: any) => l.type === 'medicine').length;
  const walkedToday    = logs.some((l: any) => l.type === 'walk');
  const exercisedToday = logs.some((l: any) => l.type === 'exercise');

  const pct = Math.min(100, Math.round(
    (totalMedSlots > 0 ? (takenMeds / totalMedSlots) * 67 : 0) +
    (walkedToday    ? 20 : 0) +
    (exercisedToday ? 13 : 0)
  ));

  const greeting = () => {
    const h = new Date().getHours();
    if (h < 12) return 'GOOD MORNING';
    if (h < 17) return 'GOOD AFTERNOON';
    return 'GOOD EVENING';
  };

  const aiText = totalMedSlots > 0
    ? `You've taken ${takenMeds} of ${totalMedSlots} medication${totalMedSlots > 1 ? 's' : ''} today.${!walkedToday ? ' Your morning walk is still due — just 20 min keeps glucose stable.' : ' Great job staying on track!'}`
    : 'Welcome back! Set up your medications in Profile to get personalised health insights.';

  const chips: string[] = [`${pct}% On Track`];
  if (!walkedToday) chips.push('Walk Due');
  if (overdue.length > 0) chips.push(`${overdue.length} Med${overdue.length > 1 ? 's' : ''} Left`);

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color={C.t500} />
      </View>
    );
  }

  return (
    <ScrollView
      contentContainerStyle={styles.container}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={C.t500} />}
      showsVerticalScrollIndicator={false}
    >
      {/* ── Header ── */}
      <View style={styles.header}>
        <View>
          <Text style={styles.greetLabel}>{greeting()}</Text>
          <Text style={styles.greetName}>Margaret 👋</Text>
        </View>
        <LinearGradient colors={[C.t500, C.i500]} style={styles.avatar} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}>
          <Text style={styles.avatarTxt}>MG</Text>
        </LinearGradient>
      </View>

      {/* ── AI Intelligence Card ── */}
      <LinearGradient
        colors={['#0a6259', '#4a4de3']}
        style={styles.aiCard}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 0.9 }}
      >
        <View style={styles.aiLabelRow}>
          <Animated.View style={[styles.aiDot, { opacity: blink }]} />
          <Text style={styles.aiLabel}>AI HEALTH SUMMARY</Text>
        </View>
        <Text style={styles.aiText}>{aiText}</Text>
        <View style={styles.chipRow}>
          {chips.map((c, i) => (
            <View key={c} style={[styles.aiChip, i === 0 && styles.aiChipGreen]}>
              <Text style={[styles.aiChipTxt, i === 0 && styles.aiChipTxtGreen]}>{c}</Text>
            </View>
          ))}
        </View>
      </LinearGradient>

      {/* ── Progress Ring Card ── */}
      <View style={styles.ringCard}>
        <ProgressRing percent={pct} size={110} />
        <View style={styles.statsCol}>
          <StatRow label="Steps"       value="3,240"          sub="/ 8k"                                  fillColor={C.t500} fill={40} />
          <StatRow label="Medications" value={String(takenMeds)} sub={`/ ${Math.max(totalMedSlots, 1)} taken`} fillColor={C.i500} fill={totalMedSlots > 0 ? Math.round((takenMeds / totalMedSlots) * 100) : 0} />
          <StatRow label="Calories"    value="1,420"          sub="kcal"                                  fillColor={C.a500} fill={71} />
        </View>
      </View>

      {/* ── Quick Stats ── */}
      <View style={styles.quickRow}>
        <QuickStat icon="💊" value={`${takenMeds}/${Math.max(totalMedSlots, 1)}`} label="Meds" />
        <QuickStat icon="🚶" value={walkedToday ? '1' : '0'} label="Walks" />
        <QuickStat icon="💧" value="4/8" label="Water" />
        <QuickStat icon="😴" value="7.2h" label="Sleep" />
      </View>

      {/* ── Up Next ── */}
      {overdue.length > 0 && (
        <>
          <View style={styles.sectionRow}>
            <Text style={styles.sectionTitle}>Up Next</Text>
            <Text style={styles.sectionLink}>See All</Text>
          </View>
          {overdue.slice(0, 2).map((r: any, i: number) => (
            <View key={i} style={styles.miniTask}>
              <View style={[styles.miniIcon, { backgroundColor: C.t50 }]}>
                <Text style={{ fontSize: 18 }}>💊</Text>
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.miniName}>{r.name} {r.dose}</Text>
                <Text style={styles.miniTime}>Due {r.time}</Text>
              </View>
              <TouchableOpacity style={styles.miniBtn} activeOpacity={0.8}>
                <Text style={styles.miniBtnTxt}>Log</Text>
              </TouchableOpacity>
            </View>
          ))}
        </>
      )}

      {overdue.length === 0 && (
        <View style={styles.allDone}>
          <Text style={styles.allDoneTxt}>All caught up for now! 🎉</Text>
        </View>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  center:         { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: C.s50 },
  container:      { paddingBottom: 100, backgroundColor: C.s50 },

  header:         { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 20, paddingTop: 16, paddingBottom: 4 },
  greetLabel:     { fontSize: 11, color: C.s400, fontWeight: '700', letterSpacing: 0.3, marginBottom: 2 },
  greetName:      { fontSize: 20, fontWeight: '800', color: C.s700, letterSpacing: -0.4 },
  avatar:         { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center' },
  avatarTxt:      { color: C.white, fontWeight: '800', fontSize: 17, letterSpacing: -0.3 },

  aiCard:         { marginHorizontal: 20, marginTop: 14, borderRadius: R.card, padding: 18 },
  aiLabelRow:     { flexDirection: 'row', alignItems: 'center', gap: 7, marginBottom: 10 },
  aiDot:          { width: 7, height: 7, borderRadius: 4, backgroundColor: C.t300 },
  aiLabel:        { fontSize: 9.5, fontWeight: '700', color: 'rgba(255,255,255,0.6)', textTransform: 'uppercase', letterSpacing: 1.3 },
  aiText:         { fontSize: 14, fontWeight: '600', color: '#fff', lineHeight: 22 },
  chipRow:        { flexDirection: 'row', gap: 7, marginTop: 14, flexWrap: 'wrap' },
  aiChip:         { backgroundColor: 'rgba(255,255,255,0.13)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.17)', borderRadius: 20, paddingHorizontal: 11, paddingVertical: 4 },
  aiChipTxt:      { fontSize: 10.5, fontWeight: '700', color: 'rgba(255,255,255,0.88)' },
  aiChipGreen:    { backgroundColor: 'rgba(94,234,212,0.18)', borderColor: 'rgba(94,234,212,0.28)' },
  aiChipTxtGreen: { color: C.t300 },

  ringCard:       { marginHorizontal: 20, marginTop: 12, backgroundColor: C.white, borderRadius: R.card, padding: 18, flexDirection: 'row', alignItems: 'center', gap: 18, elevation: 2, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.06, shadowRadius: 14 },
  statsCol:       { flex: 1 },
  statRow:        { marginBottom: 10 },
  statLabel:      { fontSize: 9.5, fontWeight: '700', color: C.s400, textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 2 },
  statValue:      { fontSize: 18, fontWeight: '800', color: C.s700, letterSpacing: -0.4 },
  statSub:        { fontSize: 11, fontWeight: '600', color: C.s400 },
  barTrack:       { height: 4, backgroundColor: C.s100, borderRadius: 2, marginTop: 4, overflow: 'hidden' },
  barFill:        { height: 4, borderRadius: 2 },

  quickRow:       { flexDirection: 'row', gap: 8, marginHorizontal: 20, marginTop: 12 },
  qCard:          { flex: 1, backgroundColor: C.white, borderRadius: 18, paddingVertical: 13, paddingHorizontal: 8, alignItems: 'center', elevation: 1, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.05, shadowRadius: 8 },
  qValue:         { fontSize: 15, fontWeight: '800', color: C.s700, marginTop: 3, letterSpacing: -0.3 },
  qLabel:         { fontSize: 9, fontWeight: '700', color: C.s400, textTransform: 'uppercase', letterSpacing: 0.4, marginTop: 1 },

  sectionRow:     { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 20, paddingTop: 16, paddingBottom: 8 },
  sectionTitle:   { fontSize: 13, fontWeight: '800', color: C.s700 },
  sectionLink:    { fontSize: 12, fontWeight: '700', color: C.t700 },

  miniTask:       { marginHorizontal: 20, marginBottom: 8, backgroundColor: C.white, borderRadius: 18, paddingVertical: 11, paddingHorizontal: 13, flexDirection: 'row', alignItems: 'center', gap: 11, elevation: 1, shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.05, shadowRadius: 6 },
  miniIcon:       { width: 38, height: 38, borderRadius: 13, alignItems: 'center', justifyContent: 'center' },
  miniName:       { fontSize: 13, fontWeight: '700', color: C.s700 },
  miniTime:       { fontSize: 11, color: C.s400, fontWeight: '600' },
  miniBtn:        { backgroundColor: C.t700, borderRadius: 11, paddingHorizontal: 13, paddingVertical: 7 },
  miniBtnTxt:     { color: C.white, fontSize: 12, fontWeight: '700' },

  allDone:        { marginHorizontal: 20, marginTop: 16, backgroundColor: C.t50, borderRadius: 18, padding: 16, alignItems: 'center', borderWidth: 1, borderColor: C.t100 },
  allDoneTxt:     { fontSize: 14, fontWeight: '600', color: C.t700 },
});
