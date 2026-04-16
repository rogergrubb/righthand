import React, { useRef, useState } from "react";

const WS_URL =
  (import.meta.env.VITE_BACKEND_WS ?? "ws://localhost:8000") + "/ws/voice";

export function VoicePanel() {
  const [state, setState] = useState<"idle" | "connecting" | "live" | "error">("idle");
  const [caption, setCaption] = useState<string>("");
  const [errorMsg, setErrorMsg] = useState<string>("");
  const wsRef = useRef<WebSocket | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const ctxRef = useRef<AudioContext | null>(null);
  const playerRef = useRef<AudioContext | null>(null);
  const processorRef = useRef<ScriptProcessorNode | null>(null);

  async function start() {
    setState("connecting");
    setErrorMsg("");

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;

      const ws = new WebSocket(WS_URL);
      ws.binaryType = "arraybuffer";
      wsRef.current = ws;

      ws.onopen = () => {
        setState("live");

        const ctx = new AudioContext({ sampleRate: 24000 });
        ctxRef.current = ctx;
        const source = ctx.createMediaStreamSource(stream);
        const processor = ctx.createScriptProcessor(2048, 1, 1);
        processorRef.current = processor;
        source.connect(processor);
        processor.connect(ctx.destination);

        processor.onaudioprocess = (ev) => {
          const input = ev.inputBuffer.getChannelData(0);
          const pcm = new Int16Array(input.length);
          for (let i = 0; i < input.length; i++) {
            const s = Math.max(-1, Math.min(1, input[i]));
            pcm[i] = s < 0 ? s * 0x8000 : s * 0x7fff;
          }
          if (ws.readyState === WebSocket.OPEN) {
            ws.send(pcm.buffer);
          }
        };

        playerRef.current = new AudioContext({ sampleRate: 24000 });
      };

      ws.onmessage = (ev) => {
        if (typeof ev.data === "string") {
          try {
            const j = JSON.parse(ev.data);
            if (j.type === "response.audio_transcript.delta") {
              setCaption((c) => (c + (j.delta ?? "")).slice(-280));
            } else if (j.type === "response.done") {
              setCaption("");
            }
          } catch { /* ignore */ }
          return;
        }
        // Binary: pcm16 audio from OpenAI → play it
        try {
          const player = playerRef.current;
          if (!player) return;
          const buf = new Int16Array(ev.data as ArrayBuffer);
          const f32 = new Float32Array(buf.length);
          for (let i = 0; i < buf.length; i++) f32[i] = buf[i] / 0x8000;
          const audioBuf = player.createBuffer(1, f32.length, 24000);
          audioBuf.getChannelData(0).set(f32);
          const src = player.createBufferSource();
          src.buffer = audioBuf;
          src.connect(player.destination);
          src.start();
        } catch (e) {
          console.warn("audio playback error:", e);
        }
      };

      ws.onerror = (e) => {
        console.error("voice ws error:", e);
        setErrorMsg("Voice connection failed. Check console.");
        setState("error");
      };

      ws.onclose = () => {
        if (state !== "idle") setState("idle");
      };
    } catch (e: any) {
      console.error("start() error:", e);
      setErrorMsg(e?.message ?? "Failed to start voice");
      setState("error");
    }
  }

  function stop() {
    processorRef.current?.disconnect();
    wsRef.current?.close();
    streamRef.current?.getTracks().forEach((t) => t.stop());
    ctxRef.current?.close().catch(() => {});
    playerRef.current?.close().catch(() => {});
    setState("idle");
    setCaption("");
  }

  return (
    <div
      style={{
        position: "absolute",
        bottom: 32,
        left: "50%",
        transform: "translateX(-50%)",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        gap: 12,
        zIndex: 10,
      }}
    >
      {errorMsg && (
        <div style={{
          padding: "8px 14px", background: "rgba(255,60,60,0.25)", borderRadius: 12,
          maxWidth: 680, textAlign: "center", fontSize: 13, color: "#ff9999"
        }}>
          {errorMsg}
        </div>
      )}
      {caption && (
        <div style={{
          padding: "8px 14px", background: "rgba(0,0,0,0.55)", borderRadius: 12,
          maxWidth: 680, textAlign: "center", fontSize: 14, lineHeight: 1.4
        }}>
          {caption}
        </div>
      )}
      <button
        onClick={state === "idle" || state === "error" ? start : stop}
        style={{
          padding: "14px 28px",
          borderRadius: 999,
          background: state === "live" ? "#ff5d5d" : state === "error" ? "#ff9933" : "#4aa3ff",
          color: "white",
          border: 0,
          fontSize: 15,
          fontWeight: 600,
          letterSpacing: 1,
          cursor: "pointer",
          boxShadow: "0 12px 40px rgba(74,163,255,0.35)",
        }}
      >
        {state === "idle" ? "TALK" : state === "connecting" ? "..." : state === "error" ? "RETRY" : "END"}
      </button>
    </div>
  );
}
