import React, { useRef, useEffect, useState, useCallback } from 'react';
import {
  View, Text, TouchableOpacity, Modal, StyleSheet,
  Animated, Platform, ActivityIndicator, Alert,
} from 'react-native';
import { BlurView } from 'expo-blur';
import { useAudioRecorder, AudioModule, RecordingPresets } from 'expo-audio';
// expo-audio API (SDK 55+):
//   useAudioRecorder hook → recorder.prepareToRecordAsync / record / stop / uri
import { C } from '../theme';
import { transcribeVoice, logActivity } from '../services/api';

const HEIGHTS = [14, 26, 10, 40, 18, 50, 14, 40, 8, 30, 46, 12, 36, 20, 8, 42, 18, 28, 10, 22];
const DELAYS  = [0, .1, .2, .05, .15, .25, .1, .2, .3, 0, .15, .25, .05, .2, .1, .3, .15, 0, .22, .08];

type Phase = 'idle' | 'recording' | 'processing' | 'result' | 'error';

function WaveformBars({ active }: { active: boolean }) {
  const anims = useRef(HEIGHTS.map(h => new Animated.Value(h * 0.22))).current;
  const loops = useRef<Animated.CompositeAnimation[]>([]);

  useEffect(() => {
    if (active) {
      loops.current = anims.map((anim: Animated.Value, i: number) => {
        const loop = Animated.loop(
          Animated.sequence([
            Animated.delay(DELAYS[i] * 1000),
            Animated.timing(anim, { toValue: HEIGHTS[i],        duration: 650, useNativeDriver: false }),
            Animated.timing(anim, { toValue: HEIGHTS[i] * 0.22, duration: 650, useNativeDriver: false }),
          ])
        );
        loop.start();
        return loop;
      });
    } else {
      loops.current.forEach((l: Animated.CompositeAnimation) => l.stop());
      anims.forEach((a: Animated.Value, i: number) => a.setValue(HEIGHTS[i] * 0.22));
    }
    return () => loops.current.forEach((l: Animated.CompositeAnimation) => l.stop());
  }, [active]);

  return (
    <View style={styles.wf}>
      {HEIGHTS.map((_, i) => (
        <Animated.View key={i} style={[styles.bar, { height: anims[i] }]} />
      ))}
    </View>
  );
}

// ── Intent → human label ───────────────────────────────────────────────────

const INTENT_LABELS: Record<string, string> = {
  log_medication: '💊 Log medication',
  log_walk:       '🚶 Log walk',
  log_exercise:   '🏃 Log exercise',
  log_meal:       '🍽 Log meal',
  chat_food:      '🥗 Ask about food',
  chat:           '💬 Send to chat',
};

// ── Props ──────────────────────────────────────────────────────────────────

interface Props {
  visible:  boolean;
  onClose:  () => void;
  onSendToChat?: (text: string) => void;
}

export default function VoiceModal({ visible, onClose, onSendToChat }: Props) {
  const [phase, setPhase]           = useState<Phase>('idle');
  const [transcript, setTranscript] = useState('');
  const [intent, setIntent]         = useState('');
  const [medId, setMedId]           = useState<number | undefined>();
  const [medName, setMedName]       = useState<string | undefined>();
  const [logDone, setLogDone]       = useState(false);

  // expo-audio hook — must be called unconditionally at top level
  const recorder = useAudioRecorder(RecordingPresets.HIGH_QUALITY);

  // Reset state whenever modal opens
  useEffect(() => {
    if (visible) {
      setPhase('idle');
      setTranscript('');
      setIntent('');
      setMedId(undefined);
      setMedName(undefined);
      setLogDone(false);
    }
  }, [visible]);

  // Auto-start recording when modal opens
  useEffect(() => {
    if (visible && phase === 'idle') {
      startRecording();
    }
  }, [visible]);

  const startRecording = useCallback(async () => {
    try {
      const { granted } = await AudioModule.requestRecordingPermissionsAsync();
      if (!granted) {
        Alert.alert('Microphone permission required', 'Please allow microphone access in Settings.');
        onClose();
        return;
      }
      await recorder.prepareToRecordAsync();
      recorder.record();
      setPhase('recording');
    } catch (e) {
      console.error('startRecording error:', e);
      setPhase('error');
    }
  }, [onClose, recorder]);

  const stopAndTranscribe = useCallback(async () => {
    if (phase !== 'recording') return;
    setPhase('processing');

    try {
      await recorder.stop();
      const uri = recorder.uri;
      if (!uri) throw new Error('No audio URI after recording');

      const result = await transcribeVoice(uri);
      setTranscript(result.text);
      setIntent(result.intent);
      setMedId(result.med_id);
      setMedName(result.med_name);
      setPhase('result');
    } catch (e: any) {
      console.error('transcribe error:', e);
      setPhase('error');
    }
  }, [phase, recorder]);

  const confirmLog = useCallback(async () => {
    try {
      if (intent === 'log_medication') {
        await logActivity('medicine', medId, medName ?? transcript);
      } else if (intent === 'log_walk') {
        await logActivity('walk', undefined, transcript);
      } else if (intent === 'log_exercise') {
        await logActivity('exercise', undefined, transcript);
      } else if (intent === 'log_meal') {
        await logActivity('meal', undefined, transcript);
      } else if ((intent === 'chat' || intent === 'chat_food') && onSendToChat) {
        onSendToChat(transcript);
        onClose();
        return;
      }
      setLogDone(true);
    } catch (e) {
      console.error('log error:', e);
    }
  }, [intent, medId, medName, transcript, onSendToChat, onClose]);

  const handleClose = useCallback(async () => {
    if (phase === 'recording') {
      try { await recorder.stop(); } catch {}
    }
    onClose();
  }, [phase, recorder, onClose]);

  // ── Render helpers ────────────────────────────────────────────────────────

  const renderContent = () => {
    if (phase === 'idle') return null;

    if (phase === 'recording') return (
      <>
        <Text style={styles.title}>Listening...</Text>
        <Text style={styles.subtitle}>Speak now — tap stop when done</Text>
        <WaveformBars active />
        <TouchableOpacity style={styles.stopBtn} onPress={stopAndTranscribe} activeOpacity={0.8}>
          <Text style={styles.stopIcon}>⏹</Text>
          <Text style={styles.stopTxt}>Stop & Transcribe</Text>
        </TouchableOpacity>
      </>
    );

    if (phase === 'processing') return (
      <>
        <Text style={styles.title}>Transcribing...</Text>
        <Text style={styles.subtitle}>Processing your voice with Whisper</Text>
        <ActivityIndicator size="large" color={C.t500} style={{ marginVertical: 28 }} />
      </>
    );

    if (phase === 'result') return (
      <>
        <Text style={styles.title}>Got it!</Text>
        <View style={styles.transcriptBox}>
          <Text style={styles.transcriptText}>"{transcript}"</Text>
        </View>
        {logDone ? (
          <View style={styles.doneBox}>
            <Text style={styles.doneTxt}>✅ Logged successfully!</Text>
          </View>
        ) : (
          <>
            <Text style={styles.intentLabel}>
              Detected: {INTENT_LABELS[intent] ?? '💬 Send to chat'}
            </Text>
            <TouchableOpacity style={styles.confirmBtn} onPress={confirmLog} activeOpacity={0.8}>
              <Text style={styles.confirmTxt}>
                {intent.startsWith('log_') ? 'Confirm & Log' : 'Send to Chat'}
              </Text>
            </TouchableOpacity>
          </>
        )}
      </>
    );

    if (phase === 'error') return (
      <>
        <Text style={styles.title}>Couldn't transcribe</Text>
        <Text style={styles.subtitle}>
          Make sure the Whisper server is running on port 8001
        </Text>
        <TouchableOpacity style={styles.retryBtn} onPress={startRecording} activeOpacity={0.8}>
          <Text style={styles.retryTxt}>Try Again</Text>
        </TouchableOpacity>
      </>
    );

    return null;
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={handleClose}
      statusBarTranslucent
    >
      <View style={styles.overlay}>
        {Platform.OS === 'ios' ? (
          <BlurView intensity={80} tint="dark" style={StyleSheet.absoluteFill} />
        ) : (
          <View style={[StyleSheet.absoluteFill, { backgroundColor: 'rgba(6,14,28,0.87)' }]} />
        )}
        <TouchableOpacity style={StyleSheet.absoluteFill} onPress={handleClose} />

        <View style={styles.sheet} pointerEvents="box-none">
          <View style={styles.handle} />
          {renderContent()}
          <TouchableOpacity style={styles.cancelBtn} onPress={handleClose} activeOpacity={0.7}>
            <Text style={styles.cancelTxt}>Cancel</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay:  { flex: 1, justifyContent: 'flex-end' },
  sheet: {
    backgroundColor: 'rgba(14,22,36,0.97)',
    borderTopLeftRadius: 26,
    borderTopRightRadius: 26,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255,255,255,0.07)',
    paddingTop: 10,
    paddingHorizontal: 22,
    paddingBottom: 34,
    minHeight: 280,
  },
  handle:   { width: 36, height: 4, backgroundColor: 'rgba(255,255,255,0.16)', borderRadius: 2, alignSelf: 'center', marginBottom: 20 },
  title:    { fontSize: 22, fontWeight: '800', color: '#fff', textAlign: 'center', letterSpacing: -0.4 },
  subtitle: { fontSize: 13, color: 'rgba(255,255,255,0.4)', fontWeight: '500', textAlign: 'center', marginTop: 5, marginBottom: 22 },
  wf:       { flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'center', height: 56, gap: 3, marginBottom: 26 },
  bar:      { width: 4, borderRadius: 2, backgroundColor: C.t500 },

  stopBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
    backgroundColor: C.t700, borderRadius: 14, paddingVertical: 14,
    marginBottom: 16,
  },
  stopIcon: { fontSize: 18 },
  stopTxt:  { fontSize: 15, fontWeight: '700', color: '#fff' },

  transcriptBox: {
    backgroundColor: 'rgba(255,255,255,0.07)', borderRadius: 12,
    padding: 14, marginVertical: 14,
  },
  transcriptText: { fontSize: 15, color: '#fff', fontStyle: 'italic', textAlign: 'center' },

  intentLabel: {
    fontSize: 13, color: C.t300, fontWeight: '600',
    textAlign: 'center', marginBottom: 12,
  },

  confirmBtn: {
    backgroundColor: C.t500, borderRadius: 14,
    paddingVertical: 14, alignItems: 'center', marginBottom: 10,
  },
  confirmTxt: { fontSize: 15, fontWeight: '700', color: '#fff' },

  doneBox: {
    backgroundColor: 'rgba(13,148,136,0.2)', borderRadius: 12,
    padding: 14, alignItems: 'center', marginBottom: 14,
  },
  doneTxt: { fontSize: 15, fontWeight: '700', color: C.t300 },

  retryBtn: {
    backgroundColor: 'rgba(255,255,255,0.1)', borderRadius: 14,
    paddingVertical: 13, alignItems: 'center', marginVertical: 12,
  },
  retryTxt: { fontSize: 14, fontWeight: '700', color: '#fff' },

  cancelBtn: {
    width: '100%', backgroundColor: 'rgba(239,68,68,0.11)',
    borderWidth: 1, borderColor: 'rgba(239,68,68,0.22)',
    borderRadius: 15, padding: 13, alignItems: 'center',
    marginTop: 8,
  },
  cancelTxt: { fontSize: 14, fontWeight: '700', color: '#FCA5A5' },
});
