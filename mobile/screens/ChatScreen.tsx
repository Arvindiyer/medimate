import React, { useState, useRef } from "react";
import {
  View, Text, TextInput, TouchableOpacity, ScrollView,
  StyleSheet, KeyboardAvoidingView, Platform, ActivityIndicator,
} from "react-native";
import { sendChat } from "../services/api";

type Msg = { role: "user" | "assistant"; content: string };

const INITIAL: Msg = {
  role: "assistant",
  content: "Hi! I'm MediMate. How can I help you today? You can ask me about your medications, what to eat, or anything about your health routine.",
};

export default function ChatScreen() {
  const [messages, setMessages] = useState<Msg[]>([INITIAL]);
  const [input, setInput]       = useState("");
  const [loading, setLoading]   = useState(false);
  const scroll = useRef<ScrollView>(null);

  const send = async () => {
    if (!input.trim() || loading) return;
    const userMsg: Msg = { role: "user", content: input.trim() };
    const updated = [...messages, userMsg];
    setMessages(updated);
    setInput("");
    setLoading(true);

    try {
      const res = await sendChat(updated);
      setMessages([...updated, { role: "assistant", content: res.data.reply }]);
    } catch {
      setMessages([...updated, {
        role: "assistant",
        content: "Sorry, I couldn't connect to the server. Make sure the backend is running.",
      }]);
    } finally {
      setLoading(false);
      setTimeout(() => scroll.current?.scrollToEnd({ animated: true }), 100);
    }
  };

  return (
    <KeyboardAvoidingView
      style={{ flex: 1 }}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
      keyboardVerticalOffset={90}
    >
      <ScrollView
        ref={scroll}
        contentContainerStyle={styles.messages}
        onContentSizeChange={() => scroll.current?.scrollToEnd({ animated: true })}
      >
        {messages.map((m, i) => (
          <View key={i} style={[styles.bubble, m.role === "user" ? styles.user : styles.assistant]}>
            <Text style={[styles.bubbleText, m.role === "user" && styles.userText]}>
              {m.content}
            </Text>
          </View>
        ))}
        {loading && (
          <View style={[styles.bubble, styles.assistant]}>
            <ActivityIndicator size="small" color="#6b7280" />
          </View>
        )}
      </ScrollView>

      <View style={styles.inputRow}>
        <TextInput
          style={styles.input}
          value={input}
          onChangeText={setInput}
          placeholder="Ask me anything..."
          multiline
          returnKeyType="send"
          onSubmitEditing={send}
          blurOnSubmit={false}
        />
        <TouchableOpacity style={[styles.sendBtn, loading && styles.sendBtnDisabled]} onPress={send} disabled={loading}>
          <Text style={styles.sendText}>Send</Text>
        </TouchableOpacity>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  messages:       { padding: 16, paddingBottom: 8, flexGrow: 1 },
  bubble:         { maxWidth: "80%", padding: 12, borderRadius: 16, marginBottom: 10 },
  user:           { alignSelf: "flex-end", backgroundColor: "#22c55e" },
  assistant:      { alignSelf: "flex-start", backgroundColor: "#f1f5f9", minWidth: 48, alignItems: "center" },
  bubbleText:     { fontSize: 15, lineHeight: 22, color: "#1f2937" },
  userText:       { color: "#fff" },
  inputRow:       { flexDirection: "row", padding: 12, borderTopWidth: 1, borderColor: "#e5e7eb", gap: 8, backgroundColor: "#fff" },
  input:          { flex: 1, borderWidth: 1, borderColor: "#d1d5db", borderRadius: 12, padding: 10, fontSize: 15, maxHeight: 100 },
  sendBtn:        { backgroundColor: "#22c55e", borderRadius: 12, paddingHorizontal: 18, justifyContent: "center" },
  sendBtnDisabled:{ backgroundColor: "#86efac" },
  sendText:       { color: "#fff", fontWeight: "700" },
});
