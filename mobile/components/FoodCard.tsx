import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { C, R } from '../theme';

export interface FoodRec {
  emoji: string;
  name: string;
  description: string;
  macros: { protein: string; carbs: string; fats: string };
  why: string;
}

export default function FoodCard({ item }: { item: FoodRec }) {
  return (
    <View style={styles.card}>
      {/* Top row */}
      <View style={styles.top}>
        <View style={styles.emojiBox}>
          <Text style={styles.emoji}>{item.emoji}</Text>
        </View>
        <View style={{ flex: 1 }}>
          <Text style={styles.name}>{item.name}</Text>
          <Text style={styles.desc}>{item.description}</Text>
        </View>
      </View>

      {/* Macro chips */}
      <View style={styles.macros}>
        <View style={[styles.chip, styles.chipProtein]}>
          <View style={[styles.dot, { backgroundColor: '#7C3AED' }]} />
          <Text style={[styles.chipTxt, { color: '#7C3AED' }]}>Protein {item.macros.protein}</Text>
        </View>
        <View style={[styles.chip, styles.chipCarbs]}>
          <View style={[styles.dot, { backgroundColor: C.t700 }]} />
          <Text style={[styles.chipTxt, { color: C.t700 }]}>Carbs {item.macros.carbs}</Text>
        </View>
        <View style={[styles.chip, styles.chipFats]}>
          <View style={[styles.dot, { backgroundColor: '#B45309' }]} />
          <Text style={[styles.chipTxt, { color: '#B45309' }]}>Fats {item.macros.fats}</Text>
        </View>
      </View>

      {/* Why this? */}
      <View style={styles.whyBox}>
        <Text style={styles.whyLabel}>✦  WHY THIS?</Text>
        <Text style={styles.whyText}>{item.why}</Text>
      </View>

      {/* Footer */}
      <View style={styles.footer}>
        <TouchableOpacity style={styles.addBtn} activeOpacity={0.85}>
          <Text style={styles.addBtnTxt}>Add to My Plan</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.heartBtn} activeOpacity={0.7}>
          <Text style={{ fontSize: 18, color: C.s400 }}>♡</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: C.white,
    borderRadius: R.card,
    marginHorizontal: 20,
    marginBottom: 14,
    overflow: 'hidden',
    elevation: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.08,
    shadowRadius: 18,
  },
  top:         { padding: 18, paddingBottom: 0, flexDirection: 'row', alignItems: 'flex-start', gap: 13 },
  emojiBox:    { width: 54, height: 54, borderRadius: 18, backgroundColor: C.s100, alignItems: 'center', justifyContent: 'center' },
  emoji:       { fontSize: 26 },
  name:        { fontSize: 16, fontWeight: '800', color: C.s700, letterSpacing: -0.3 },
  desc:        { fontSize: 12, color: C.s400, fontWeight: '500', marginTop: 3, lineHeight: 18 },
  macros:      { flexDirection: 'row', flexWrap: 'wrap', gap: 7, paddingHorizontal: 18, paddingVertical: 14 },
  chip:        { flexDirection: 'row', alignItems: 'center', gap: 5, borderRadius: 20, paddingHorizontal: 11, paddingVertical: 5 },
  dot:         { width: 6, height: 6, borderRadius: 3 },
  chipTxt:     { fontSize: 11, fontWeight: '700' },
  chipProtein: { backgroundColor: '#EDE9FE' },
  chipCarbs:   { backgroundColor: C.t100 },
  chipFats:    { backgroundColor: C.a50 },
  whyBox:      { marginHorizontal: 18, backgroundColor: C.s50, borderRadius: 16, padding: 11, borderWidth: 1, borderColor: C.s200 },
  whyLabel:    { fontSize: 9, fontWeight: '700', color: C.i500, textTransform: 'uppercase', letterSpacing: 1, marginBottom: 5 },
  whyText:     { fontSize: 12, color: C.s500, fontWeight: '500', lineHeight: 18.6 },
  footer:      { padding: 14, paddingTop: 14, flexDirection: 'row', gap: 10 },
  addBtn:      { flex: 1, backgroundColor: C.t700, borderRadius: 14, padding: 12, alignItems: 'center' },
  addBtnTxt:   { color: C.white, fontWeight: '700', fontSize: 13 },
  heartBtn:    { width: 46, height: 46, borderWidth: 1.5, borderColor: C.s200, borderRadius: 14, backgroundColor: C.white, alignItems: 'center', justifyContent: 'center' },
});
