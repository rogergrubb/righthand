"""
GraphBroadcaster — fan-out WS bus for node pulses.

Every tool call, file touch, memory hit, or thought emits a pulse event.
All /ws/graph subscribers receive it. The 3D force-graph in the frontend
lights up the corresponding node.
"""

from __future__ import annotations

import asyncio
import time
import uuid
from typing import Any


class GraphBroadcaster:
    def __init__(self) -> None:
        self._subscribers: list[asyncio.Queue] = []
        self._nodes: dict[str, dict[str, Any]] = {}
        self._edges: dict[str, dict[str, Any]] = {}

    def subscribe(self) -> asyncio.Queue:
        q: asyncio.Queue = asyncio.Queue(maxsize=256)
        self._subscribers.append(q)
        return q

    def unsubscribe(self, q: asyncio.Queue) -> None:
        if q in self._subscribers:
            self._subscribers.remove(q)

    def nodes(self) -> list[dict]:
        return list(self._nodes.values())

    def edges(self) -> list[dict]:
        return list(self._edges.values())

    async def upsert_node(self, *, node_id: str, kind: str, label: str, meta: dict | None = None) -> None:
        self._nodes[node_id] = {
            "id": node_id,
            "kind": kind,
            "label": label,
            "meta": meta or {},
            "updated_at": time.time(),
        }
        await self._emit({"type": "node.upsert", "node": self._nodes[node_id]})

    async def upsert_edge(self, *, source: str, target: str, kind: str, weight: float = 1.0) -> None:
        eid = f"{source}->{target}:{kind}"
        self._edges[eid] = {"id": eid, "source": source, "target": target, "kind": kind, "weight": weight}
        await self._emit({"type": "edge.upsert", "edge": self._edges[eid]})

    async def pulse(self, *, kind: str, label: str, node_id: str | None = None) -> None:
        """Lightweight 'I touched this' event — no persistence required."""
        await self._emit(
            {
                "type": "pulse",
                "pulse_id": str(uuid.uuid4()),
                "node_id": node_id,
                "kind": kind,
                "label": label,
                "ts": time.time(),
            }
        )

    async def _emit(self, event: dict) -> None:
        dead: list[asyncio.Queue] = []
        for q in self._subscribers:
            try:
                q.put_nowait(event)
            except asyncio.QueueFull:
                dead.append(q)
        for q in dead:
            self.unsubscribe(q)
