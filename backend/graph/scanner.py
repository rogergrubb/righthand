"""
FileScanner — walks SCAN_ROOT, populates the graph with file/project nodes,
and watches for changes. Each change emits a pulse so the UI animates.
"""

from __future__ import annotations

import asyncio
import logging
import os
from pathlib import Path

from watchfiles import awatch

from graph.broadcaster import GraphBroadcaster

log = logging.getLogger("righthand.scanner")

IGNORE = {".git", "node_modules", "__pycache__", "venv", ".venv", "dist", "build", ".next"}
CODE_EXT = {".py", ".ts", ".tsx", ".js", ".jsx", ".sql", ".md", ".yml", ".yaml", ".json"}


class FileScanner:
    def __init__(self, root: str, bus: GraphBroadcaster) -> None:
        self.root = Path(root)
        self.bus = bus

    async def watch_forever(self) -> None:
        if not self.root.exists():
            log.warning("SCAN_ROOT %s does not exist — scanner idle.", self.root)
            return

        await self._initial_scan()
        log.info("Watching %s for changes…", self.root)
        try:
            async for changes in awatch(str(self.root), recursive=True):
                for change_type, path in changes:
                    p = Path(path)
                    if any(part in IGNORE for part in p.parts):
                        continue
                    await self.bus.pulse(kind="file.touch", label=p.name, node_id=str(p))
        except Exception as e:
            log.exception("watcher died: %s", e)

    async def _initial_scan(self) -> None:
        count = 0
        for p in self.root.rglob("*"):
            if any(part in IGNORE for part in p.parts):
                continue
            if not p.is_file():
                continue
            if p.suffix not in CODE_EXT:
                continue
            await self.bus.upsert_node(
                node_id=str(p),
                kind="file",
                label=p.name,
                meta={"path": str(p.relative_to(self.root)), "ext": p.suffix},
            )
            count += 1
            if count % 50 == 0:
                await asyncio.sleep(0)  # yield
        log.info("Initial scan: %d files indexed.", count)
