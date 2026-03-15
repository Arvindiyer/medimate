import React, { useEffect, useRef, useState } from 'react';
import { View, Text, Platform, StyleSheet, TouchableOpacity, Animated } from 'react-native';
import { NavigationContainer } from '@react-navigation/native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { BlurView } from 'expo-blur';
import { LinearGradient } from 'expo-linear-gradient';
import Svg, { Path, Rect, Line, Circle } from 'react-native-svg';

import { registerForPushNotifications } from './notifications';
import HomeScreen        from './screens/HomeScreen';
import TimelineScreen    from './screens/TimelineScreen';
import ProfileScreen     from './screens/ProfileScreen';
import ChatScreen        from './screens/ChatScreen';
import VoiceModal        from './components/VoiceFAB';
import OnboardingScreen  from './screens/OnboardingScreen';
import { C } from './theme';
import { isLoggedIn } from './services/storage';

const Tab = createBottomTabNavigator();

// ── Tab bar SVG icons ──────────────────────────────────────────────────────────

function HomeIcon({ color }: { color: string }) {
  return (
    <Svg width={20} height={20} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round">
      <Path d="M3 12L12 3L21 12V20C21 20.6 20.6 21 20 21H15V16H9V21H4C3.4 21 3 20.6 3 20V12Z" />
    </Svg>
  );
}

function TimelineIcon({ color }: { color: string }) {
  return (
    <Svg width={20} height={20} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round">
      <Rect x="3" y="4" width="18" height="18" rx="2" />
      <Line x1="16" y1="2" x2="16" y2="6" />
      <Line x1="8"  y1="2" x2="8"  y2="6" />
      <Line x1="3"  y1="10" x2="21" y2="10" />
    </Svg>
  );
}

function ChatIcon({ color }: { color: string }) {
  return (
    <Svg width={20} height={20} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round">
      <Path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
    </Svg>
  );
}

function ProfileIcon({ color }: { color: string }) {
  return (
    <Svg width={20} height={20} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round">
      <Circle cx="12" cy="8" r="4" />
      <Path d="M6 20v-2a6 6 0 0 1 12 0v2" />
    </Svg>
  );
}

// Placeholder — the Voice tab never actually renders a screen
function EmptyScreen() { return null; }

export default function App() {
  // ── All hooks must be declared before any conditional return ────────────────
  useEffect(() => { registerForPushNotifications(); }, []);

  const [ready, setReady]         = useState(isLoggedIn());
  const [voiceOpen, setVoiceOpen] = useState(false);
  const voiceScale = useRef(new Animated.Value(1)).current;
  const voiceY     = useRef(new Animated.Value(0)).current;

  // ── Onboarding gate (after all hooks) ────────────────────────────────────────
  if (!ready) {
    return <OnboardingScreen onComplete={() => setReady(true)} />;
  }

  const openVoice = () => {
    // squish down → spring up (pop) → settle
    Animated.sequence([
      Animated.timing(voiceScale, { toValue: 0.82, duration: 80,  useNativeDriver: true }),
      Animated.spring(voiceScale,  { toValue: 1.22, friction: 4,  useNativeDriver: true }),
      Animated.spring(voiceScale,  { toValue: 1,    friction: 5,  useNativeDriver: true }),
    ]).start();
    Animated.sequence([
      Animated.timing(voiceY, { toValue: 4,   duration: 80,  useNativeDriver: true }),
      Animated.spring(voiceY,  { toValue: -10, friction: 4,  useNativeDriver: true }),
      Animated.spring(voiceY,  { toValue: 0,   friction: 5,  useNativeDriver: true }),
    ]).start();
    setVoiceOpen(true);
  };

  return (
    <View style={{ flex: 1 }}>
      <NavigationContainer>
        <Tab.Navigator
          screenOptions={({ route }) => ({
            tabBarIcon: ({ color }) => {
              if (route.name === 'Home')     return <HomeIcon color={color} />;
              if (route.name === 'Timeline') return <TimelineIcon color={color} />;
              if (route.name === 'Chat')     return <ChatIcon color={color} />;
              if (route.name === 'Profile')  return <ProfileIcon color={color} />;
              return null;
            },
            tabBarActiveTintColor:   C.t700,
            tabBarInactiveTintColor: C.s400,
            tabBarLabelStyle: {
              fontSize: 9.5,
              fontWeight: '700',
              letterSpacing: 0.1,
              marginBottom: 2,
            },
            tabBarStyle: {
              position: 'absolute',
              borderTopWidth: 1,
              borderTopColor: C.s200,
              elevation: 0,
              height: Platform.OS === 'ios' ? 80 : 62,
              paddingBottom: Platform.OS === 'ios' ? 22 : 6,
            },
            tabBarBackground: () =>
              Platform.OS === 'ios' ? (
                <BlurView intensity={60} tint="light" style={StyleSheet.absoluteFill} />
              ) : (
                <View style={[StyleSheet.absoluteFill, { backgroundColor: 'rgba(255,255,255,0.97)' }]} />
              ),
            headerStyle: {
              backgroundColor: C.s50,
              elevation: 0,
              shadowOpacity: 0,
              borderBottomWidth: 0,
            },
            headerTitleStyle: {
              fontWeight: '800',
              color: C.s700,
              fontSize: 18,
            },
          })}
        >
          <Tab.Screen name="Home"     component={HomeScreen}     options={{ title: 'MediMate' }} />
          <Tab.Screen name="Timeline" component={TimelineScreen} />

          {/* ── Center voice button ──────────────────────────────────────── */}
          <Tab.Screen
            name="Voice"
            component={EmptyScreen}
            options={{
              headerShown: false,
              tabBarLabel: () => (
                <Text style={{ fontSize: 9.5, fontWeight: '700', color: C.t700, marginBottom: 2 }}>
                  Voice
                </Text>
              ),
              tabBarButton: () => (
                <TouchableOpacity
                  onPress={openVoice}
                  activeOpacity={1}
                  style={styles.voiceTabSlot}
                >
                  <Animated.View
                    style={[
                      styles.voiceBtnShadow,
                      { transform: [{ scale: voiceScale }, { translateY: voiceY }] },
                    ]}
                  >
                    <LinearGradient
                      colors={[C.t500, C.i500]}
                      style={styles.voiceBtn}
                      start={{ x: 0, y: 0 }}
                      end={{ x: 1, y: 1 }}
                    >
                      <Text style={styles.voiceIcon}>🎤</Text>
                    </LinearGradient>
                  </Animated.View>
                  <Text style={styles.voiceLabel}>Voice</Text>
                </TouchableOpacity>
              ),
            }}
          />
          {/* ──────────────────────────────────────────────────────────────── */}

          <Tab.Screen name="Chat"    component={ChatScreen}    />
          <Tab.Screen name="Profile" component={ProfileScreen} />
        </Tab.Navigator>
      </NavigationContainer>

      {/* Voice modal rendered above everything */}
      <VoiceModal visible={voiceOpen} onClose={() => setVoiceOpen(false)} />
    </View>
  );
}

const styles = StyleSheet.create({
  // Center voice slot — fills its tab bar flex area
  voiceTabSlot: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'flex-end',
    paddingBottom: Platform.OS === 'ios' ? 22 : 6,
  },
  // Shadow wrapper around the gradient circle
  voiceBtnShadow: {
    shadowColor: C.t700,
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.45,
    shadowRadius: 16,
    elevation: 12,
    // Raise button above tab bar surface
    marginBottom: Platform.OS === 'ios' ? 10 : 8,
    marginTop: Platform.OS === 'ios' ? -22 : -18,
  },
  voiceBtn: {
    width: 58,
    height: 58,
    borderRadius: 29,
    alignItems: 'center',
    justifyContent: 'center',
  },
  voiceIcon:  { fontSize: 26 },
  voiceLabel: { fontSize: 9.5, fontWeight: '700', color: C.t700, marginTop: 4 },
});
