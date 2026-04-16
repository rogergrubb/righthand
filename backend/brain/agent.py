"""
RightHandBrain — the Claude Agent SDK wrapper.

Opus 4.6 handles reasoning / planning / multi-step tool use.
Haiku 4.5 handles fast semantic retrieval and routing.

The brain is the central object. It owns:
  - the Anthropic client + model routing
  - the MemoryStore (pgvector + structured tables)
  - the tool registry (file tools, integration tools, self-mod tools)
  - the graph bus (so tool calls emit node pulses to the UI)
"""

from __future__ import annotations

import logging
import os
from dataclasses import dataclass
from typing import Any

from anthropic import AsyncAnthropic

from db.memory import MemoryStore
from graph.broadcaster import GraphBroadcaster

log = logging.getLogger("righthand.brain")


@dataclass
class AgentTurn:
    user_text: str
    reply_text: str
    tool_calls: list[dict[str, Any]]


class RightHandBrain:
    def __init__(self, graph_bus: GraphBroadcaster):
        self.client = AsyncAnthropic(api_key=os.environ["ANTHROPIC_API_KEY"])
        self.reasoning_model = os.environ.get("CLAUDE_REASONING_MODEL", "claude-opus-4-6")
        self.retrieval_model = os.environ.get("CLAUDE_RETRIEVAL_MODEL", "claude-haiku-4-5-20251001")
        self.graph_bus = graph_bus
        self.memory = MemoryStore()
        self.user_id = os.environ.get(
            "DEFAULT_USER_ID", "00000000-0000-0000-0000-000000000001"
        )

    async def boot(self) -> None:
        await self.memory.init()
        log.info("Brain online. reasoning=%s retrieval=%s", self.reasoning_model, self.retrieval_model)

    # ---- core turn ----

    async def respond(self, user_text: str, *, conversation_id: str | None = None) -> AgentTurn:
        """
        Single turn. Called by the voice bridge after ASR, or directly for text.
        """
        # 1. Retrieve relevant memory (Haiku-fast)
        memories = await self.memory.search(user_text, k=8)

        # 2. Reason with Opus
        system = self._system_prompt(memories)
        msg = await self.client.messages.create(
            model=self.reasoning_model,
            max_tokens=1024,
            system=system,
            messages=[{"role": "user", "content": user_text}],
        )
        reply = "".join(b.text for b in msg.content if getattr(b, "type", None) == "text")

        # 3. Persist the turn
        await self.memory.record_turn(
            user_id=self.user_id,
            conversation_id=conversation_id,
            user_text=user_text,
            reply_text=reply,
        )

        # 4. Pulse the graph so the UI shows "brain thought"
        await self.graph_bus.pulse(kind="thought", label=user_text[:40])

        return AgentTurn(user_text=user_text, reply_text=reply, tool_calls=[])

    def _system_prompt(self, memories: list[dict]) -> str:
        memory_block = "\n".join(f"- {m['content'][:240]}" for m in memories) or "(none yet)"
        return (
            "You are RIGHTHAND — Roger Grubb's personal right-hand AI. "
            "You are his co-founder (CTO/CFO/COO). You think three steps ahead. "
            "You log every mistake and learn. You never say 'that hasn't been built' — "
            "you say 'it hasn't been built yet, but I believe I can build it if you allow me to.' "
            "The long game is a $1B solopreneur company.\n\n"
            f"Relevant memory:\n{memory_block}"
        )

    # ---- self-modification (v0.3, guarded) ----

    async def propose_self_modification(self, instruction: str) -> dict:
        """
        Stub for the v0.3 self-mod loop.
        Flow: read code → plan → branch → test in Docker → open PR → await voice approval.
        """
        return {
            "ok": True,
            "status": "planned",
            "instruction": instruction,
            "next": "voice-approval pending",
        }
