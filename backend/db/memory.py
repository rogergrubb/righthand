"""
MemoryStore — the compounding moat.

Wraps:
  - memory_chunks  (semantic recall via pgvector)
  - conversations  (raw transcripts)
  - lessons_learned (the diary)
  - trend_reports  (the daily research)
"""

from __future__ import annotations

import logging
import os
from typing import Any

import httpx
from sqlalchemy import text

from db.session import sessionmaker

log = logging.getLogger("righthand.memory")

EMBEDDING_MODEL = "text-embedding-3-small"  # 1536 dims, cheap, good
OPENAI_URL = "https://api.openai.com/v1/embeddings"


class MemoryStore:
    def __init__(self) -> None:
        self.user_id = os.environ.get(
            "DEFAULT_USER_ID", "00000000-0000-0000-0000-000000000001"
        )

    async def init(self) -> None:
        # schema.sql runs on first container boot via docker-entrypoint-initdb.d
        log.info("MemoryStore ready for user_id=%s", self.user_id)

    # ---- embeddings ----

    async def _embed(self, content: str) -> list[float]:
        async with httpx.AsyncClient(timeout=30.0) as c:
            r = await c.post(
                OPENAI_URL,
                headers={"Authorization": f"Bearer {os.environ['OPENAI_API_KEY']}"},
                json={"model": EMBEDDING_MODEL, "input": content[:8000]},
            )
            r.raise_for_status()
            return r.json()["data"][0]["embedding"]

    # ---- writes ----

    async def record_turn(
        self,
        *,
        user_id: str,
        conversation_id: str | None,
        user_text: str,
        reply_text: str,
    ) -> None:
        content = f"USER: {user_text}\nASSISTANT: {reply_text}"
        embedding = await self._embed(content)
        async with sessionmaker()() as s:
            await s.execute(
                text(
                    """
                    INSERT INTO memory_chunks (user_id, source_type, content, embedding, metadata)
                    VALUES (:uid, 'conversation', :content, :emb, :meta)
                    """
                ),
                {
                    "uid": user_id,
                    "content": content,
                    "emb": embedding,
                    "meta": {"conversation_id": conversation_id},
                },
            )
            await s.commit()

    async def record_lesson(
        self, *, mistake: str, lesson: str, correction: str | None, tags: list[str]
    ) -> None:
        async with sessionmaker()() as s:
            await s.execute(
                text(
                    """
                    INSERT INTO lessons_learned (user_id, mistake, lesson, correction, tags)
                    VALUES (:uid, :m, :l, :c, :t)
                    """
                ),
                {"uid": self.user_id, "m": mistake, "l": lesson, "c": correction, "t": tags},
            )
            await s.commit()

    async def record_trend_report(
        self,
        *,
        domain: str,
        summary: str,
        correlations: dict,
        projections: dict[str, str],
    ) -> None:
        async with sessionmaker()() as s:
            await s.execute(
                text(
                    """
                    INSERT INTO trend_reports
                        (user_id, domain, summary, correlations,
                         projection_1d, projection_1w, projection_1m, projection_1y)
                    VALUES (:uid, :d, :s, :c, :p1d, :p1w, :p1m, :p1y)
                    """
                ),
                {
                    "uid": self.user_id,
                    "d": domain,
                    "s": summary,
                    "c": correlations,
                    "p1d": projections.get("1d"),
                    "p1w": projections.get("1w"),
                    "p1m": projections.get("1m"),
                    "p1y": projections.get("1y"),
                },
            )
            await s.commit()

    # ---- reads ----

    async def search(self, query: str, k: int = 8) -> list[dict[str, Any]]:
        if not query.strip():
            return []
        embedding = await self._embed(query)
        async with sessionmaker()() as s:
            rows = (
                await s.execute(
                    text(
                        """
                        SELECT id, source_type, content, metadata,
                               1 - (embedding <=> :emb) AS similarity
                        FROM memory_chunks
                        WHERE user_id = :uid
                        ORDER BY embedding <=> :emb
                        LIMIT :k
                        """
                    ),
                    {"emb": embedding, "uid": self.user_id, "k": k},
                )
            ).mappings().all()
        return [dict(r) for r in rows]

    async def list_lessons(self, limit: int = 50) -> list[dict]:
        async with sessionmaker()() as s:
            rows = (
                await s.execute(
                    text(
                        """
                        SELECT id, date, mistake, lesson, correction, tags, created_at
                        FROM lessons_learned
                        WHERE user_id = :uid
                        ORDER BY date DESC, created_at DESC
                        LIMIT :l
                        """
                    ),
                    {"uid": self.user_id, "l": limit},
                )
            ).mappings().all()
        return [dict(r) for r in rows]

    async def list_trend_reports(self, limit: int = 14) -> list[dict]:
        async with sessionmaker()() as s:
            rows = (
                await s.execute(
                    text(
                        """
                        SELECT id, date, domain, summary, correlations,
                               projection_1d, projection_1w, projection_1m, projection_1y
                        FROM trend_reports
                        WHERE user_id = :uid
                        ORDER BY date DESC, created_at DESC
                        LIMIT :l
                        """
                    ),
                    {"uid": self.user_id, "l": limit},
                )
            ).mappings().all()
        return [dict(r) for r in rows]
