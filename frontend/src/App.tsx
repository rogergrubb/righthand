import React from "react";
import { Graph3D } from "./Graph3D";
import { VoicePanel } from "./VoicePanel";

export function App() {
  return (
    <div style={{ position: "relative", width: "100vw", height: "100vh", overflow: "hidden" }}>
      <Graph3D />
      <VoicePanel />
      <div style={{
        position: "absolute", top: 16, left: 16, fontWeight: 600, letterSpacing: 4,
        fontSize: 12, opacity: 0.7
      }}>
        RIGHTHAND · v0.1
      </div>
    </div>
  );
}
