import React, { useState, useRef } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, ScrollView,
  StyleSheet, KeyboardAvoidingView, Platform, ActivityIndicator,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { sendChat } from '../services/api';
import { C } from '../theme';

type Msg = { role: 'user' | 'assistant'; content: string };

const INITIAL: Msg = {
  role: 'assistant',
  content: "Hi! I'm MediMate 👋 Ask me about your medications, what to eat, or anything about your health routine.",
};

export default function ChatScreen() {
  const [messages, setMessages] = useState<Msg[]>([INITIAL]);
  const [input, setInput]       = useState('');
  const [loading, setLoading]   = useState(false);
  const scroll = useRef<ScrollView>(null);

  const send = async () => {
    if (!input.trim() || loading) return;
    const userMsg: Msg = { role: 'user', content: input.trim() };
    const updated = [...messages, userMsg];
    setMessages(updated);
    setInput('');
    setLoading(true);

    try {
      const res = await sendChat(updated);
      setMessages([...updated, { role: 'assistant', content: res.data.reply }]);
    } catch {
      setMessages([...updated, {
        role: 'assistant',
        content: "Sorry, I couldn't connect to the server. Make sure the backend is running.",
      }]);
    } finally {
      setLoading(false);
      setTimeout(() => scroll.current?.scrollToEnd({ animated: true }), 100);
    }
  };

  return (
    <KeyboardAvoidingView
      style={styles.root}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      keyboardVerticalOffset={Platform.OS === 'ios' ? 90 : 60}
    >
      <ScrollView
        ref={scroll}
        contentContainerStyle={styles.messages}
        showsVerticalScrollIndicator={false}
        onContentSizeChange={() => scroll.current?.scrollToEnd({ animated: true })}
      >
        {messages.map((m, i) => (
          <View key={i} style={[styles.row, m.role === 'user' ? styles.rowUser : styles.rowAssistant]}>
            {m.role === 'assistant' && (
              <View style={styles.avatar}>
                <Text style={{ fontSize: 14 }}>🤖</Text>
              </View>
            )}
            <View style={[styles.bubble, m.role === 'user' ? styles.bubbleUser : styles.bubbleAssistant]}>
              <Text style={[styles.bubbleText, m.role === 'user' && styles.bubbleTextUser]}>
                {m.content}
              </Text>
            </View>
          </View>
        ))}

        {loading && (
          <View style={[styles.row, styles.rowAssistant]}>
            <View style={styles.avatar}>
              <Text style={{ fontSize: 14 }}>🤖</Text>
            </View>
            <View style={[styles.bubble, styles.bubbleAssistant, styles.typingBubble]}>
              <ActivityIndicator size="small" color={C.s400} />
            </View>
          </View>
        )}
      </ScrollView>

      {/* Input bar */}
      <View style={styles.inputBar}>
        <TextInput
          style={styles.input}
          value={input}
          onChangeText={setInput}
          placeholder="Ask me anything..."
          placeholderTextColor={C.s400}
          multiline
          returnKeyType="send"
          onSubmitEditing={send}
          blurOnSubmit={false}
        />
        <TouchableOpacity onPress={send} disabled={loading} activeOpacity={0.8}>
          <LinearGradient
            colors={loading ? [C.t300, C.i300] : [C.t500, C.i500]}
            style={styles.sendBtn}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
          >
            <Text style={styles.sendTxt}>↑</Text>
          </LinearGradient>
        </TouchableOpacity>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  root:            { flex: 1, backgroundColor: C.s50 },
  messages:        { padding: 16, paddingBottom: 8, flexGrow: 1 },

  row:             { flexDirection: 'row', marginBottom: 10, gap: 8 },
  rowUser:         { justifyContent: 'flex-end' },
  rowAssistant:    { justifyContent: 'flex-start', alignItems: 'flex-end' },

  avatar:          { width: 32, height: 32, borderRadius: 10, backgroundColor: C.t50, alignItems: 'center', justifyContent: 'center', flexShrink: 0 },

  bubble:          { maxWidth: '78%', padding: 12, borderRadius: 18 },
  bubbleUser:      { backgroundColor: C.t700, borderBottomRightRadius: 4 },
  bubbleAssistant: { backgroundColor: C.white, borderBottomLeftRadius: 4, elevation: 1, shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.05, shadowRadius: 4 },
  typingBubble:    { paddingHorizontal: 16, paddingVertical: 14 },
  bubbleText:      { fontSize: 15, lineHeight: 22, color: C.s700 },
  bubbleTextUser:  { color: C.white },

  inputBar:        { flexDirection: 'row', padding: 12, paddingBottom: Platform.OS === 'ios' ? 28 : 12, marginBottom: Platform.OS === 'ios' ? 80 : 70, borderTopWidth: 1, borderTopColor: C.s200, gap: 8, backgroundColor: C.white, alignItems: 'flex-end' },
  input:           { flex: 1, borderWidth: 1, borderColor: C.s200, borderRadius: 14, paddingHorizontal: 14, paddingVertical: 10, fontSize: 15, maxHeight: 100, color: C.s700, backgroundColor: C.s50 },
  sendBtn:         { width: 42, height: 42, borderRadius: 13, alignItems: 'center', justifyContent: 'center' },
  sendTxt:         { color: C.white, fontWeight: '800', fontSize: 18 },
});
