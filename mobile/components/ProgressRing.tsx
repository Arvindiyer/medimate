import React, { useEffect, useRef } from 'react';
import { View, Text, StyleSheet, Animated } from 'react-native';
import Svg, { Circle, Defs, LinearGradient, Stop } from 'react-native-svg';
import { C } from '../theme';

interface Props {
  percent: number;
  size?: number;
}

const AnimatedCircle = Animated.createAnimatedComponent(Circle);

export default function ProgressRing({ percent, size = 110 }: Props) {
  const radius = 45;
  const circumference = 2 * Math.PI * radius; // ≈ 282.74
  const animOffset = useRef(new Animated.Value(circumference)).current;

  useEffect(() => {
    const target = circumference * (1 - Math.min(Math.max(percent, 0), 100) / 100);
    Animated.timing(animOffset, {
      toValue: target,
      duration: 1400,
      useNativeDriver: false, // SVG props require JS driver
    }).start();
  }, [percent]);

  return (
    <View style={{ width: size, height: size }}>
      <Svg width={size} height={size} viewBox="0 0 110 110">
        <Defs>
          <LinearGradient id="rg" x1="0" y1="0" x2="1" y2="0">
            <Stop offset="0" stopColor={C.t500} />
            <Stop offset="1" stopColor={C.i500} />
          </LinearGradient>
        </Defs>
        {/* Track */}
        <Circle
          cx="55" cy="55" r={radius}
          fill="none"
          stroke={C.s100}
          strokeWidth="10"
        />
        {/* Fill */}
        <AnimatedCircle
          cx="55" cy="55" r={radius}
          fill="none"
          stroke="url(#rg)"
          strokeWidth="10"
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={animOffset}
          transform="rotate(-90 55 55)"
        />
      </Svg>
      <View style={[StyleSheet.absoluteFill, styles.center]}>
        <Text style={styles.pct}>{percent}%</Text>
        <Text style={styles.lbl}>Daily Goal</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  center: { alignItems: 'center', justifyContent: 'center' },
  pct:    { fontSize: 21, fontWeight: '800', color: C.s700, letterSpacing: -0.8 },
  lbl:    { fontSize: 8, fontWeight: '700', color: C.s400, textTransform: 'uppercase', letterSpacing: 0.6 },
});
