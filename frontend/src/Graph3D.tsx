import React, { useEffect, useRef, useState } from "react";
import ForceGraph3D from "3d-force-graph";

type GraphNode = { id: string; label: string; kind: string };
type GraphEdge = { source: string; target: string; kind: string };

const WS_URL =
  (import.meta.env.VITE_BACKEND_WS ?? "ws://localhost:8000") + "/ws/graph";

const KIND_COLOR: Record<string, string> = {
  file: "#4aa3ff",
  project: "#9f7bff",
  system: "#ffb020",
  person: "#ff5d8f",
  lesson: "#7dd87d",
  trend: "#ffd166",
  thought: "#88aaff",
};

export function Graph3D() {
  const mountRef = useRef<HTMLDivElement>(null);
  const [status, setStatus] = useState<string>("connecting...");

  useEffect(() => {
    if (!mountRef.current) return;

    let graph: any;
    try {
      graph = ForceGraph3D()(mountRef.current)
        .backgroundColor("#05070d")
        .nodeLabel((n: any) => `${n.kind ?? "node"}: ${n.label ?? n.id}`)
        .nodeColor((n: any) => KIND_COLOR[n.kind] ?? "#88aaff")
        .nodeRelSize(4)
        .linkColor(() => "rgba(150,180,255,0.35)")
        .linkWidth(0.6)
        .width(mountRef.current.clientWidth)
        .height(mountRef.current.clientHeight);
    } catch (e) {
      console.error("Graph3D init failed:", e);
      setStatus("graph failed to init");
      return;
    }

    const nodeIndex = new Map<string, GraphNode>();
    const links: GraphEdge[] = [];

    const rebuild = () => {
      try {
        graph.graphData({ nodes: [...nodeIndex.values()], links: [...links] });
      } catch (e) {
        console.error("graphData error:", e);
      }
    };

    // Seed a brain node so the graph isn't empty
    nodeIndex.set("brain", { id: "brain", kind: "system", label: "RIGHTHAND" });
    rebuild();

    let ws: WebSocket | null = null;
    try {
      ws = new WebSocket(WS_URL);
      ws.onopen = () => setStatus("connected");
      ws.onmessage = (ev) => {
        try {
          const msg = JSON.parse(ev.data);
          if (msg.type === "snapshot") {
            (msg.nodes ?? []).forEach((n: GraphNode) => nodeIndex.set(n.id, n));
            links.push(...(msg.edges ?? []));
            rebuild();
          } else if (msg.type === "node.upsert") {
            nodeIndex.set(msg.node.id, msg.node);
            rebuild();
          } else if (msg.type === "edge.upsert") {
            links.push(msg.edge);
            rebuild();
          } else if (msg.type === "pulse") {
            // Add pulse as a temporary node
            const pulseNode = {
              id: msg.pulse_id ?? "p-" + Date.now(),
              kind: msg.kind ?? "thought",
              label: msg.label ?? "pulse",
            };
            nodeIndex.set(pulseNode.id, pulseNode);
            if (msg.node_id && nodeIndex.has(msg.node_id)) {
              links.push({ source: "brain", target: pulseNode.id, kind: "pulse" });
            }
            rebuild();
          }
        } catch (e) {
          console.warn("ws message parse error:", e);
        }
      };
      ws.onerror = () => setStatus("ws error — retrying...");
      ws.onclose = () => setStatus("disconnected");
    } catch (e) {
      console.error("WebSocket connect failed:", e);
      setStatus("offline");
    }

    const handleResize = () => {
      if (mountRef.current && graph) {
        graph.width(mountRef.current.clientWidth);
        graph.height(mountRef.current.clientHeight);
      }
    };
    window.addEventListener("resize", handleResize);

    return () => {
      window.removeEventListener("resize", handleResize);
      ws?.close();
    };
  }, []);

  return (
    <div ref={mountRef} style={{ width: "100%", height: "100%", position: "relative" }}>
      <div style={{
        position: "absolute", bottom: 8, right: 12, fontSize: 10,
        opacity: 0.4, pointerEvents: "none"
      }}>
        graph: {status}
      </div>
    </div>
  );
}
