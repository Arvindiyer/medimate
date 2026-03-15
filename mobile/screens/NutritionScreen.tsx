import React, { useEffect, useState, useCallback } from 'react';
import {
  View, Text, ScrollView, StyleSheet,
  RefreshControl, ActivityIndicator,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { getFoodRec } from '../services/api';
import { C } from '../theme';
import FoodCard, { FoodRec } from '../components/FoodCard';

const FALLBACK_CONTEXT = 'Based on your medications and today\'s activity, here are personalised meal recommendations.';

const FALLBACK_RECS: FoodRec[] = [
  {
    emoji: '🥗',
    name: 'Greek Yogurt & Berry Bowl',
    description: 'Probiotic-rich, low glycemic',
    macros: { protein: '18g', carbs: '24g', fats: '6g' },
    why: 'Metformin works best with low-sugar, high-protein foods. Greek yogurt\'s probiotics also support gut health with long-term metformin use.',
  },
  {
    emoji: '🐟',
    name: 'Grilled Salmon & Quinoa',
    description: 'Omega-3 rich · ideal for lunch or dinner',
    macros: { protein: '34g', carbs: '38g', fats: '14g' },
    why: 'Omega-3s from salmon help reduce inflammation. Quinoa provides slow-release energy without spiking blood glucose.',
  },
];

export default function NutritionScreen() {
  const [context, setContext]       = useState('');
  const [recs, setRecs]             = useState<FoodRec[]>([]);
  const [loading, setLoading]       = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    try {
      const res  = await getFoodRec();
      const data = res.data;

      if (data?.recommendations?.length) {
        setContext(data.context ?? FALLBACK_CONTEXT);
        setRecs(data.recommendations);
      } else {
        // Legacy plain-text response — show fallback cards
        setContext(data?.recommendation ?? FALLBACK_CONTEXT);
        setRecs(FALLBACK_RECS);
      }
    } catch {
      setContext('Unable to reach server. Showing example recommendations.');
      setRecs(FALLBACK_RECS);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);
  const onRefresh = () => { setRefreshing(true); load(); };

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
        <Text style={styles.title}>AI Nutritionist</Text>
        <Text style={styles.subtitle}>Personalized for today's activity</Text>
      </View>

      {/* AI context box */}
      <LinearGradient
        colors={[C.i50, C.t50]}
        style={styles.ctxBox}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
      >
        <Text style={styles.ctxEmoji}>🤖</Text>
        <Text style={styles.ctxText}>{context}</Text>
      </LinearGradient>

      {/* Food recommendation cards */}
      {recs.map((rec, i) => (
        <FoodCard key={i} item={rec} />
      ))}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  center:    { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: C.s50 },
  container: { paddingBottom: 100, backgroundColor: C.s50 },
  header:    { paddingHorizontal: 20, paddingTop: 20, paddingBottom: 0 },
  title:     { fontSize: 22, fontWeight: '800', color: C.s700, letterSpacing: -0.5 },
  subtitle:  { fontSize: 13, color: C.s400, fontWeight: '600', marginTop: 2 },
  ctxBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 13,
    marginHorizontal: 20,
    marginTop: 12,
    marginBottom: 14,
    borderRadius: 20,
    padding: 14,
    paddingHorizontal: 16,
    borderWidth: 1,
    borderColor: 'rgba(99,102,241,0.09)',
  },
  ctxEmoji:  { fontSize: 30 },
  ctxText:   { flex: 1, fontSize: 12, color: C.s500, fontWeight: '500', lineHeight: 19 },
});
