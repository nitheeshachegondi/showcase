"use client";

import { useRef, useState } from "react";

/**
 * Small dictation button using the browser's built-in speech recognition (Chrome, Edge, Safari).
 * Wispr Flow works in any text box too, so this is only a convenience fallback.
 */
export default function Mic({ onText, onError }: { onText: (t: string) => void; onError?: (m: string) => void }) {
  const [on, setOn] = useState(false);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const ref = useRef<any>(null);

  function toggle() {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const w = window as any;
    const SR = w.SpeechRecognition || w.webkitSpeechRecognition;
    if (!SR) {
      onError?.("This browser has no built-in dictation. Use Wispr Flow in the text box instead; it works in any field.");
      return;
    }
    if (on) {
      ref.current?.stop();
      return;
    }
    const r = new SR();
    r.continuous = true;
    r.interimResults = false;
    r.lang = "en-IN";
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    r.onresult = (ev: any) => {
      let t = "";
      for (let i = ev.resultIndex; i < ev.results.length; i++) if (ev.results[i].isFinal) t += ev.results[i][0].transcript + " ";
      if (t.trim()) onText(t.trim());
    };
    r.onend = () => setOn(false);
    r.onerror = () => setOn(false);
    ref.current = r;
    r.start();
    setOn(true);
  }

  return (
    <button type="button" className="btn sm" onClick={toggle} style={on ? { color: "var(--no)", borderColor: "var(--no)" } : undefined}>
      {on ? "● Stop" : "🎙 Speak"}
    </button>
  );
}
