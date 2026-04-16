"""
RIGHTHAND backend entry.

FastAPI app that wires together:
  - /ws/voice      — OpenAI Realtime voice bridge (audio in / audio out)
  - /ws/graph      — WebSocket stream of graph-node pulse events
  - /api/memory    — semantic search over memory_chunks
  - /api/lessons   — list + ingest lessons-learned entries
  - /api/trends    — list daily trend reports
  - scheduled jobs — lessons_daily, trends_daily (APScheduler)
"""

from __future__ import annotations

import asyncio
import logging
import os
from contextlib import asynccontextmanager

from apscheduler.schedulers.asyncio import AsyncIOScheduler
from apscheduler.triggers.cron import CronTrigger
from fastapi import FastAPI, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware

from brain.agent import RightHandBrain
from db.session import init_db, dispose_db
from graph.scanner import FileScanner
from graph.broadcaster import GraphBroadcaster
from scheduled.lessons_daily import run_lessons_daily
from scheduled.trends_daily import run_trends_daily
from voice.bridge import VoiceBridge

log = logging.getLogger("righthand")
logging.basicConfig(level=logging.INFO)


# ---- lifecycle ----------------------------------------------------------

brain: RightHandBrain | None = None
graph_bus: GraphBroadcaster | None = None
scheduler: AsyncIOScheduler | None = None


@asynccontextmanager
async def lifespan(app: FastAPI):
    global brain, graph_bus, scheduler

    await init_db()

    graph_bus = GraphBroadcaster()
    brain = RightHandBrain(graph_bus=graph_bus)
    await brain.boot()

    # Index the codebase as graph nodes
    scanner = FileScanner(root=os.environ.get("SCAN_ROOT", "/workspace"), bus=graph_bus)
    asyncio.create_task(scanner.watch_forever())

    # Scheduled compounding jobs
    tz = os.environ.get("TIMEZONE", "America/Chicago")
    scheduler = AsyncIOScheduler(timezone=tz)
    scheduler.add_job(
        run_lessons_daily,
        CronTrigger.from_crontab(os.environ.get("LESSONS_DAILY_CRON", "0 22 * * *"), timezone=tz),
        args=[brain],
        id="lessons_daily",
    )
    scheduler.add_job(
        run_trends_daily,
        CronTrigger.from_crontab(os.environ.get("TRENDS_DAILY_CRON", "0 6 * * *"), timezone=tz),
        args=[brain],
        id="trends_daily",
    )
    scheduler.start()
    log.info("RIGHTHAND boot complete — scheduler running.")

    try:
        yield
    finally:
        if scheduler:
            scheduler.shutdown(wait=False)
        await dispose_db()


app = FastAPI(title="RIGHTHAND", version="0.1.0", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=[os.environ.get("FRONTEND_ORIGIN", "http://localhost:5173")],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# ---- routes -------------------------------------------------------------

@app.get("/healthz")
async def healthz():
    return {"ok": True, "service": "righthand", "version": "0.1.0"}


@app.websocket("/ws/voice")
async def ws_voice(ws: WebSocket):
    """Browser ↔ Voice bridge ↔ Claude brain. Audio frames both directions."""
    await ws.accept()
    assert brain is not None
    bridge = VoiceBridge(brain=brain)
    try:
        await bridge.run(ws)
    except WebSocketDisconnect:
        log.info("voice ws disconnected")
    except Exception as e:
        log.exception("voice ws error: %s", e)
        await ws.close(code=1011)


@app.websocket("/ws/graph")
async def ws_graph(ws: WebSocket):
    """Stream of node-pulse events so the 3D graph lights up in real time."""
    await ws.accept()
    assert graph_bus is not None
    queue = graph_bus.subscribe()
    try:
        # Send the initial snapshot
        await ws.send_json({"type": "snapshot", "nodes": graph_bus.nodes(), "edges": graph_bus.edges()})
        while True:
            event = await queue.get()
            await ws.send_json(event)
    except WebSocketDisconnect:
        pass
    finally:
        graph_bus.unsubscribe(queue)


@app.get("/api/lessons")
async def list_lessons(limit: int = 50):
    assert brain is not None
    return await brain.memory.list_lessons(limit=limit)


@app.get("/api/trends")
async def list_trends(limit: int = 14):
    assert brain is not None
    return await brain.memory.list_trend_reports(limit=limit)


@app.post("/api/memory/search")
async def memory_search(payload: dict):
    assert brain is not None
    q = payload.get("q", "")
    k = int(payload.get("k", 10))
    return await brain.memory.search(q, k=k)


@app.post("/api/selfmod/propose")
async def selfmod_propose(payload: dict):
    """
    Entry point for the self-modification loop (v0.3).
    Guarded: SELFMOD_ENABLED must be true AND the PR is voice-approved before merge.
    """
    if os.environ.get("SELFMOD_ENABLED", "false").lower() != "true":
        return {"ok": False, "reason": "SELFMOD_ENABLED is off"}
    assert brain is not None
    return await brain.propose_self_modification(payload.get("instruction", ""))
