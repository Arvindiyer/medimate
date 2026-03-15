import React, { useState, useCallback } from 'react';
import {
  View, Text, ScrollView, StyleSheet, TouchableOpacity,
  RefreshControl, ActivityIndicator, Alert,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useFocusEffect } from '@react-navigation/native';
import { getMedications, getTodayLogs, logActivity } from '../services/api';
import { C } from '../theme';

type TaskStatus = 'taken' | 'missed' | 'due' | 'upcoming';

interface Task {
  id: string;
  name: string;
  note: string;
  time: string;
  emoji: string;
  status: TaskStatus;
  medId?: number;
  type: 'medicine' | 'walk' | 'exercise';
}

function getStatus(timeStr: string, done: boolean): TaskStatus {
  if (done) return 'taken';
  const [h, m] = timeStr.split(':').map(Number);
  const now    = new Date();
  const sched  = new Date();
  sched.setHours(h, m, 0, 0);
  const diffMin = (sched.getTime() - now.getTime()) / 60000;
  if (diffMin < -5)   return 'missed';
  if (diffMin <= 120) return 'due';
  return 'upcoming';
}

const STATUS_COLOR: Record<TaskStatus, string> = {
  taken: '#16A34A', missed: C.r500, due: C.t700, upcoming: C.s400,
};
const STATUS_LABEL: Record<TaskStatus, string> = {
  taken: 'Taken', missed: 'Missed', due: 'Due', upcoming: 'Upcoming',
};
const STATUS_BG: Record<TaskStatus, string> = {
  taken: '#DCFCE7', missed: C.r50, due: C.t100, upcoming: C.s100,
};
const BAR_COLOR: Record<TaskStatus, string> = {
  taken: C.t500, missed: C.r500, due: C.t500, upcoming: C.s200,
};
const ICON_BG: Record<TaskStatus, string> = {
  taken: C.t50, missed: '#FEE2E2', due: C.i50, upcoming: C.s100,
};

function TaskCard({
  task, logging, onLog,
}: { task: Task; logging: boolean; onLog: () => void }) {
  const isMissed = task.status === 'missed';
  const isTaken  = task.status === 'taken';
  const isDue    = task.status === 'due';

  return (
    <View style={[styles.card, isMissed && styles.cardMissed, isTaken && styles.cardTaken]}>
      <View style={[styles.accentBar, { backgroundColor: BAR_COLOR[task.status] }]} />
      <View style={[styles.iconChip, { backgroundColor: ICON_BG[task.status] }]}>
        <Text style={{ fontSize: 20 }}>{task.emoji}</Text>
      </View>
      <View style={{ flex: 1 }}>
        <Text style={styles.taskName}>{task.name}</Text>
        <Text style={styles.taskNote}>{task.note}</Text>
        <View style={[styles.badge, { backgroundColor: STATUS_BG[task.status] }]}>
          <Text style={[styles.badgeTxt, { color: STATUS_COLOR[task.status] }]}>
            {STATUS_LABEL[task.status]}
          </Text>
        </View>
      </View>
      <View style={styles.action}>
        {logging ? (
          <ActivityIndicator color={C.t500} size="small" />
        ) : isTaken ? (
          <View style={styles.checkCircle}>
            <Text style={{ color: '#16A34A', fontSize: 16, fontWeight: '700' }}>✓</Text>
          </View>
        ) : isMissed ? (
          <TouchableOpacity style={styles.missedBtn} onPress={onLog} activeOpacity={0.8}>
            <Text style={styles.missedBtnTxt}>Log Now</Text>
          </TouchableOpacity>
        ) : isDue ? (
          <TouchableOpacity style={styles.markBtn} onPress={onLog} activeOpacity={0.8}>
            <Text style={styles.markBtnTxt}>✓ Mark</Text>
          </TouchableOpacity>
        ) : (
          <View style={styles.clockCircle}>
            <Text style={{ fontSize: 16 }}>🕐</Text>
          </View>
        )}
      </View>
    </View>
  );
}

export default function TimelineScreen() {
  const [tasks, setTasks]           = useState<Task[]>([]);
  const [loading, setLoading]       = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [logging, setLogging]       = useState<string | null>(null);

  const build = useCallback(async () => {
    try {
      const [medsRes, logsRes] = await Promise.all([getMedications(), getTodayLogs()]);
      const meds: any[]     = medsRes.data ?? [];
      const todayLogs: any[] = logsRes.data ?? [];

      const takenMedIds  = new Set(todayLogs.filter((l: any) => l.type === 'medicine').map((l: any) => l.med_id));
      const walkedToday  = todayLogs.some((l: any) => l.type === 'walk');
      const exercisedToday = todayLogs.some((l: any) => l.type === 'exercise');

      const built: Task[] = [];

      // One task per medication × scheduled time
      for (const med of meds) {
        const times: string[] = med.times ?? [];
        for (const t of times) {
          built.push({
            id:    `med-${med.id}-${t}`,
            name:  `${med.name} ${med.dose}`,
            note:  `${t} · With water`,
            time:  t,
            emoji: '💊',
            status: getStatus(t, takenMedIds.has(med.id)),
            medId: med.id,
            type:  'medicine',
          });
        }
      }

      // Walk
      built.push({
        id:    'walk-1',
        name:  'Morning Walk',
        note:  '10:00 · 20 min target',
        time:  '10:00',
        emoji: '🚶',
        status: getStatus('10:00', walkedToday),
        type:  'walk',
      });

      // Stretching
      built.push({
        id:    'stretch-1',
        name:  'Stretching',
        note:  '14:00 · 15 min session',
        time:  '14:00',
        emoji: '🧘',
        status: getStatus('14:00', exercisedToday),
        type:  'exercise',
      });

      built.sort((a, b) => a.time.localeCompare(b.time));
      setTasks(built);
    } catch {
      // backend unreachable
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useFocusEffect(useCallback(() => { build(); }, [build]));
  const onRefresh = () => { setRefreshing(true); build(); };

  const doLog = async (task: Task, note?: string) => {
    setLogging(task.id);
    try {
      if (task.type === 'medicine') {
        await logActivity('medicine', task.medId, `Took ${task.name}`);
      } else if (task.type === 'walk') {
        await logActivity('walk', undefined, note ?? '20 minutes');
      } else {
        await logActivity('exercise', undefined, task.name);
      }
      build();
    } finally {
      setLogging(null);
    }
  };

  const handleLog = (task: Task) => {
    if (task.status === 'taken') return;
    if (task.type === 'walk') {
      Alert.alert('Log Walk', 'How many minutes?', [
        { text: '15 min', onPress: () => doLog(task, '15 minutes') },
        { text: '20 min', onPress: () => doLog(task, '20 minutes') },
        { text: '30 min', onPress: () => doLog(task, '30 minutes') },
        { text: 'Cancel', style: 'cancel' },
      ]);
      return;
    }
    doLog(task);
  };

  const taken = tasks.filter(t => t.status === 'taken').length;
  const total = tasks.length;
  const progress = total > 0 ? taken / total : 0;

  if (loading) {
    return <View style={styles.center}><ActivityIndicator size="large" color={C.t500} /></View>;
  }

  return (
    <ScrollView
      contentContainerStyle={styles.container}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={C.t500} />}
      showsVerticalScrollIndicator={false}
    >
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.title}>Today's Plan</Text>
        <Text style={styles.subtitle}>
          {new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })}
        </Text>
      </View>

      {/* Progress bar */}
      <View style={styles.progWrap}>
        <View style={styles.progTrack}>
          <LinearGradient
            colors={[C.t700, C.t500]}
            style={[styles.progFill, { width: `${Math.round(progress * 100)}%` }]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
          />
        </View>
        <Text style={styles.progTxt}>{taken} of {total} done</Text>
      </View>

      {/* Task list */}
      <View style={styles.list}>
        {tasks.map(task => (
          <TaskCard
            key={task.id}
            task={task}
            logging={logging === task.id}
            onLog={() => handleLog(task)}
          />
        ))}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  center:      { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: C.s50 },
  container:   { paddingBottom: 100, backgroundColor: C.s50 },

  header:      { paddingHorizontal: 20, paddingTop: 20, paddingBottom: 0 },
  title:       { fontSize: 22, fontWeight: '800', color: C.s700, letterSpacing: -0.5 },
  subtitle:    { fontSize: 13, color: C.s400, fontWeight: '600', marginTop: 2 },

  progWrap:    { flexDirection: 'row', alignItems: 'center', gap: 11, marginHorizontal: 20, marginVertical: 12, backgroundColor: C.t50, borderRadius: 16, padding: 12, paddingHorizontal: 14, borderWidth: 1, borderColor: C.t100 },
  progTrack:   { flex: 1, height: 6, backgroundColor: C.t100, borderRadius: 3, overflow: 'hidden' },
  progFill:    { height: 6, borderRadius: 3 },
  progTxt:     { fontSize: 12, fontWeight: '700', color: C.t700 },

  list:        { paddingHorizontal: 20, gap: 10 },

  // Task card
  card: {
    backgroundColor: C.white,
    borderRadius: 20,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 10,
    overflow: 'hidden',
    paddingVertical: 13,
    paddingRight: 13,
  },
  cardMissed:  { backgroundColor: C.r50 },
  cardTaken:   { opacity: 0.58 },

  accentBar:   { position: 'absolute', left: 0, top: 0, bottom: 0, width: 4 },
  iconChip:    { width: 44, height: 44, borderRadius: 14, alignItems: 'center', justifyContent: 'center', marginLeft: 17 },
  taskName:    { fontSize: 14, fontWeight: '700', color: C.s700 },
  taskNote:    { fontSize: 11, color: C.s400, fontWeight: '600', marginTop: 1 },
  badge:       { alignSelf: 'flex-start', marginTop: 4, borderRadius: 20, paddingHorizontal: 8, paddingVertical: 2 },
  badgeTxt:    { fontSize: 9, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.6 },

  action:      { flexShrink: 0 },
  checkCircle: { width: 42, height: 42, borderRadius: 13, backgroundColor: '#DCFCE7', alignItems: 'center', justifyContent: 'center' },
  missedBtn:   { borderWidth: 1.5, borderColor: '#FCA5A5', borderRadius: 13, paddingHorizontal: 11, paddingVertical: 9 },
  missedBtnTxt:{ fontSize: 11, fontWeight: '700', color: C.r500 },
  markBtn:     { backgroundColor: C.t700, borderRadius: 13, paddingHorizontal: 13, paddingVertical: 9 },
  markBtnTxt:  { color: C.white, fontSize: 12, fontWeight: '700' },
  clockCircle: { width: 42, height: 42, borderRadius: 13, borderWidth: 1.5, borderColor: C.s200, alignItems: 'center', justifyContent: 'center' },
});
