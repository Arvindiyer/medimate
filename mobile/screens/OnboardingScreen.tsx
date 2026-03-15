import React, { useState } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet,
  KeyboardAvoidingView, Platform, ScrollView, ActivityIndicator, Alert,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { C } from '../theme';
import { createUser, listUsers } from '../services/api';
import { setUser } from '../services/storage';

interface Props {
  onComplete: () => void;
}

export default function OnboardingScreen({ onComplete }: Props) {
  const [tab, setTab]                   = useState<'new' | 'existing'>('new');
  const [name, setName]                 = useState('');
  const [age, setAge]                   = useState('');
  const [caregiverEmail, setCaregiverEmail] = useState('');
  const [loading, setLoading]           = useState(false);
  const [existingUsers, setExistingUsers] = useState<any[]>([]);
  const [loadingExisting, setLoadingExisting] = useState(false);

  const loadExisting = async () => {
    setLoadingExisting(true);
    try {
      const resp = await listUsers();
      setExistingUsers(resp.data);
    } catch {
      Alert.alert('Error', 'Could not reach the server. Make sure the backend is running.');
    } finally {
      setLoadingExisting(false);
    }
  };

  const handleTabChange = (t: 'new' | 'existing') => {
    setTab(t);
    if (t === 'existing' && existingUsers.length === 0) loadExisting();
  };

  const handleCreate = async () => {
    if (!name.trim()) {
      Alert.alert('Name required', 'Please enter your name to continue.');
      return;
    }
    setLoading(true);
    try {
      const resp = await createUser(
        name.trim(),
        age ? parseInt(age, 10) : undefined,
        caregiverEmail.trim() || undefined,
      );
      setUser(resp.data.id, resp.data.name, resp.data.caregiver_email ?? '');
      onComplete();
    } catch {
      Alert.alert('Error', 'Could not create profile. Make sure the backend is running.');
    } finally {
      setLoading(false);
    }
  };

  const handleSelectExisting = (user: any) => {
    setUser(user.id, user.name, user.caregiver_email ?? '');
    onComplete();
  };

  return (
    <KeyboardAvoidingView
      style={{ flex: 1 }}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <LinearGradient colors={[C.t700, C.i500]} style={styles.header}>
        <Text style={styles.appName}>MediMate</Text>
        <Text style={styles.tagline}>Your personal health companion</Text>
      </LinearGradient>

      <ScrollView style={styles.body} contentContainerStyle={{ paddingBottom: 40 }} keyboardShouldPersistTaps="handled">

        {/* Tab switcher */}
        <View style={styles.tabs}>
          <TouchableOpacity
            style={[styles.tab, tab === 'new' && styles.tabActive]}
            onPress={() => handleTabChange('new')}
          >
            <Text style={[styles.tabTxt, tab === 'new' && styles.tabTxtActive]}>New Profile</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.tab, tab === 'existing' && styles.tabActive]}
            onPress={() => handleTabChange('existing')}
          >
            <Text style={[styles.tabTxt, tab === 'existing' && styles.tabTxtActive]}>Continue As</Text>
          </TouchableOpacity>
        </View>

        {tab === 'new' ? (
          <View style={styles.card}>
            <Text style={styles.sectionTitle}>Tell us about yourself</Text>

            <Text style={styles.label}>Your Name *</Text>
            <TextInput
              style={styles.input}
              placeholder="e.g. John Doe"
              placeholderTextColor={C.s400}
              value={name}
              onChangeText={setName}
              autoCapitalize="words"
            />

            <Text style={styles.label}>Age</Text>
            <TextInput
              style={styles.input}
              placeholder="e.g. 72"
              placeholderTextColor={C.s400}
              value={age}
              onChangeText={setAge}
              keyboardType="number-pad"
            />

            <Text style={styles.label}>Caregiver Email</Text>
            <Text style={styles.hint}>We'll send health alerts here if you miss medications</Text>
            <TextInput
              style={styles.input}
              placeholder="caregiver@example.com"
              placeholderTextColor={C.s400}
              value={caregiverEmail}
              onChangeText={setCaregiverEmail}
              keyboardType="email-address"
              autoCapitalize="none"
            />

            <TouchableOpacity
              style={[styles.btn, loading && styles.btnDisabled]}
              onPress={handleCreate}
              disabled={loading}
              activeOpacity={0.85}
            >
              {loading
                ? <ActivityIndicator color="#fff" />
                : <Text style={styles.btnTxt}>Get Started →</Text>
              }
            </TouchableOpacity>
          </View>
        ) : (
          <View style={styles.card}>
            <Text style={styles.sectionTitle}>Select your profile</Text>
            {loadingExisting
              ? <ActivityIndicator color={C.t500} style={{ marginTop: 24 }} />
              : existingUsers.length === 0
              ? (
                <View style={styles.emptyState}>
                  <Text style={styles.emptyTxt}>No profiles found.</Text>
                  <TouchableOpacity onPress={() => setTab('new')}>
                    <Text style={styles.emptyLink}>Create a new profile →</Text>
                  </TouchableOpacity>
                </View>
              )
              : existingUsers.map(u => (
                <TouchableOpacity
                  key={u.id}
                  style={styles.userRow}
                  onPress={() => handleSelectExisting(u)}
                  activeOpacity={0.75}
                >
                  <View style={styles.avatar}>
                    <Text style={styles.avatarTxt}>{u.name[0].toUpperCase()}</Text>
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.userName}>{u.name}</Text>
                    {u.age && <Text style={styles.userAge}>Age {u.age}</Text>}
                  </View>
                  <Text style={styles.chevron}>›</Text>
                </TouchableOpacity>
              ))
            }
          </View>
        )}
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  header: {
    paddingTop: Platform.OS === 'ios' ? 72 : 52,
    paddingBottom: 36,
    paddingHorizontal: 24,
    alignItems: 'center',
  },
  appName:  { fontSize: 34, fontWeight: '900', color: '#fff', letterSpacing: -1 },
  tagline:  { fontSize: 15, color: 'rgba(255,255,255,0.75)', marginTop: 6, fontWeight: '500' },

  body: { flex: 1, backgroundColor: C.s50 },

  tabs: {
    flexDirection: 'row',
    margin: 20,
    backgroundColor: C.s100,
    borderRadius: 12,
    padding: 4,
  },
  tab: {
    flex: 1, paddingVertical: 10, borderRadius: 10, alignItems: 'center',
  },
  tabActive:    { backgroundColor: '#fff', shadowColor: '#000', shadowOpacity: 0.07, shadowRadius: 4, elevation: 2 },
  tabTxt:       { fontSize: 14, fontWeight: '600', color: C.s400 },
  tabTxtActive: { color: C.t700 },

  card: {
    marginHorizontal: 20,
    backgroundColor: '#fff',
    borderRadius: 20,
    padding: 20,
    shadowColor: '#000',
    shadowOpacity: 0.06,
    shadowRadius: 12,
    elevation: 3,
  },
  sectionTitle: { fontSize: 18, fontWeight: '800', color: C.s700, marginBottom: 20 },

  label: { fontSize: 13, fontWeight: '700', color: C.s600, marginBottom: 6, marginTop: 14 },
  hint:  { fontSize: 11, color: C.s400, marginBottom: 6, marginTop: -4 },
  input: {
    borderWidth: 1, borderColor: C.s200, borderRadius: 12,
    paddingHorizontal: 14, paddingVertical: 12,
    fontSize: 15, color: C.s700, backgroundColor: C.s50,
  },

  btn: {
    marginTop: 24, backgroundColor: C.t700,
    borderRadius: 14, paddingVertical: 15, alignItems: 'center',
  },
  btnDisabled: { opacity: 0.6 },
  btnTxt: { fontSize: 16, fontWeight: '800', color: '#fff' },

  emptyState: { alignItems: 'center', paddingVertical: 24 },
  emptyTxt:   { fontSize: 14, color: C.s400 },
  emptyLink:  { fontSize: 14, color: C.t700, fontWeight: '700', marginTop: 8 },

  userRow: {
    flexDirection: 'row', alignItems: 'center', gap: 14,
    paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: C.s100,
  },
  avatar: {
    width: 44, height: 44, borderRadius: 22,
    backgroundColor: C.t100, alignItems: 'center', justifyContent: 'center',
  },
  avatarTxt: { fontSize: 18, fontWeight: '800', color: C.t700 },
  userName:  { fontSize: 16, fontWeight: '700', color: C.s700 },
  userAge:   { fontSize: 12, color: C.s400, marginTop: 2 },
  chevron:   { fontSize: 22, color: C.s300, fontWeight: '300' },
});
