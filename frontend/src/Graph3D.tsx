import React, { useEffect, useRef } from "react";
import ForceGraph3D from "3d-force-graph";
import * as THREE from "three";

type Node = { id: string; label: string; kind: string };
type Edge = { source: string; target: string; kind: string };

const WS_URL =
  (import.meta.env.VITE_BACKEND_WS ?? "ws://localhost:8000") + "/ws/graph";

const KIND_COLOR: Record<string, string> = {
  file: "#4aa3ff",
  project: "#9f7bff",
  system: "#ffb020",
  person: "#ff5d8f",
  lesson: "#7dd87d",
  trend: "#ffd166",
};

export function Graph3D() {
  const mountRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!mountRef.current) return;

    const graph = ForceGraph3D()(mountRef.current)
      .backgroundColor("#05070d")
      .nodeLabel((n: any) => `${n.kind}: ${n.label}`)
      .nodeThreeObject((n: any) => {
        const color = KIND_COLOR[n.kind] ?? "#88aaff";
        const mat = new THREE.MeshBasicMaterial({ color });
        const geo = new THREE.SphereGeometry(3, 16, 16);
        return new THREE.Mesh(geo, mat);
      })
      .linkColor(() => "rgba(150,180,255,0.35)")
      .linkWidth(0.6);

    const nodes: Node[] = [];
    const links: Edge[] = [];
    const nodeIndex = new Map<string, Node>();

    const rebuild = () => graph.graphData({ nodes: [...nodeIndex.values()], links });

    const ws = new WebSocket(WS_URL);
    ws.onmessage = (ev) => {
      const msg = JSON.parse(ev.data);
      if (msg.type === "snapshot") {
        (msg.nodes ?? []).forEach((n: Node) => nodeIndex.set(n.id, n));
        links.push(...(msg.edges ?? []));
        rebuild();
      } else if (msg.type === "node.upsert") {
        nodeIndex.set(msg.node.id, msg.node);
        rebuild();
      } else if (msg.type === "edge.upsert") {
        links.push(msg.edge);
        rebuild();
      } else if (msg.type === "pulse") {
        // briefly highlight a node
        const n: any = nodeIndex.get(msg.node_id);
        if (n) {
          n.__flash = Date.now();
          rebuild();
        }
      }
    };

    return () => {
      ws.close();
    };
  }, []);

  return <div ref={mountRef} style={{ width: "100%", height: "100%" }} />;
}
