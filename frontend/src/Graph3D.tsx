import React, { useEffect, useRef, useState } from "react";
import ForceGraph3D from "3d-force-graph";
import SpriteText from "three-spritetext";
import * as THREE from "three";

/* ──────────────────────────────────────────────────────────────
   RIGHTHAND 3D System Visualization — Jarno-grade v3
   EVERY node gets a persistent floating label.
   Tight clusters, lightning pulse animations, auto-rotation.
   ────────────────────────────────────────────────────────────── */

type SysNode = {
  id: string; label: string; kind: string; group: string; size: number;
  x?: number; y?: number; z?: number;
  __pulse?: number; __pulseColor?: string;
};
type SysLink = { source: string; target: string; kind: string };

const GROUPS: Record<string, { color: string; label: string; center: [number,number,number] }> = {
  brain:        { color: "#9f7bff", label: "AI BRAIN",        center: [0, 40, 0] },
  voice:        { color: "#4aa3ff", label: "VOICE ENGINE",    center: [-160, 80, 0] },
  memory:       { color: "#7dd87d", label: "MEMORY + RAG",    center: [160, 40, 50] },
  graph:        { color: "#ffb020", label: "3D GRAPH",        center: [0, -140, 0] },
  schedule:     { color: "#ffd166", label: "SCHEDULED TASKS", center: [160, 140, -50] },
  integrations: { color: "#ff5d8f", label: "INTEGRATIONS",    center: [-160, -100, 50] },
  database:     { color: "#44ddbb", label: "DATABASE",        center: [120, -100, -70] },
  frontend:     { color: "#88aaff", label: "FRONTEND",        center: [-80, -160, -50] },
};

const KIND_COLOR: Record<string,string> = {
  ai:"#c49fff", api:"#4aa3ff", service:"#88aaff", database:"#44ddbb",
  table:"#66ccaa", data:"#7dd87d", task:"#ffd166", integration:"#ff5d8f",
};

function buildTopology() {
  const j = (c: number, r: number) => c + (Math.random() - 0.5) * r;
  const mk = (id:string, label:string, kind:string, group:string, size:number): SysNode => {
    const g = GROUPS[group];
    return {
      id, label, kind, group, size,
      x: j(g.center[0], 40), y: j(g.center[1], 40), z: j(g.center[2], 40),
    };
  };

  const nodes: SysNode[] = [
    mk("brain-opus","Claude Opus 4","ai","brain",20),
    mk("brain-haiku","Claude Haiku 4.5","ai","brain",11),
    mk("brain-router","Agent Router","service","brain",13),
    mk("brain-tools","Tool Registry","service","brain",9),
    mk("brain-sdk","Agent SDK","service","brain",15),
    mk("voice-rt","OpenAI Realtime","api","voice",17),
    mk("voice-bridge","Voice Bridge","service","voice",11),
    mk("voice-vad","Semantic VAD","service","voice",8),
    mk("voice-tts","TTS Engine","service","voice",10),
    mk("voice-asr","Speech Recog","service","voice",10),
    mk("mem-pgv","pgvector","database","memory",15),
    mk("mem-emb","Embeddings","service","memory",11),
    mk("mem-chunks","Memory Chunks","data","memory",13),
    mk("mem-recall","Semantic Recall","service","memory",9),
    mk("db-pg","PostgreSQL","database","database",20),
    mk("db-users","users","table","database",6),
    mk("db-conv","conversations","table","database",10),
    mk("db-lessons","lessons_learned","table","database",13),
    mk("db-trends","trend_reports","table","database",11),
    mk("db-gn","graph_nodes","table","database",8),
    mk("db-ge","graph_edges","table","database",6),
    mk("db-mc","memory_chunks","table","database",10),
    mk("g3d","3D Force Graph","service","graph",15),
    mk("g-scan","File Scanner","service","graph",11),
    mk("g-watch","File Watcher","service","graph",9),
    mk("g-ws","WebSocket Bus","service","graph",11),
    mk("s-les","Lessons Daily","task","schedule",13),
    mk("s-tre","Trends Daily","task","schedule",13),
    mk("s-cron","APScheduler","service","schedule",9),
    mk("i-gh","GitHub","integration","integrations",13),
    mk("i-gm","Gmail","integration","integrations",11),
    mk("i-sl","Slack","integration","integrations",11),
    mk("i-st","Stripe","integration","integrations",11),
    mk("i-li","Linear","integration","integrations",9),
    mk("fe-react","React App","service","frontend",13),
    mk("fe-vite","Vite","service","frontend",9),
    mk("fe-vui","Voice Panel","service","frontend",11),
    mk("fe-gui","Graph Renderer","service","frontend",11),
  ];

  const links: SysLink[] = [
    {source:"brain-sdk",target:"brain-opus",kind:"uses"},
    {source:"brain-sdk",target:"brain-haiku",kind:"uses"},
    {source:"brain-router",target:"brain-sdk",kind:"routes"},
    {source:"brain-tools",target:"brain-sdk",kind:"provides"},
    {source:"voice-bridge",target:"brain-router",kind:"sends"},
    {source:"voice-rt",target:"voice-bridge",kind:"streams"},
    {source:"voice-vad",target:"voice-rt",kind:"detects"},
    {source:"voice-tts",target:"voice-rt",kind:"speaks"},
    {source:"voice-asr",target:"voice-rt",kind:"transcribes"},
    {source:"brain-haiku",target:"mem-recall",kind:"queries"},
    {source:"mem-recall",target:"mem-pgv",kind:"searches"},
    {source:"mem-emb",target:"mem-chunks",kind:"indexes"},
    {source:"mem-pgv",target:"db-mc",kind:"reads"},
    {source:"db-pg",target:"db-users",kind:"has"},
    {source:"db-pg",target:"db-conv",kind:"has"},
    {source:"db-pg",target:"db-lessons",kind:"has"},
    {source:"db-pg",target:"db-trends",kind:"has"},
    {source:"db-pg",target:"db-gn",kind:"has"},
    {source:"db-pg",target:"db-ge",kind:"has"},
    {source:"db-pg",target:"db-mc",kind:"has"},
    {source:"g3d",target:"g-ws",kind:"subscribes"},
    {source:"g-scan",target:"g-ws",kind:"emits"},
    {source:"g-watch",target:"g-scan",kind:"triggers"},
    {source:"g-ws",target:"fe-gui",kind:"streams"},
    {source:"s-les",target:"db-lessons",kind:"writes"},
    {source:"s-tre",target:"db-trends",kind:"writes"},
    {source:"s-cron",target:"s-les",kind:"triggers"},
    {source:"s-cron",target:"s-tre",kind:"triggers"},
    {source:"s-les",target:"brain-opus",kind:"calls"},
    {source:"s-tre",target:"brain-opus",kind:"calls"},
    {source:"fe-react",target:"fe-vite",kind:"built-by"},
    {source:"fe-vui",target:"voice-bridge",kind:"connects"},
    {source:"fe-gui",target:"g3d",kind:"renders"},
    {source:"i-gh",target:"brain-tools",kind:"tool"},
    {source:"i-gm",target:"brain-tools",kind:"tool"},
    {source:"i-sl",target:"brain-tools",kind:"tool"},
    {source:"i-st",target:"brain-tools",kind:"tool"},
    {source:"i-li",target:"brain-tools",kind:"tool"},
    {source:"brain-router",target:"db-conv",kind:"logs"},
    {source:"mem-chunks",target:"db-pg",kind:"stores"},
  ];
  return { nodes, links };
}

const WS_URL = (import.meta.env.VITE_BACKEND_WS ?? "ws://localhost:8000") + "/ws/graph";

/* ── Custom cluster-centering force ── */
function forceCluster(nodes: SysNode[], strength = 0.15) {
  return (alpha: number) => {
    for (const n of nodes) {
      const g = GROUPS[n.group];
      if (!g) continue;
      const k = alpha * strength;
      n.x = (n.x ?? 0) + (g.center[0] - (n.x ?? 0)) * k;
      n.y = (n.y ?? 0) + (g.center[1] - (n.y ?? 0)) * k;
      n.z = (n.z ?? 0) + (g.center[2] - (n.z ?? 0)) * k;
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

      graph = ForceGraph3D()(el)
        .backgroundColor("#05070d")
        .width(el.clientWidth)
        .height(el.clientHeight)
        .graphData({ nodes, links })

        /* ── EVERY node: sphere + floating label ── */
        .nodeThreeObject((node: any) => {
          const group = new THREE.Group();

          // Glowing sphere
          const color = node.__pulse && Date.now() - node.__pulse < 1500
            ? "#ffffff"
            : (KIND_COLOR[node.kind] ?? "#88aaff");
          const radius = Math.pow(node.size ?? 8, 0.6) * 1.2;
          const geo = new THREE.SphereGeometry(radius, 20, 20);
          const mat = new THREE.MeshLambertMaterial({
            color,
            transparent: true,
            opacity: 0.92,
            emissive: color,
            emissiveIntensity: 0.35,
          });
          const sphere = new THREE.Mesh(geo, mat);
          group.add(sphere);

          // Glow ring (outer halo)
          const ringGeo = new THREE.RingGeometry(radius * 1.3, radius * 1.8, 32);
          const ringMat = new THREE.MeshBasicMaterial({
            color,
            transparent: true,
            opacity: 0.08,
            side: THREE.DoubleSide,
          });
          const ring = new THREE.Mesh(ringGeo, ringMat);
          ring.lookAt(0, 0, 1); // face camera-ish
          group.add(ring);

          // Text label
          const sprite = new SpriteText(node.label, 3.5, color);
          sprite.fontWeight = "600";
          sprite.backgroundColor = "rgba(0,0,0,0.55)";
          sprite.padding = 1.5;
          sprite.borderRadius = 2;
          (sprite as any).position.set(0, -(radius + 5), 0);
          group.add(sprite);

          // Store refs for pulse updates
          node.__sphereMat = mat;
          node.__sprite = sprite;
          node.__ring = ring;
          node.__ringMat = ringMat;
          node.__radius = radius;

          return group;
        })
        .nodeThreeObjectExtend(false)

        /* ── Link rendering ── */
        .linkColor((l: any) => {
          const s: any = typeof l.source === "object" ? l.source : null;
          const t: any = typeof l.target === "object" ? l.target : null;
          const sPulse = s?.__pulse && Date.now() - s.__pulse < 1200;
          const tPulse = t?.__pulse && Date.now() - t.__pulse < 1200;
          if (sPulse || tPulse) return "#ffffff88";
          return "rgba(100,150,240,0.18)";
        })
        .linkWidth((l: any) => {
          const s: any = typeof l.source === "object" ? l.source : null;
          const t: any = typeof l.target === "object" ? l.target : null;
          const active = (s?.__pulse && Date.now() - s.__pulse < 1200) ||
                         (t?.__pulse && Date.now() - t.__pulse < 1200);
          return active ? 2.8 : 0.5;
        })
        .linkDirectionalParticles((l: any) => {
          const s: any = typeof l.source === "object" ? l.source : null;
          const t: any = typeof l.target === "object" ? l.target : null;
          const active = (s?.__pulse && Date.now() - s.__pulse < 2000) ||
                         (t?.__pulse && Date.now() - t.__pulse < 2000);
          return active ? 6 : 0;
        })
        .linkDirectionalParticleWidth(2.5)
        .linkDirectionalParticleSpeed(0.02)
        .linkDirectionalParticleColor(() => "#ffffff")

        /* ── Physics ── */
        .d3AlphaDecay(0.012)
        .d3VelocityDecay(0.4)
        .warmupTicks(120)
        .cooldownTime(5000);

      // Custom cluster force
      graph.d3Force("cluster", forceCluster(nodes, 0.18));
      graph.d3Force("charge")?.strength(-35);
      graph.d3Force("link")?.distance((l: any) => {
        const s = typeof l.source === "object" ? l.source : nodes.find((n: any) => n.id === l.source);
        const t = typeof l.target === "object" ? l.target : nodes.find((n: any) => n.id === l.target);
        return (s?.group === t?.group) ? 25 : 80;
      });

      // Camera
      setTimeout(() => graph.cameraPosition(
        { x: 300, y: 220, z: 300 }, { x: 0, y: 0, z: 0 }, 2500
      ), 200);

      let angle = 0;
      const rotateLoop = setInterval(() => {
        if (!graph) return;
        angle += 0.0012;
        const d = 400;
        graph.cameraPosition({
          x: d * Math.sin(angle),
          y: 140 + 60 * Math.sin(angle * 0.35),
          z: d * Math.cos(angle),
        });
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
                tgt.__pulseColor = GROUPS[tgt.group]?.color ?? "#ffffff";
              }
              const br = gd.nodes.find((n: any) => n.id === "brain-opus");
              if (br) { br.__pulse = Date.now(); br.__pulseColor = "#c49fff"; }
            }
          } catch { }
        };
        ws.onerror = () => setStatus("ws error");
        ws.onclose = () => setStatus("disconnected");
      } catch { setStatus("offline"); }

      /* ── Pulse animation refresh ── */
      const pulseLoop = setInterval(() => {
        if (!graph) return;
        const gd = graph.graphData();
        const now = Date.now();
        for (const n of gd.nodes) {
          if (!n.__sphereMat) continue;
          const isPulsing = n.__pulse && now - n.__pulse < 1500;
          const baseColor = KIND_COLOR[n.kind] ?? "#88aaff";
          const color = isPulsing && now - n.__pulse < 400 ? "#ffffff" : baseColor;
          n.__sphereMat.color.set(color);
          n.__sphereMat.emissive.set(color);
          n.__sphereMat.emissiveIntensity = isPulsing ? 0.8 : 0.35;
          n.__sphereMat.opacity = isPulsing ? 1.0 : 0.92;
          if (n.__ringMat) {
            n.__ringMat.color.set(color);
            n.__ringMat.opacity = isPulsing ? 0.25 : 0.08;
          }
          if (n.__sprite) {
            n.__sprite.color = isPulsing ? "#ffffff" : baseColor;
          }
        }
        // Also refresh link visuals
        graph.linkColor(graph.linkColor());
        graph.linkWidth(graph.linkWidth());
        graph.linkDirectionalParticles(graph.linkDirectionalParticles());
      }, 80);

      /* ── Demo pulses ── */
      const demoLoop = setInterval(() => {
        const gd = graph.graphData();
        if (!gd.nodes.length) return;
        const count = 2 + Math.floor(Math.random() * 3);
        for (let i = 0; i < count; i++) {
          const n = gd.nodes[Math.floor(Math.random() * gd.nodes.length)];
          n.__pulse = Date.now();
          n.__pulseColor = GROUPS[n.group]?.color ?? "#fff";
        }
      }, 2000);

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
      {/* ── Cluster legend (top-right) ── */}
      <div style={{
        position: "absolute", top: 12, right: 14, padding: "12px 16px",
        zIndex: 999, pointerEvents: "none",
        background: "rgba(5,7,13,0.7)", borderRadius: 10,
        backdropFilter: "blur(8px)", border: "1px solid rgba(255,255,255,0.06)",
      }}>
        {Object.entries(GROUPS).map(([k, g]) => (
          <div key={k} style={{
            fontSize: 10, fontWeight: 700, letterSpacing: 2.5,
            color: g.color, opacity: 0.85, marginBottom: 7,
            textTransform: "uppercase", textAlign: "right",
            textShadow: `0 0 8px ${g.color}44`,
          }}>
            <span style={{
              display: "inline-block", width: 8, height: 8, borderRadius: "50%",
              backgroundColor: g.color, marginRight: 8, verticalAlign: "middle",
              boxShadow: `0 0 8px ${g.color}, 0 0 2px ${g.color}`,
            }} />
            {g.label}
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
        RIGHTHAND · SYSTEM MAP
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
