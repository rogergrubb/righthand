import React, { useEffect, useRef, useState } from "react";
import ForceGraph3D from "3d-force-graph";
import SpriteText from "three-spritetext";
import * as THREE from "three";

/* ──────────────────────────────────────────────────────────────
   RIGHTHAND 3D System Visualization — Polished v7

   Arced tiers, semicircle fans, ambient glow, bloom lighting,
   crown at apex, waterfall cascade pulses.
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

const ORB_RADIUS = 8;
const CROWN_RADIUS = 16;

/* ── Helper: place N items along an arc ── */
function arc(
  items: string[][],  // [id, label, kind, group]
  tier: number, y: number,
  radius: number,       // arc radius
  startAngle: number,   // radians
  endAngle: number,
  yJitter = 8,
): SysNode[] {
  const n = items.length;
  return items.map((item, i) => {
    const t = n === 1 ? 0.5 : i / (n - 1);
    const angle = startAngle + t * (endAngle - startAngle);
    const x = radius * Math.sin(angle);
    const z = radius * Math.cos(angle);
    const yy = y + (Math.random() - 0.5) * yJitter;
    return {
      id: item[0], label: item[1], kind: item[2], group: item[3],
      tier, size: 12,
      x, y: yy, z, fx: x, fy: yy, fz: z,
    };
  });
}

function buildTopology() {
  const mk = (id: string, label: string, kind: string, group: string,
              tier: number, x: number, y: number, z: number): SysNode => ({
    id, label, kind, group, tier, size: 12,
    x, y, z, fx: x, fy: y, fz: z,
  });

  const nodes: SysNode[] = [
    // ═══ T0: CROWN ═══
    mk("brain-opus", "RIGHTHAND", "orchestrator", "brain", 0,  0, 220, 0),

    // ═══ T1: BRAIN — arc across 120° ═══
    ...arc([
      ["brain-sdk",    "Agent SDK",     "ai",      "brain"],
      ["brain-router", "Agent Router",  "service", "brain"],
      ["brain-haiku",  "Claude Haiku",  "ai",      "brain"],
      ["brain-tools",  "Tool Registry", "service", "brain"],
    ], 1, 110, 120, -Math.PI * 0.35, Math.PI * 0.35),

    // ═══ T2: SERVICES — 3 sub-clusters, each arced ═══
    // Voice (left arc, forward-facing)
    ...arc([
      ["voice-vad",    "Semantic VAD",    "service", "voice"],
      ["voice-asr",    "Speech Recog",    "service", "voice"],
      ["voice-rt",     "OpenAI Realtime", "api",     "voice"],
      ["voice-bridge", "Voice Bridge",    "service", "voice"],
      ["voice-tts",    "TTS Engine",      "service", "voice"],
    ], 2, 0, 100, Math.PI * 0.55, Math.PI * 0.95, 12),

    // Schedule (center arc)
    ...arc([
      ["s-cron", "APScheduler",   "service", "schedule"],
      ["s-les",  "Lessons Daily", "task",    "schedule"],
      ["s-tre",  "Trends Daily",  "task",    "schedule"],
    ], 2, 0, 80, -Math.PI * 0.12, Math.PI * 0.12),

    // Integrations (right arc, back-facing)
    ...arc([
      ["i-gh", "GitHub",  "integration", "integrations"],
      ["i-st", "Stripe",  "integration", "integrations"],
      ["i-gm", "Gmail",   "integration", "integrations"],
      ["i-sl", "Slack",   "integration", "integrations"],
      ["i-li", "Linear",  "integration", "integrations"],
    ], 2, 0, 100, -Math.PI * 0.95, -Math.PI * 0.55, 12),

    // ═══ T3: DATA — Memory arc (left) + DB semicircle (right) ═══
    // Memory arc
    ...arc([
      ["mem-chunks", "Memory Chunks",   "data",     "memory"],
      ["mem-emb",    "Embeddings",       "service",  "memory"],
      ["mem-pgv",    "pgvector",         "database", "memory"],
      ["mem-recall", "Semantic Recall",  "service",  "memory"],
    ], 3, -130, 90, Math.PI * 0.4, Math.PI * 0.8),

    // Database semicircle — PostgreSQL at center, tables fanned around it
    mk("db-pg", "PostgreSQL", "database", "database", 3,  40, -120, -40),
    ...arc([
      ["db-mc",      "memory_chunks",   "table", "database"],
      ["db-lessons", "lessons_learned",  "table", "database"],
      ["db-conv",    "conversations",    "table", "database"],
      ["db-users",   "users",            "table", "database"],
      ["db-gn",      "graph_nodes",      "table", "database"],
      ["db-ge",      "graph_edges",      "table", "database"],
      ["db-trends",  "trend_reports",    "table", "database"],
    ], 3, -140, 130, -Math.PI * 0.7, -Math.PI * 0.15, 10),

    // ═══ T4: PRESENTATION — wide arc ═══
    ...arc([
      ["g-watch",  "File Watcher",   "service", "graph"],
      ["g3d",      "3D Force Graph", "service", "graph"],
      ["g-scan",   "File Scanner",   "service", "graph"],
      ["g-ws",     "WebSocket Bus",  "service", "graph"],
      ["fe-gui",   "Graph Renderer", "service", "frontend"],
      ["fe-react", "React App",      "service", "frontend"],
      ["fe-vite",  "Vite",           "service", "frontend"],
      ["fe-vui",   "Voice Panel",    "service", "frontend"],
    ], 4, -260, 160, Math.PI * 0.7, -Math.PI * 0.7, 10),
  ];

  const links: SysLink[] = [
    // Crown → Brain
    { source: "brain-opus", target: "brain-sdk",     kind: "powers" },
    { source: "brain-opus", target: "brain-router",   kind: "powers" },
    { source: "brain-opus", target: "brain-haiku",    kind: "delegates" },
    { source: "brain-opus", target: "brain-tools",    kind: "powers" },
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
    // Schedule
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
    // Database
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

export function Graph3D() {
  const mountRef = useRef<HTMLDivElement>(null);
  const [status, setStatus] = useState("initializing...");

  useEffect(() => {
    if (!mountRef.current) return;
    const el = mountRef.current;
    let graph: any;

    try {
      const { nodes, links } = buildTopology();

      graph = ForceGraph3D()(el)
        .backgroundColor("#060a12")
        .width(el.clientWidth)
        .height(el.clientHeight)
        .graphData({ nodes, links })

        /* ── Node rendering ── */
        .nodeThreeObject((node: any) => {
          const grp = new THREE.Group();
          const isCrown = node.id === "brain-opus";
          const baseColor = isCrown
            ? "#ffd700"
            : (KIND_COLOR[node.kind] ?? GROUP_COLOR[node.group] ?? "#88aaff");
          const radius = isCrown ? CROWN_RADIUS : ORB_RADIUS;

          // Sphere with phong for specular highlights
          const geo = new THREE.SphereGeometry(radius, 32, 32);
          const mat = new THREE.MeshPhongMaterial({
            color: baseColor, transparent: true, opacity: 0.92,
            emissive: baseColor, emissiveIntensity: isCrown ? 0.5 : 0.25,
            shininess: 80, specular: new THREE.Color("#444444"),
          });
          grp.add(new THREE.Mesh(geo, mat));

          // Inner glow shell (slightly bigger, very transparent)
          const glowGeo = new THREE.SphereGeometry(radius * 1.25, 24, 24);
          const glowMat = new THREE.MeshBasicMaterial({
            color: baseColor, transparent: true, opacity: isCrown ? 0.08 : 0.04,
            side: THREE.BackSide,
          });
          grp.add(new THREE.Mesh(glowGeo, glowMat));

          // Crown gets extra outer glow
          if (isCrown) {
            const outerGeo = new THREE.SphereGeometry(radius * 1.6, 24, 24);
            const outerMat = new THREE.MeshBasicMaterial({
              color: "#ffd700", transparent: true, opacity: 0.04, side: THREE.BackSide,
            });
            grp.add(new THREE.Mesh(outerGeo, outerMat));
          }

          // Label
          const sprite = new SpriteText(node.label, isCrown ? 10 : 7, baseColor);
          sprite.fontWeight = "600";
          sprite.backgroundColor = "rgba(0,0,0,0.5)";
          sprite.padding = 1.5;
          sprite.borderRadius = 2;
          (sprite as any).position.set(0, -(radius + 12), 0);
          grp.add(sprite);

          node.__sphereMat = mat;
          node.__sprite = sprite;
          node.__radius = radius;
          node.__baseColor = baseColor;
          node.__glowMat = glowMat;

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
          if (active) return "#ffffffaa";
          const tier = Math.min(s?.tier ?? 4, t?.tier ?? 4);
          return TIER_META[tier]
            ? `${TIER_META[tier].color}30`
            : "rgba(100,150,240,0.15)";
        })
        .linkWidth((l: any) => {
          const s: any = typeof l.source === "object" ? l.source : null;
          const t: any = typeof l.target === "object" ? l.target : null;
          const now = Date.now();
          const active = (s?.__pulse && now - s.__pulse < 1400) ||
                         (t?.__pulse && now - t.__pulse < 1400);
          return active ? 2.5 : 0.6;
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
        .linkDirectionalParticleColor(() => "#ffffffdd")
        .linkOpacity(0.7)

        /* ── Physics: minimal ── */
        .d3AlphaDecay(0.5)
        .d3VelocityDecay(1)
        .warmupTicks(10)
        .cooldownTime(200);

      graph.d3Force("charge", null);
      graph.d3Force("center", null);

      // ── Enhanced lighting ──
      const scene = graph.scene();
      // Remove default lights, add our own
      scene.children.filter((c: any) => c.isLight).forEach((l: any) => scene.remove(l));

      // Key light (warm, from above-right)
      const keyLight = new THREE.DirectionalLight(0xffeedd, 1.2);
      keyLight.position.set(200, 400, 300);
      scene.add(keyLight);

      // Fill light (cool, from below-left)
      const fillLight = new THREE.DirectionalLight(0xaaccff, 0.5);
      fillLight.position.set(-200, -200, -100);
      scene.add(fillLight);

      // Ambient (very subtle so orbs glow from emissive)
      scene.add(new THREE.AmbientLight(0x222233, 0.6));

      // Point light at crown position for golden glow cast
      const crownLight = new THREE.PointLight(0xffd700, 0.8, 400);
      crownLight.position.set(0, 220, 0);
      scene.add(crownLight);

      // ── Subtle star field background ──
      const starGeo = new THREE.BufferGeometry();
      const starPositions = new Float32Array(600 * 3);
      for (let i = 0; i < 600; i++) {
        starPositions[i * 3]     = (Math.random() - 0.5) * 2000;
        starPositions[i * 3 + 1] = (Math.random() - 0.5) * 2000;
        starPositions[i * 3 + 2] = (Math.random() - 0.5) * 2000;
      }
      starGeo.setAttribute("position", new THREE.BufferAttribute(starPositions, 3));
      const starMat = new THREE.PointsMaterial({ color: 0xffffff, size: 0.8, transparent: true, opacity: 0.3 });
      scene.add(new THREE.Points(starGeo, starMat));

      // Camera
      const hierCenter = { x: 0, y: -20, z: 0 };
      graph.cameraPosition({ x: 200, y: 180, z: 520 }, hierCenter);

      // Auto-rotation with user interaction pause
      let angle = Math.atan2(200, 520);
      let userInteracting = false;
      let idleTimer: ReturnType<typeof setTimeout> | null = null;

      const pauseRotation = () => {
        userInteracting = true;
        if (idleTimer) clearTimeout(idleTimer);
        idleTimer = setTimeout(() => {
          userInteracting = false;
          const pos = graph.cameraPosition();
          angle = Math.atan2(pos.x, pos.z);
        }, 4000);
      };

      el.addEventListener("pointerdown", pauseRotation);
      el.addEventListener("wheel", pauseRotation);

      const rotateLoop = setInterval(() => {
        if (!graph || userInteracting) return;
        angle += 0.0008;
        const d = 560;
        graph.cameraPosition({
          x: d * Math.sin(angle) * 0.85,
          y: 130 + 70 * Math.sin(angle * 0.4),
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
              if (tgt) { tgt.__pulse = Date.now(); tgt.__pulseColor = tgt.__baseColor ?? "#fff"; }
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
          n.__sphereMat.emissiveIntensity = isPulsing ? 0.8 : (n.id === "brain-opus" ? 0.5 : 0.25);
          n.__sphereMat.opacity = isPulsing ? 1.0 : 0.92;
          if (n.__glowMat) {
            n.__glowMat.opacity = isPulsing ? 0.15 : (n.id === "brain-opus" ? 0.08 : 0.04);
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
        el.removeEventListener("pointerdown", pauseRotation);
        el.removeEventListener("wheel", pauseRotation);
        if (idleTimer) clearTimeout(idleTimer);
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
