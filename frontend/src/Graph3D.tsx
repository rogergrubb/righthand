import React, { useEffect, useRef, useState } from "react";
import ForceGraph3D from "3d-force-graph";
import SpriteText from "three-spritetext";
import * as THREE from "three";

/* ──────────────────────────────────────────────────────────────
   RIGHTHAND 3D System Visualization — Waterfall Hierarchy v4

   Claude Opus sits at the apex. Everything cascades downward
   through 5 tiers like a neural waterfall:

     T0  ORCHESTRATOR    — Claude Opus 4 (the crown)
     T1  BRAIN LAYER     — SDK, Router, Haiku, Tool Registry
     T2  SERVICE LAYER   — Voice, Schedule, Integrations
     T3  DATA LAYER      — Memory/RAG, Database + tables
     T4  PRESENTATION    — Frontend, 3D Graph, WebSocket

   Pulses ripple top-down. Every node labeled.
   ────────────────────────────────────────────────────────────── */

type SysNode = {
  id: string; label: string; kind: string; group: string; tier: number;
  size: number; col: number;
  x?: number; y?: number; z?: number;
  fx?: number; fy?: number; fz?: number;
  __pulse?: number; __pulseColor?: string;
  __sphereMat?: THREE.MeshLambertMaterial;
  __sprite?: any;
  __ringMat?: THREE.MeshBasicMaterial;
  __radius?: number;
};
type SysLink = { source: string; target: string; kind: string };

/* ── Tier colors (gradient from gold crown → cool blue base) ── */
const TIER_META: Record<number, { color: string; label: string; y: number }> = {
  0: { color: "#ffd700", label: "ORCHESTRATOR",  y: 200 },
  1: { color: "#c49fff", label: "BRAIN LAYER",   y: 110 },
  2: { color: "#4aa3ff", label: "SERVICE LAYER",  y: 10 },
  3: { color: "#44ddbb", label: "DATA LAYER",     y: -100 },
  4: { color: "#88aaff", label: "PRESENTATION",   y: -200 },
};

const KIND_COLOR: Record<string,string> = {
  ai: "#c49fff", api: "#4aa3ff", service: "#88aaff", database: "#44ddbb",
  table: "#66ccaa", data: "#7dd87d", task: "#ffd166", integration: "#ff5d8f",
  orchestrator: "#ffd700",
};

const GROUP_COLOR: Record<string,string> = {
  brain: "#c49fff", voice: "#4aa3ff", memory: "#7dd87d", graph: "#ffb020",
  schedule: "#ffd166", integrations: "#ff5d8f", database: "#44ddbb",
  frontend: "#88aaff",
};

/* ── Horizontal spread per tier ── */
const TIER_SPREAD = 45;  // x-spacing between nodes in same tier
const Z_JITTER = 25;     // depth variation for 3D feel

function buildTopology() {
  // col = horizontal position index within the tier (centered at 0)
  const mk = (id: string, label: string, kind: string, group: string, tier: number, size: number, col: number): SysNode => {
    const tierY = TIER_META[tier]?.y ?? 0;
    return {
      id, label, kind, group, tier, size, col,
      x: col * TIER_SPREAD,
      y: tierY + (Math.random() - 0.5) * 8,
      z: (Math.random() - 0.5) * Z_JITTER,
    };
  };

  const nodes: SysNode[] = [
    // ═══ TIER 0: THE CROWN ═══
    mk("brain-opus", "Claude Opus 4", "orchestrator", "brain", 0, 28, 0),

    // ═══ TIER 1: BRAIN LAYER ═══
    mk("brain-sdk",    "Agent SDK",      "ai",      "brain", 1, 16, -1.5),
    mk("brain-router", "Agent Router",   "service", "brain", 1, 14, -0.5),
    mk("brain-haiku",  "Claude Haiku",   "ai",      "brain", 1, 12, 0.5),
    mk("brain-tools",  "Tool Registry",  "service", "brain", 1, 10, 1.5),

    // ═══ TIER 2: SERVICE LAYER ═══
    // Voice cluster (left)
    mk("voice-rt",     "OpenAI Realtime", "api",         "voice",        2, 17, -4),
    mk("voice-bridge", "Voice Bridge",    "service",     "voice",        2, 12, -3),
    mk("voice-vad",    "Semantic VAD",    "service",     "voice",        2, 9,  -5),
    mk("voice-tts",    "TTS Engine",      "service",     "voice",        2, 10, -3.5),
    mk("voice-asr",    "Speech Recog",    "service",     "voice",        2, 10, -4.5),
    // Schedule cluster (center)
    mk("s-cron",  "APScheduler",   "service", "schedule", 2, 10, -0.5),
    mk("s-les",   "Lessons Daily", "task",    "schedule", 2, 13, 0.5),
    mk("s-tre",   "Trends Daily",  "task",    "schedule", 2, 13, 1.5),
    // Integrations cluster (right)
    mk("i-gh", "GitHub",  "integration", "integrations", 2, 13, 3),
    mk("i-gm", "Gmail",   "integration", "integrations", 2, 11, 4),
    mk("i-sl", "Slack",   "integration", "integrations", 2, 11, 5),
    mk("i-st", "Stripe",  "integration", "integrations", 2, 11, 3.5),
    mk("i-li", "Linear",  "integration", "integrations", 2, 9,  4.5),

    // ═══ TIER 3: DATA LAYER ═══
    // Memory cluster (left)
    mk("mem-pgv",    "pgvector",        "database", "memory",   3, 15, -3),
    mk("mem-emb",    "Embeddings",      "service",  "memory",   3, 11, -2),
    mk("mem-chunks", "Memory Chunks",   "data",     "memory",   3, 13, -4),
    mk("mem-recall", "Semantic Recall",  "service",  "memory",   3, 10, -2.5),
    // Database cluster (right)
    mk("db-pg",      "PostgreSQL",      "database", "database", 3, 20, 1),
    mk("db-users",   "users",           "table",    "database", 3, 6,  2.5),
    mk("db-conv",    "conversations",   "table",    "database", 3, 10, 3.5),
    mk("db-lessons", "lessons_learned", "table",    "database", 3, 13, 0),
    mk("db-trends",  "trend_reports",   "table",    "database", 3, 11, 4.5),
    mk("db-gn",      "graph_nodes",     "table",    "database", 3, 8,  2),
    mk("db-ge",      "graph_edges",     "table",    "database", 3, 6,  3),
    mk("db-mc",      "memory_chunks",   "table",    "database", 3, 10, -1),

    // ═══ TIER 4: PRESENTATION ═══
    mk("g3d",      "3D Force Graph",  "service", "graph",    4, 15, -2),
    mk("g-scan",   "File Scanner",    "service", "graph",    4, 11, -1),
    mk("g-watch",  "File Watcher",    "service", "graph",    4, 9,  -3),
    mk("g-ws",     "WebSocket Bus",   "service", "graph",    4, 11, 0),
    mk("fe-react", "React App",       "service", "frontend", 4, 13, 1.5),
    mk("fe-vite",  "Vite",            "service", "frontend", 4, 9,  2.5),
    mk("fe-vui",   "Voice Panel",     "service", "frontend", 4, 11, 3.5),
    mk("fe-gui",   "Graph Renderer",  "service", "frontend", 4, 11, -0.5),
  ];

  const links: SysLink[] = [
    // Crown → Brain
    { source: "brain-opus", target: "brain-sdk",    kind: "powers" },
    { source: "brain-opus", target: "brain-router",  kind: "powers" },
    { source: "brain-opus", target: "brain-haiku",   kind: "delegates" },
    { source: "brain-opus", target: "brain-tools",   kind: "powers" },
    // Brain internal
    { source: "brain-router", target: "brain-sdk",   kind: "routes" },
    { source: "brain-tools",  target: "brain-sdk",   kind: "provides" },
    // Brain → Service layer
    { source: "brain-router", target: "voice-bridge", kind: "sends" },
    { source: "brain-sdk",    target: "s-les",        kind: "calls" },
    { source: "brain-sdk",    target: "s-tre",        kind: "calls" },
    { source: "brain-tools",  target: "i-gh",         kind: "uses" },
    { source: "brain-tools",  target: "i-gm",         kind: "uses" },
    { source: "brain-tools",  target: "i-sl",         kind: "uses" },
    { source: "brain-tools",  target: "i-st",         kind: "uses" },
    { source: "brain-tools",  target: "i-li",         kind: "uses" },
    // Voice internal
    { source: "voice-rt",  target: "voice-bridge", kind: "streams" },
    { source: "voice-vad", target: "voice-rt",     kind: "detects" },
    { source: "voice-tts", target: "voice-rt",     kind: "speaks" },
    { source: "voice-asr", target: "voice-rt",     kind: "transcribes" },
    // Schedule internal
    { source: "s-cron", target: "s-les", kind: "triggers" },
    { source: "s-cron", target: "s-tre", kind: "triggers" },
    // Service → Data
    { source: "brain-haiku",  target: "mem-recall",  kind: "queries" },
    { source: "mem-recall",   target: "mem-pgv",     kind: "searches" },
    { source: "mem-emb",      target: "mem-chunks",  kind: "indexes" },
    { source: "mem-pgv",      target: "db-mc",       kind: "reads" },
    { source: "s-les",        target: "db-lessons",  kind: "writes" },
    { source: "s-tre",        target: "db-trends",   kind: "writes" },
    { source: "brain-router", target: "db-conv",     kind: "logs" },
    { source: "mem-chunks",   target: "db-pg",       kind: "stores" },
    // Database internal
    { source: "db-pg", target: "db-users",   kind: "has" },
    { source: "db-pg", target: "db-conv",    kind: "has" },
    { source: "db-pg", target: "db-lessons", kind: "has" },
    { source: "db-pg", target: "db-trends",  kind: "has" },
    { source: "db-pg", target: "db-gn",      kind: "has" },
    { source: "db-pg", target: "db-ge",      kind: "has" },
    { source: "db-pg", target: "db-mc",      kind: "has" },
    // Data → Presentation
    { source: "g-ws",    target: "fe-gui",     kind: "streams" },
    { source: "g3d",     target: "g-ws",       kind: "subscribes" },
    { source: "g-scan",  target: "g-ws",       kind: "emits" },
    { source: "g-watch", target: "g-scan",     kind: "triggers" },
    { source: "fe-react", target: "fe-vite",   kind: "built-by" },
    { source: "fe-vui",  target: "voice-bridge", kind: "connects" },
    { source: "fe-gui",  target: "g3d",        kind: "renders" },
  ];

  return { nodes, links };
}

const WS_URL = (import.meta.env.VITE_BACKEND_WS ?? "ws://localhost:8000") + "/ws/graph";

/* ── Hierarchy force: pins Y to tier, gently pulls X to column ── */
function forceHierarchy(nodes: SysNode[], yStrength = 0.35, xStrength = 0.08) {
  return (alpha: number) => {
    for (const n of nodes) {
      const tierY = TIER_META[n.tier]?.y ?? 0;
      const targetX = n.col * TIER_SPREAD;
      // Strong Y pinning (hierarchy)
      n.y = (n.y ?? 0) + (tierY - (n.y ?? 0)) * alpha * yStrength;
      // Gentle X guidance (layout)
      n.x = (n.x ?? 0) + (targetX - (n.x ?? 0)) * alpha * xStrength;
      // Very light Z centering
      n.z = (n.z ?? 0) * (1 - alpha * 0.02);
    }
  };
}

export function Graph3D() {
  const mountRef = useRef<HTMLDivElement>(null);
  const [status, setStatus] = useState("initializing...");

  useEffect(() => {
    if (!mountRef.current) return;
    const el = mountRef.current;
    let graph: any;

    try {
      const { nodes, links } = buildTopology();
      const nodeMap = new Map(nodes.map(n => [n.id, n]));

      graph = ForceGraph3D()(el)
        .backgroundColor("#060a12")
        .width(el.clientWidth)
        .height(el.clientHeight)
        .graphData({ nodes, links })
        .dagMode(null) // we handle hierarchy ourselves

        /* ── Node: sphere + glow ring + label ── */
        .nodeThreeObject((node: any) => {
          const group = new THREE.Group();
          const baseColor = node.id === "brain-opus"
            ? "#ffd700"
            : (KIND_COLOR[node.kind] ?? GROUP_COLOR[node.group] ?? "#88aaff");
          const radius = node.id === "brain-opus"
            ? Math.pow(node.size, 0.6) * 1.8
            : Math.pow(node.size ?? 8, 0.6) * 1.1;

          // Main sphere
          const geo = new THREE.SphereGeometry(radius, 24, 24);
          const mat = new THREE.MeshLambertMaterial({
            color: baseColor,
            transparent: true,
            opacity: 0.93,
            emissive: baseColor,
            emissiveIntensity: node.id === "brain-opus" ? 0.6 : 0.3,
          });
          group.add(new THREE.Mesh(geo, mat));

          // Outer glow ring
          const ringGeo = new THREE.RingGeometry(radius * 1.3, radius * 1.9, 32);
          const ringMat = new THREE.MeshBasicMaterial({
            color: baseColor,
            transparent: true,
            opacity: node.id === "brain-opus" ? 0.15 : 0.06,
            side: THREE.DoubleSide,
          });
          const ring = new THREE.Mesh(ringGeo, ringMat);
          ring.lookAt(0, 0, 1);
          group.add(ring);

          // Crown gets a second larger halo
          if (node.id === "brain-opus") {
            const halo2Geo = new THREE.RingGeometry(radius * 2.2, radius * 3.0, 48);
            const halo2Mat = new THREE.MeshBasicMaterial({
              color: "#ffd700",
              transparent: true,
              opacity: 0.06,
              side: THREE.DoubleSide,
            });
            const halo2 = new THREE.Mesh(halo2Geo, halo2Mat);
            halo2.lookAt(0, 0, 1);
            group.add(halo2);
          }

          // Persistent text label
          const fontSize = node.id === "brain-opus" ? 4.5 : 3.2;
          const sprite = new SpriteText(node.label, fontSize, baseColor);
          sprite.fontWeight = node.tier <= 1 ? "700" : "600";
          sprite.backgroundColor = "rgba(0,0,0,0.6)";
          sprite.padding = 1.5;
          sprite.borderRadius = 2;
          (sprite as any).position.set(0, -(radius + 5.5), 0);
          group.add(sprite);

          // Store refs for animation
          node.__sphereMat = mat;
          node.__sprite = sprite;
          node.__ringMat = ringMat;
          node.__radius = radius;
          node.__baseColor = baseColor;

          return group;
        })
        .nodeThreeObjectExtend(false)

        /* ── Links ── */
        .linkColor((l: any) => {
          const s: any = typeof l.source === "object" ? l.source : null;
          const t: any = typeof l.target === "object" ? l.target : null;
          const now = Date.now();
          const active = (s?.__pulse && now - s.__pulse < 1400) ||
                         (t?.__pulse && now - t.__pulse < 1400);
          if (active) return "#ffffff99";
          // Tier-based link color: higher tiers = warmer
          const tier = Math.min(s?.tier ?? 4, t?.tier ?? 4);
          return TIER_META[tier]
            ? `${TIER_META[tier].color}22`
            : "rgba(100,150,240,0.12)";
        })
        .linkWidth((l: any) => {
          const s: any = typeof l.source === "object" ? l.source : null;
          const t: any = typeof l.target === "object" ? l.target : null;
          const now = Date.now();
          const active = (s?.__pulse && now - s.__pulse < 1400) ||
                         (t?.__pulse && now - t.__pulse < 1400);
          // Crown links are thicker
          const isCrown = s?.id === "brain-opus" || t?.id === "brain-opus";
          return active ? 3.0 : (isCrown ? 0.8 : 0.45);
        })
        .linkDirectionalParticles((l: any) => {
          const s: any = typeof l.source === "object" ? l.source : null;
          const t: any = typeof l.target === "object" ? l.target : null;
          const now = Date.now();
          const active = (s?.__pulse && now - s.__pulse < 2200) ||
                         (t?.__pulse && now - t.__pulse < 2200);
          return active ? 6 : 0;
        })
        .linkDirectionalParticleWidth(2.5)
        .linkDirectionalParticleSpeed(0.018)
        .linkDirectionalParticleColor(() => "#ffffffcc")
        .linkOpacity(0.6)

        /* ── Physics ── */
        .d3AlphaDecay(0.01)
        .d3VelocityDecay(0.45)
        .warmupTicks(160)
        .cooldownTime(6000);

      // Hierarchy force (strong Y pinning to tiers)
      graph.d3Force("hierarchy", forceHierarchy(nodes, 0.4, 0.1));
      // Weak charge so nodes don't fly apart
      graph.d3Force("charge")?.strength(-20);
      // Short links within same tier, longer across tiers
      graph.d3Force("link")?.distance((l: any) => {
        const s = typeof l.source === "object" ? l.source : nodeMap.get(l.source);
        const t = typeof l.target === "object" ? l.target : nodeMap.get(l.target);
        if (s?.tier === t?.tier) return 30;
        return 60 + Math.abs((s?.tier ?? 0) - (t?.tier ?? 0)) * 15;
      });

      // Camera: start elevated looking down at the hierarchy
      setTimeout(() => graph.cameraPosition(
        { x: 0, y: 350, z: 450 }, { x: 0, y: 0, z: 0 }, 3000
      ), 300);

      // Slow orbit — slightly elevated to show hierarchy
      let angle = 0;
      const rotateLoop = setInterval(() => {
        if (!graph) return;
        angle += 0.001;
        const d = 480;
        graph.cameraPosition({
          x: d * Math.sin(angle),
          y: 200 + 50 * Math.sin(angle * 0.3),
          z: d * Math.cos(angle),
        });
      }, 50);

      /* ── WebSocket for live pulses ── */
      let ws: WebSocket | null = null;
      try {
        ws = new WebSocket(WS_URL);
        ws.onopen = () => setStatus("live");
        ws.onmessage = (ev) => {
          try {
            const msg = JSON.parse(ev.data);
            if (msg.type === "pulse") {
              const gd = graph.graphData();
              const tgt = gd.nodes.find((n: any) =>
                n.id === msg.node_id ||
                n.label?.toLowerCase().includes((msg.label ?? "").toLowerCase().slice(0, 12))
              );
              if (tgt) {
                tgt.__pulse = Date.now();
                tgt.__pulseColor = tgt.__baseColor ?? "#ffffff";
              }
              // Always pulse the crown
              const crown = gd.nodes.find((n: any) => n.id === "brain-opus");
              if (crown) { crown.__pulse = Date.now(); crown.__pulseColor = "#ffd700"; }
            }
          } catch { }
        };
        ws.onerror = () => setStatus("ws error");
        ws.onclose = () => setStatus("disconnected");
      } catch { setStatus("offline"); }

      /* ── Pulse animation loop ── */
      const pulseLoop = setInterval(() => {
        if (!graph) return;
        const gd = graph.graphData();
        const now = Date.now();
        for (const n of gd.nodes) {
          if (!n.__sphereMat) continue;
          const isPulsing = n.__pulse && now - n.__pulse < 1500;
          const base = n.__baseColor ?? "#88aaff";
          const flash = isPulsing && now - n.__pulse < 350;
          const color = flash ? "#ffffff" : base;

          n.__sphereMat.color.set(color);
          n.__sphereMat.emissive.set(color);
          n.__sphereMat.emissiveIntensity = isPulsing ? 0.9 : (n.id === "brain-opus" ? 0.6 : 0.3);
          n.__sphereMat.opacity = isPulsing ? 1.0 : 0.93;

          if (n.__ringMat) {
            n.__ringMat.color.set(color);
            n.__ringMat.opacity = isPulsing ? 0.3 : (n.id === "brain-opus" ? 0.15 : 0.06);
          }
          if (n.__sprite) {
            n.__sprite.color = flash ? "#ffffff" : base;
          }
        }
        graph.linkColor(graph.linkColor());
        graph.linkWidth(graph.linkWidth());
        graph.linkDirectionalParticles(graph.linkDirectionalParticles());
      }, 70);

      /* ── Cascade demo pulses (top-down waterfall) ── */
      const demoLoop = setInterval(() => {
        const gd = graph.graphData();
        if (!gd.nodes.length) return;

        // Start from the crown and cascade down
        const crown = gd.nodes.find((n: any) => n.id === "brain-opus");
        if (crown) { crown.__pulse = Date.now(); crown.__pulseColor = "#ffd700"; }

        // Pick a random path downward through tiers
        const tier1 = gd.nodes.filter((n: any) => n.tier === 1);
        const t1pick = tier1[Math.floor(Math.random() * tier1.length)];
        if (t1pick) {
          setTimeout(() => { t1pick.__pulse = Date.now(); t1pick.__pulseColor = t1pick.__baseColor; }, 200);
        }

        const tier2 = gd.nodes.filter((n: any) => n.tier === 2);
        const t2picks = [
          tier2[Math.floor(Math.random() * tier2.length)],
          tier2[Math.floor(Math.random() * tier2.length)],
        ];
        t2picks.forEach((n, i) => {
          if (n) setTimeout(() => { n.__pulse = Date.now(); n.__pulseColor = n.__baseColor; }, 400 + i * 100);
        });

        const tier3 = gd.nodes.filter((n: any) => n.tier === 3);
        const t3pick = tier3[Math.floor(Math.random() * tier3.length)];
        if (t3pick) {
          setTimeout(() => { t3pick.__pulse = Date.now(); t3pick.__pulseColor = t3pick.__baseColor; }, 700);
        }

        const tier4 = gd.nodes.filter((n: any) => n.tier === 4);
        const t4pick = tier4[Math.floor(Math.random() * tier4.length)];
        if (t4pick) {
          setTimeout(() => { t4pick.__pulse = Date.now(); t4pick.__pulseColor = t4pick.__baseColor; }, 950);
        }
      }, 3000);

      setStatus("live");

      const handleResize = () => {
        if (el && graph) graph.width(el.clientWidth).height(el.clientHeight);
      };
      window.addEventListener("resize", handleResize);

      return () => {
        window.removeEventListener("resize", handleResize);
        clearInterval(rotateLoop);
        clearInterval(pulseLoop);
        clearInterval(demoLoop);
        ws?.close();
      };
    } catch (e) {
      console.error("Graph3D fatal:", e);
      setStatus("failed");
    }
  }, []);

  return (
    <div ref={mountRef} style={{ width: "100%", height: "100%", position: "relative" }}>
      {/* ── Tier legend (left side, vertical) ── */}
      <div style={{
        position: "absolute", top: 60, left: 14, padding: "10px 14px",
        zIndex: 999, pointerEvents: "none",
        background: "rgba(6,10,18,0.75)", borderRadius: 10,
        backdropFilter: "blur(8px)", border: "1px solid rgba(255,255,255,0.06)",
      }}>
        {Object.entries(TIER_META).map(([tier, meta]) => (
          <div key={tier} style={{
            fontSize: 9, fontWeight: 700, letterSpacing: 2.5,
            color: meta.color, opacity: 0.8, marginBottom: 10,
            textTransform: "uppercase",
            textShadow: `0 0 8px ${meta.color}44`,
          }}>
            <span style={{
              display: "inline-block", width: 14, height: 2,
              backgroundColor: meta.color, marginRight: 8, verticalAlign: "middle",
              boxShadow: `0 0 6px ${meta.color}`,
            }} />
            T{tier} · {meta.label}
          </div>
        ))}
      </div>

      {/* ── Title ── */}
      <div style={{
        position: "absolute", top: 14, left: 18,
        zIndex: 999, pointerEvents: "none",
        fontSize: 11, fontWeight: 700, letterSpacing: 6,
        color: "rgba(255,255,255,0.5)", textTransform: "uppercase",
      }}>
        RIGHTHAND · SYSTEM HIERARCHY
      </div>

      {/* ── Status indicator ── */}
      <div style={{
        position: "absolute", bottom: 8, right: 12,
        fontSize: 10, opacity: 0.4, pointerEvents: "none", zIndex: 999,
        color: status === "live" ? "#7dd87d" : "#ff5d8f",
      }}>
        ● {status}
      </div>
    </div>
  );
}
