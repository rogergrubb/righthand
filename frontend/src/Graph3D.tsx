import React, { useEffect, useRef, useState } from "react";
import ForceGraph3D from "3d-force-graph";
import SpriteText from "three-spritetext";
import * as THREE from "three";

/* ──────────────────────────────────────────────────────────────
   RIGHTHAND 3D System Visualization — Waterfall v6

   Big orbs, deep 3D (sub-clusters staggered in Z),
   crown "RIGHTHAND" at apex, everything fits viewport.
   ────────────────────────────────────────────────────────────── */

type SysNode = {
  id: string; label: string; kind: string; group: string; tier: number;
  size: number;
  x?: number; y?: number; z?: number;
  fx?: number; fy?: number; fz?: number;
  __pulse?: number; __pulseColor?: string;
  __sphereMat?: THREE.MeshLambertMaterial;
  __sprite?: any;
  __ringMat?: THREE.MeshBasicMaterial;
  __radius?: number;
  __baseColor?: string;
};
type SysLink = { source: string; target: string; kind: string };

const TIER_META: Record<number, { color: string; label: string }> = {
  0: { color: "#ffd700", label: "ORCHESTRATOR" },
  1: { color: "#c49fff", label: "BRAIN LAYER" },
  2: { color: "#4aa3ff", label: "SERVICE LAYER" },
  3: { color: "#44ddbb", label: "DATA LAYER" },
  4: { color: "#88aaff", label: "PRESENTATION" },
};

const KIND_COLOR: Record<string, string> = {
  ai: "#c49fff", api: "#4aa3ff", service: "#88aaff", database: "#44ddbb",
  table: "#66ccaa", data: "#7dd87d", task: "#ffd166", integration: "#ff5d8f",
  orchestrator: "#ffd700",
};
const GROUP_COLOR: Record<string, string> = {
  brain: "#c49fff", voice: "#4aa3ff", memory: "#7dd87d", graph: "#ffb020",
  schedule: "#ffd166", integrations: "#ff5d8f", database: "#44ddbb",
  frontend: "#88aaff",
};

/* ── Orb sizing ── */
const ORB_RADIUS = 8;       // regular orbs (chunky & visible)
const CROWN_RADIUS = 16;    // crown = 2x regular

function buildTopology() {
  // Each node gets explicit x, y, z for true 3D positioning
  const mk = (id: string, label: string, kind: string, group: string,
              tier: number, x: number, y: number, z: number): SysNode => ({
    id, label, kind, group, tier, size: 12, x, y, z,
  });

  // Y tiers spaced 100 apart, centered around 0
  // X spread wide, Z staggered per sub-cluster for real depth
  const nodes: SysNode[] = [
    // ═══ T0: CROWN — center top ═══
    mk("brain-opus", "RIGHTHAND", "orchestrator", "brain", 0,   0, 200, 0),

    // ═══ T1: BRAIN — spread horizontally ═══
    mk("brain-sdk",    "Agent SDK",     "ai",      "brain", 1,  -80, 100, -20),
    mk("brain-router", "Agent Router",  "service", "brain", 1,  -25, 100,  15),
    mk("brain-haiku",  "Claude Haiku",  "ai",      "brain", 1,   25, 100, -15),
    mk("brain-tools",  "Tool Registry", "service", "brain", 1,   80, 100,  20),

    // ═══ T2: SERVICES — 3 sub-clusters staggered in Z ═══
    // Voice (left, pushed FORWARD in z)
    mk("voice-rt",     "OpenAI Realtime", "api",     "voice",  2,  -200, 0,  80),
    mk("voice-bridge", "Voice Bridge",    "service", "voice",  2,  -150, 0,  100),
    mk("voice-vad",    "Semantic VAD",    "service", "voice",  2,  -250, 0,  60),
    mk("voice-tts",    "TTS Engine",      "service", "voice",  2,  -180,-10, 120),
    mk("voice-asr",    "Speech Recog",    "service", "voice",  2,  -220,-10, 40),
    // Schedule (center, at Z=0)
    mk("s-cron", "APScheduler",   "service", "schedule", 2,   -20, 0,  0),
    mk("s-les",  "Lessons Daily", "task",    "schedule", 2,    30, 0, -15),
    mk("s-tre",  "Trends Daily",  "task",    "schedule", 2,    80, 0,  15),
    // Integrations (right, pushed BACK in z)
    mk("i-gh", "GitHub",  "integration", "integrations", 2,   180, 0, -80),
    mk("i-gm", "Gmail",   "integration", "integrations", 2,   230, 0, -60),
    mk("i-sl", "Slack",   "integration", "integrations", 2,   280, 0, -100),
    mk("i-st", "Stripe",  "integration", "integrations", 2,   200,-10, -40),
    mk("i-li", "Linear",  "integration", "integrations", 2,   250,-10, -120),

    // ═══ T3: DATA — 2 sub-clusters, Z-staggered ═══
    // Memory (left, forward)
    mk("mem-pgv",    "pgvector",       "database", "memory",   3, -160, -120,  60),
    mk("mem-emb",    "Embeddings",     "service",  "memory",   3, -110, -120,  40),
    mk("mem-chunks", "Memory Chunks",  "data",     "memory",   3, -200, -130,  80),
    mk("mem-recall", "Semantic Recall", "service",  "memory",   3, -140, -130,  30),
    // Database (right, back)
    mk("db-pg",      "PostgreSQL",      "database", "database", 3,   50, -120, -50),
    mk("db-users",   "users",           "table",    "database", 3,  130, -120, -70),
    mk("db-conv",    "conversations",   "table",    "database", 3,  180, -130, -40),
    mk("db-lessons", "lessons_learned", "table",    "database", 3,   10, -130, -30),
    mk("db-trends",  "trend_reports",   "table",    "database", 3,  230, -120, -90),
    mk("db-gn",      "graph_nodes",     "table",    "database", 3,  100, -130, -60),
    mk("db-ge",      "graph_edges",     "table",    "database", 3,  160, -140, -80),
    mk("db-mc",      "memory_chunks",   "table",    "database", 3,  -50, -130, -20),

    // ═══ T4: PRESENTATION — spread wide, z-varied ═══
    mk("g3d",      "3D Force Graph", "service", "graph",    4, -150, -240,  30),
    mk("g-scan",   "File Scanner",   "service", "graph",    4,  -70, -240, -20),
    mk("g-watch",  "File Watcher",   "service", "graph",    4, -200, -250,  50),
    mk("g-ws",     "WebSocket Bus",  "service", "graph",    4,    0, -240,   0),
    mk("fe-react", "React App",      "service", "frontend", 4,   80, -240,  40),
    mk("fe-vite",  "Vite",           "service", "frontend", 4,  160, -250, -30),
    mk("fe-vui",   "Voice Panel",    "service", "frontend", 4,  220, -240,  60),
    mk("fe-gui",   "Graph Renderer", "service", "frontend", 4,   30, -250, -40),
  ];

  const links: SysLink[] = [
    // Crown → Brain
    { source: "brain-opus", target: "brain-sdk",     kind: "powers" },
    { source: "brain-opus", target: "brain-router",   kind: "powers" },
    { source: "brain-opus", target: "brain-haiku",    kind: "delegates" },
    { source: "brain-opus", target: "brain-tools",    kind: "powers" },
    // Brain internal
    { source: "brain-router", target: "brain-sdk",    kind: "routes" },
    { source: "brain-tools",  target: "brain-sdk",    kind: "provides" },
    // Brain → Service
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
    { source: "g-ws",     target: "fe-gui",       kind: "streams" },
    { source: "g3d",      target: "g-ws",         kind: "subscribes" },
    { source: "g-scan",   target: "g-ws",         kind: "emits" },
    { source: "g-watch",  target: "g-scan",       kind: "triggers" },
    { source: "fe-react", target: "fe-vite",      kind: "built-by" },
    { source: "fe-vui",   target: "voice-bridge", kind: "connects" },
    { source: "fe-gui",   target: "g3d",          kind: "renders" },
  ];

  return { nodes, links };
}

const WS_URL = (import.meta.env.VITE_BACKEND_WS ?? "ws://localhost:8000") + "/ws/graph";

/* ── Soft position-pinning force: holds nodes near their assigned spots ── */
function forcePin(nodes: SysNode[], strength = 0.06) {
  // Save original positions
  const origins = new Map<string, { x: number; y: number; z: number }>();
  for (const n of nodes) {
    origins.set(n.id, { x: n.x ?? 0, y: n.y ?? 0, z: n.z ?? 0 });
  }
  return (alpha: number) => {
    for (const n of nodes) {
      const o = origins.get(n.id);
      if (!o) continue;
      const k = alpha * strength;
      n.x = (n.x ?? 0) + (o.x - (n.x ?? 0)) * k;
      n.y = (n.y ?? 0) + (o.y - (n.y ?? 0)) * k;
      n.z = (n.z ?? 0) + (o.z - (n.z ?? 0)) * k;
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

        /* ── Node: orb + glow ring + label ── */
        .nodeThreeObject((node: any) => {
          const grp = new THREE.Group();
          const isCrown = node.id === "brain-opus";
          const baseColor = isCrown
            ? "#ffd700"
            : (KIND_COLOR[node.kind] ?? GROUP_COLOR[node.group] ?? "#88aaff");
          const radius = isCrown ? CROWN_RADIUS : ORB_RADIUS;

          // Sphere
          const geo = new THREE.SphereGeometry(radius, 24, 24);
          const mat = new THREE.MeshLambertMaterial({
            color: baseColor, transparent: true, opacity: 0.92,
            emissive: baseColor, emissiveIntensity: isCrown ? 0.55 : 0.3,
          });
          grp.add(new THREE.Mesh(geo, mat));

          // Glow ring
          const ringGeo = new THREE.RingGeometry(radius * 1.3, radius * 1.7, 32);
          const ringMat = new THREE.MeshBasicMaterial({
            color: baseColor, transparent: true,
            opacity: isCrown ? 0.12 : 0.05, side: THREE.DoubleSide,
          });
          const ring = new THREE.Mesh(ringGeo, ringMat);
          ring.lookAt(0, 0, 1);
          grp.add(ring);

          // Crown outer halo
          if (isCrown) {
            const hGeo = new THREE.RingGeometry(radius * 1.8, radius * 2.3, 48);
            const hMat = new THREE.MeshBasicMaterial({
              color: "#ffd700", transparent: true, opacity: 0.05, side: THREE.DoubleSide,
            });
            const h = new THREE.Mesh(hGeo, hMat);
            h.lookAt(0, 0, 1);
            grp.add(h);
          }

          // Label
          const sprite = new SpriteText(node.label, isCrown ? 5 : 3.5, baseColor);
          sprite.fontWeight = "600";
          sprite.backgroundColor = "rgba(0,0,0,0.55)";
          sprite.padding = 1.5;
          sprite.borderRadius = 2;
          (sprite as any).position.set(0, -(radius + 10), 0);
          grp.add(sprite);

          // Store refs
          node.__sphereMat = mat;
          node.__sprite = sprite;
          node.__ringMat = ringMat;
          node.__radius = radius;
          node.__baseColor = baseColor;

          return grp;
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
          const tier = Math.min(s?.tier ?? 4, t?.tier ?? 4);
          return TIER_META[tier]
            ? `${TIER_META[tier].color}25`
            : "rgba(100,150,240,0.12)";
        })
        .linkWidth((l: any) => {
          const s: any = typeof l.source === "object" ? l.source : null;
          const t: any = typeof l.target === "object" ? l.target : null;
          const now = Date.now();
          const active = (s?.__pulse && now - s.__pulse < 1400) ||
                         (t?.__pulse && now - t.__pulse < 1400);
          return active ? 2.5 : 0.5;
        })
        .linkDirectionalParticles((l: any) => {
          const s: any = typeof l.source === "object" ? l.source : null;
          const t: any = typeof l.target === "object" ? l.target : null;
          const now = Date.now();
          const active = (s?.__pulse && now - s.__pulse < 2200) ||
                         (t?.__pulse && now - t.__pulse < 2200);
          return active ? 5 : 0;
        })
        .linkDirectionalParticleWidth(2.0)
        .linkDirectionalParticleSpeed(0.015)
        .linkDirectionalParticleColor(() => "#ffffffcc")
        .linkOpacity(0.6)

        /* ── Physics ── */
        .d3AlphaDecay(0.015)
        .d3VelocityDecay(0.5)
        .warmupTicks(200)
        .cooldownTime(5000);

      // Soft pin force — keeps nodes near assigned positions but allows organic drift
      graph.d3Force("pin", forcePin(nodes, 0.08));
      // Repulsion so nodes don't overlap
      graph.d3Force("charge")?.strength(-80);
      // Link distances
      graph.d3Force("link")?.distance((l: any) => {
        const s = typeof l.source === "object" ? l.source : nodeMap.get(l.source);
        const t = typeof l.target === "object" ? l.target : nodeMap.get(l.target);
        return (s?.tier === t?.tier) ? 50 : 90;
      });

      // Camera — angled to show depth (3D feel)
      const hierCenter = { x: 20, y: -20, z: 0 };
      setTimeout(() => graph.cameraPosition(
        { x: 200, y: 180, z: 550 }, hierCenter, 3000
      ), 300);

      // Orbit — varies elevation to show 3D depth
      let angle = 0;
      const rotateLoop = setInterval(() => {
        if (!graph) return;
        angle += 0.0008;
        const d = 580;
        graph.cameraPosition({
          x: d * Math.sin(angle) * 0.8,
          y: 120 + 80 * Math.sin(angle * 0.4),
          z: d * Math.cos(angle),
        }, hierCenter);
      }, 50);

      /* ── WebSocket ── */
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
              const crown = gd.nodes.find((n: any) => n.id === "brain-opus");
              if (crown) { crown.__pulse = Date.now(); crown.__pulseColor = "#ffd700"; }
            }
          } catch { }
        };
        ws.onerror = () => setStatus("ws error");
        ws.onclose = () => setStatus("disconnected");
      } catch { setStatus("offline"); }

      /* ── Pulse animation ── */
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
          n.__sphereMat.emissiveIntensity = isPulsing ? 0.85 : (n.id === "brain-opus" ? 0.55 : 0.3);
          n.__sphereMat.opacity = isPulsing ? 1.0 : 0.92;
          if (n.__ringMat) {
            n.__ringMat.color.set(color);
            n.__ringMat.opacity = isPulsing ? 0.25 : (n.id === "brain-opus" ? 0.12 : 0.05);
          }
          if (n.__sprite) {
            n.__sprite.color = flash ? "#ffffff" : base;
          }
        }
        graph.linkColor(graph.linkColor());
        graph.linkWidth(graph.linkWidth());
        graph.linkDirectionalParticles(graph.linkDirectionalParticles());
      }, 70);

      /* ── Cascade demo pulses ── */
      const demoLoop = setInterval(() => {
        const gd = graph.graphData();
        if (!gd.nodes.length) return;
        const crown = gd.nodes.find((n: any) => n.id === "brain-opus");
        if (crown) { crown.__pulse = Date.now(); crown.__pulseColor = "#ffd700"; }
        [1, 2, 3, 4].forEach((tier, ti) => {
          const tierNodes = gd.nodes.filter((n: any) => n.tier === tier);
          const picks = Math.min(tierNodes.length, 1 + Math.floor(Math.random() * 2));
          for (let i = 0; i < picks; i++) {
            const n = tierNodes[Math.floor(Math.random() * tierNodes.length)];
            if (n) {
              const delay = 250 * (ti + 1) + i * 80;
              setTimeout(() => { n.__pulse = Date.now(); n.__pulseColor = n.__baseColor; }, delay);
            }
          }
        });
      }, 3500);

      setStatus("live");
      const handleResize = () => { if (el && graph) graph.width(el.clientWidth).height(el.clientHeight); };
      window.addEventListener("resize", handleResize);
      return () => {
        window.removeEventListener("resize", handleResize);
        clearInterval(rotateLoop); clearInterval(pulseLoop); clearInterval(demoLoop);
        ws?.close();
      };
    } catch (e) { console.error("Graph3D fatal:", e); setStatus("failed"); }
  }, []);

  return (
    <div ref={mountRef} style={{ width: "100%", height: "100%", position: "relative" }}>
      {/* Tier legend */}
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
            textTransform: "uppercase", textShadow: `0 0 8px ${meta.color}44`,
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
      {/* Title */}
      <div style={{
        position: "absolute", top: 14, left: 18, zIndex: 999, pointerEvents: "none",
        fontSize: 11, fontWeight: 700, letterSpacing: 6,
        color: "rgba(255,255,255,0.5)", textTransform: "uppercase",
      }}>
        RIGHTHAND · SYSTEM HIERARCHY
      </div>
      {/* Status */}
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
