import React, { useRef, useEffect, useState, useCallback } from 'react';
import {
  View, Text, TouchableOpacity, Modal, StyleSheet,
  Animated, Platform, ActivityIndicator, Alert, ScrollView,
} from 'react-native';
import { BlurView } from 'expo-blur';
import { useAudioRecorder, AudioModule, RecordingPresets } from 'expo-audio';
import * as Speech from 'expo-speech';
import { C } from '../theme';
import { transcribeVoice, logActivity, sendChat } from '../services/api';

const HEIGHTS = [14, 26, 10, 40, 18, 50, 14, 40, 8, 30, 46, 12, 36, 20, 8, 42, 18, 28, 10, 22];
const DELAYS  = [0, .1, .2, .05, .15, .25, .1, .2, .3, 0, .15, .25, .05, .2, .1, .3, .15, 0, .22, .08];

// Phrases that signal the user wants to end the conversation
const DONE_RE = /^(done|thanks|thank you|goodbye|bye|no|that'?s? all|i'?m? done|nothing|nope|all done|finish|finished|stop|close|exit|quit)/i;

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

const INTENT_LABELS: Record<string, string> = {
  log_medication: '💊 Log medication',
  log_walk:       '🚶 Log walk',
  log_exercise:   '🏃 Log exercise',
  log_meal:       '🍽 Log meal',
  chat_food:      '🥗 Recipe recommendations',
  chat:           '💬 Ask MediMate',
};

interface Props {
  visible:                boolean;
  onClose:                () => void;
  onSendToChat?:          (text: string) => void;
  onNavigateToNutrition?: () => void;
}

export default function VoiceModal({ visible, onClose, onSendToChat, onNavigateToNutrition }: Props) {
  const [phase, setPhase]           = useState<Phase>('idle');
  const [transcript, setTranscript] = useState('');
  const [intent, setIntent]         = useState('');
  const [medId, setMedId]           = useState<number | undefined>();
  const [medName, setMedName]       = useState<string | undefined>();
  const [logDone, setLogDone]         = useState(false);
  const [aiReply, setAiReply]         = useState('');
  const [speaking, setSpeaking]       = useState(false);
  const [loadingReply, setLoadingReply] = useState(false);
  // Full conversation transcript shown in the session
  const [sessionLog, setSessionLog] = useState<string[]>([]);
  const didAutoAct = useRef(false);

  const recorder = useAudioRecorder(RecordingPresets.HIGH_QUALITY);

  // ── Reset state whenever modal opens ────────────────────────────────────────
  useEffect(() => {
    if (visible) {
      setPhase('idle');
      setTranscript('');
      setIntent('');
      setMedId(undefined);
      setMedName(undefined);
      setLogDone(false);
      setAiReply('');
      setSpeaking(false);
      setSessionLog([]);
      didAutoAct.current = false;
    }
  }, [visible]);

  // ── Auto-start recording when modal opens ────────────────────────────────────
  useEffect(() => {
    if (visible && phase === 'idle') {
      startRecording();
    }
  }, [visible]);

  // ── Auto-act when result arrives ─────────────────────────────────────────────
  // For chat + food questions: always get an LLM response first (conversational).
  // For log intents: show the Confirm button — no auto-action.
  useEffect(() => {
    if (phase !== 'result' || didAutoAct.current) return;
    didAutoAct.current = true;

    if ((intent === 'chat' || intent === 'chat_food') && transcript) {
      sendChat([{ role: 'user', content: transcript }])
        .then(res => {
          const reply: string = res.data.reply ?? '';
          setAiReply(reply);
          speakText(reply.slice(0, 300));
        })
        .catch(() => {
          setAiReply('Sorry, I couldn\'t reach the server. Make sure the backend is running.');
        });
    }
  }, [phase, intent, transcript]);

  const speakText = (text: string) => {
    Speech.stop();
    setSpeaking(true);
    Speech.speak(text, {
      rate:     0.88,
      pitch:    1.05,
      language: 'en-US',
      onDone:    () => setSpeaking(false),
      onStopped: () => setSpeaking(false),
      onError:   () => setSpeaking(false),
    });
  };

  const stopSpeaking = () => { Speech.stop(); setSpeaking(false); };

  // ── Recording ────────────────────────────────────────────────────────────────
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
      // Give the recorder a moment to flush the file
      await new Promise(resolve => setTimeout(resolve, 300));
      const uri = recorder.uri;
      if (!uri) throw new Error('No audio file after recording');

      const result = await transcribeVoice(uri);
      const text = result.text?.trim() ?? '';

      if (!text) {
        setPhase('error');
        return;
      }

      // Check if user wants to end the session
      if (DONE_RE.test(text)) {
        speakText('Goodbye! Have a great day.');
        setTimeout(onClose, 1400);
        return;
      }

      setTranscript(text);
      setIntent(result.intent);
      setMedId(result.med_id);
      setMedName(result.med_name);
      // Add to session transcript
      setSessionLog(prev => [...prev, `You: ${text}`]);
      setPhase('result');
    } catch (e: any) {
      console.error('transcribe error:', e);
      setPhase('error');
    }
  }, [phase, recorder, onClose]);

  // ── Restart for next turn in conversation ───────────────────────────────────
  const restartForNextTurn = useCallback(() => {
    Speech.stop();
    setPhase('idle');
    setTranscript('');
    setIntent('');
    setMedId(undefined);
    setMedName(undefined);
    setLogDone(false);
    setAiReply('');
    setSpeaking(false);
    didAutoAct.current = false;
    // Trigger recording
    startRecording();
  }, [startRecording]);

  // ── Confirm & log, then get LLM conversational response ─────────────────────
  const confirmLog = useCallback(async () => {
    try {
      let actionMsg = '';

      if (intent === 'log_medication') {
        await logActivity('medicine', medId, medName ?? transcript);
        actionMsg = `I just took my ${medName ?? 'medication'}`;
        setSessionLog(prev => [...prev, `✅ ${medName ?? 'Medication'} logged`]);
      } else if (intent === 'log_walk') {
        await logActivity('walk', undefined, transcript);
        actionMsg = 'I just finished my walk today';
        setSessionLog(prev => [...prev, '✅ Walk logged']);
      } else if (intent === 'log_exercise') {
        await logActivity('exercise', undefined, transcript);
        actionMsg = 'I just finished exercising';
        setSessionLog(prev => [...prev, '✅ Exercise logged']);
      } else if (intent === 'log_meal') {
        await logActivity('meal', undefined, transcript);
        actionMsg = 'I just had a meal';
        setSessionLog(prev => [...prev, '✅ Meal logged']);
      } else {
        return; // non-log intents are handled by the auto-act useEffect
      }

      setLogDone(true);

      // Get a conversational LLM response (with RAG health context) after logging
      if (actionMsg) {
        setLoadingReply(true);
        sendChat([{ role: 'user', content: actionMsg }])
          .then(res => {
            const reply: string = res.data.reply ?? '';
            setAiReply(reply);
            speakText(reply.slice(0, 300));
          })
          .catch(() => {
            // Fallback to simple confirmation if LLM unavailable
            speakText(`Done! ${medName ?? 'Activity'} has been logged.`);
          })
          .finally(() => setLoadingReply(false));
      }
    } catch (e) {
      console.error('log error:', e);
    }
  }, [intent, medId, medName, transcript, onSendToChat, onNavigateToNutrition, onClose]);

  const handleClose = useCallback(async () => {
    Speech.stop();
    if (phase === 'recording') {
      try { await recorder.stop(); } catch {}
    }
    onClose();
  }, [phase, recorder, onClose]);

  // ── Render ───────────────────────────────────────────────────────────────────

  const renderContent = () => {
    if (phase === 'idle') return (
      <View style={styles.idleWrap}>
        <ActivityIndicator size="small" color={C.t300} />
        <Text style={styles.subtitle}>Starting microphone...</Text>
      </View>
    );

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
        <Text style={styles.subtitle}>Processing your voice</Text>
        <ActivityIndicator size="large" color={C.t500} style={{ marginVertical: 28 }} />
      </>
    );

    if (phase === 'result') {
      const isLogIntent = intent.startsWith('log_');
      return (
        <>
          {/* Session transcript */}
          {sessionLog.length > 0 && (
            <ScrollView style={styles.sessionLog} showsVerticalScrollIndicator={false}>
              {sessionLog.map((line, i) => (
                <Text key={i} style={styles.sessionLine}>{line}</Text>
              ))}
            </ScrollView>
          )}

          {/* Current transcript */}
          <View style={styles.transcriptBox}>
            <Text style={styles.transcriptText}>"{transcript}"</Text>
          </View>

          {/* AI reply for chat intent */}
          {aiReply ? (
            <View style={styles.aiReplyBox}>
              <Text style={styles.aiReplyLabel}>MediMate says:</Text>
              <Text style={styles.aiReplyText}>{aiReply}</Text>
            </View>
          ) : null}

          {/* Speaking indicator */}
          {speaking && (
            <TouchableOpacity style={styles.speakingBtn} onPress={stopSpeaking}>
              <Text style={styles.speakingTxt}>🔊 Speaking... tap to stop</Text>
            </TouchableOpacity>
          )}

          {/* LLM reply loading spinner */}
          {loadingReply && (
            <View style={styles.replyLoading}>
              <ActivityIndicator size="small" color={C.t300} />
              <Text style={styles.replyLoadingTxt}>MediMate is thinking...</Text>
            </View>
          )}

          {/* After log completed: show "Anything else?" */}
          {logDone ? (
            <View style={styles.doneSection}>
              <View style={styles.doneBox}>
                <Text style={styles.doneTxt}>✅ Logged successfully!</Text>
              </View>
              <View style={styles.continueRow}>
                <TouchableOpacity style={styles.continueBtn} onPress={restartForNextTurn} activeOpacity={0.8}>
                  <Text style={styles.continueTxt}>🎤 Anything else?</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.doneBtn} onPress={handleClose} activeOpacity={0.8}>
                  <Text style={styles.doneBtnTxt}>Done ✓</Text>
                </TouchableOpacity>
              </View>
            </View>
          ) : aiReply ? (
            /* After AI chat reply: offer to continue + recipes if food intent */
            <>
              {intent === 'chat_food' && (
                <TouchableOpacity
                  style={styles.recipesBtn}
                  onPress={() => { onNavigateToNutrition?.(); handleClose(); }}
                  activeOpacity={0.8}
                >
                  <Text style={styles.recipesBtnTxt}>🥗 View Recipe Recommendations</Text>
                </TouchableOpacity>
              )}
              <View style={styles.continueRow}>
                <TouchableOpacity style={styles.continueBtn} onPress={restartForNextTurn} activeOpacity={0.8}>
                  <Text style={styles.continueTxt}>🎤 Continue</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.doneBtn} onPress={handleClose} activeOpacity={0.8}>
                  <Text style={styles.doneBtnTxt}>Done ✓</Text>
                </TouchableOpacity>
              </View>
            </>
          ) : isLogIntent ? (
            /* Log confirmation button */
            <>
              <Text style={styles.intentLabel}>
                Detected: {INTENT_LABELS[intent] ?? '💬 Ask MediMate'}
              </Text>
              <TouchableOpacity style={styles.confirmBtn} onPress={confirmLog} activeOpacity={0.8}>
                <Text style={styles.confirmTxt}>Confirm & Log</Text>
              </TouchableOpacity>
            </>
          ) : (
            /* Chat/food reply is loading */
            <ActivityIndicator size="small" color={C.t300} style={{ marginVertical: 12 }} />
          )}
        </>
      );
    }

    if (phase === 'error') return (
      <>
        <Text style={styles.title}>Couldn't transcribe</Text>
        <Text style={styles.subtitle}>
          Make sure the Whisper server is running on port 8001{'\n'}
          and try speaking again clearly.
        </Text>
        <TouchableOpacity style={styles.retryBtn} onPress={restartForNextTurn} activeOpacity={0.8}>
          <Text style={styles.retryTxt}>🎤 Try Again</Text>
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
  overlay: { flex: 1, justifyContent: 'flex-end' },
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
    maxHeight: '85%',
  },
  handle:   { width: 36, height: 4, backgroundColor: 'rgba(255,255,255,0.16)', borderRadius: 2, alignSelf: 'center', marginBottom: 20 },

  idleWrap: { alignItems: 'center', paddingVertical: 24, gap: 10 },
  title:    { fontSize: 22, fontWeight: '800', color: '#fff', textAlign: 'center', letterSpacing: -0.4 },
  subtitle: { fontSize: 13, color: 'rgba(255,255,255,0.4)', fontWeight: '500', textAlign: 'center', marginTop: 5, marginBottom: 22 },

  wf:  { flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'center', height: 56, gap: 3, marginBottom: 26 },
  bar: { width: 4, borderRadius: 2, backgroundColor: C.t500 },

  stopBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
    backgroundColor: C.t700, borderRadius: 14, paddingVertical: 14, marginBottom: 16,
  },
  stopIcon: { fontSize: 18 },
  stopTxt:  { fontSize: 15, fontWeight: '700', color: '#fff' },

  sessionLog:  { maxHeight: 80, marginBottom: 8 },
  sessionLine: { fontSize: 12, color: 'rgba(255,255,255,0.45)', marginBottom: 3 },

  transcriptBox: {
    backgroundColor: 'rgba(255,255,255,0.07)', borderRadius: 12,
    padding: 14, marginVertical: 12,
  },
  transcriptText: { fontSize: 15, color: '#fff', fontStyle: 'italic', textAlign: 'center' },

  aiReplyBox: {
    backgroundColor: 'rgba(13,148,136,0.15)',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(13,148,136,0.3)',
    padding: 12,
    marginBottom: 12,
  },
  aiReplyLabel: { fontSize: 11, fontWeight: '700', color: C.t300, marginBottom: 4 },
  aiReplyText:  { fontSize: 14, color: '#fff', lineHeight: 20 },

  speakingBtn: {
    backgroundColor: 'rgba(99,102,241,0.2)',
    borderRadius: 10,
    paddingVertical: 8,
    alignItems: 'center',
    marginBottom: 10,
    borderWidth: 1,
    borderColor: 'rgba(99,102,241,0.3)',
  },
  speakingTxt: { fontSize: 12, fontWeight: '700', color: '#a5b4fc' },

  replyLoading: { flexDirection: 'row', alignItems: 'center', gap: 8, justifyContent: 'center', marginBottom: 10 },
  replyLoadingTxt: { fontSize: 12, color: 'rgba(255,255,255,0.45)', fontWeight: '600' },

  intentLabel: { fontSize: 13, color: C.t300, fontWeight: '600', textAlign: 'center', marginBottom: 12 },

  confirmBtn: {
    backgroundColor: C.t500, borderRadius: 14,
    paddingVertical: 14, alignItems: 'center', marginBottom: 10,
  },
  confirmTxt: { fontSize: 15, fontWeight: '700', color: '#fff' },

  doneSection: { gap: 10 },
  doneBox: {
    backgroundColor: 'rgba(13,148,136,0.2)', borderRadius: 12,
    padding: 14, alignItems: 'center',
  },
  doneTxt: { fontSize: 15, fontWeight: '700', color: C.t300 },

  continueRow: { flexDirection: 'row', gap: 10, marginBottom: 4 },
  continueBtn: {
    flex: 1, backgroundColor: C.t700, borderRadius: 14,
    paddingVertical: 13, alignItems: 'center',
  },
  continueTxt: { fontSize: 14, fontWeight: '700', color: '#fff' },
  doneBtn: {
    flex: 1, backgroundColor: 'rgba(255,255,255,0.08)', borderRadius: 14,
    paddingVertical: 13, alignItems: 'center',
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.12)',
  },
  doneBtnTxt: { fontSize: 14, fontWeight: '700', color: 'rgba(255,255,255,0.7)' },

  retryBtn: {
    backgroundColor: C.t700, borderRadius: 14,
    paddingVertical: 13, alignItems: 'center', marginVertical: 12,
  },
  retryTxt: { fontSize: 14, fontWeight: '700', color: '#fff' },

  recipesBtn: {
    backgroundColor: 'rgba(13,148,136,0.18)',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: 'rgba(13,148,136,0.35)',
    paddingVertical: 12,
    alignItems: 'center',
    marginBottom: 10,
  },
  recipesBtnTxt: { fontSize: 14, fontWeight: '700', color: C.t300 },

  cancelBtn: {
    width: '100%', backgroundColor: 'rgba(239,68,68,0.11)',
    borderWidth: 1, borderColor: 'rgba(239,68,68,0.22)',
    borderRadius: 15, padding: 13, alignItems: 'center',
    marginTop: 8,
  },
  cancelTxt: { fontSize: 14, fontWeight: '700', color: '#FCA5A5' },
});
