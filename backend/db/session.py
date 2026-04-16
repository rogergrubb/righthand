"""Async SQLAlchemy engine + session factory."""

from __future__ import annotations

import os
from typing import AsyncIterator

from sqlalchemy.ext.asyncio import (
    AsyncEngine,
    AsyncSession,
    async_sessionmaker,
    create_async_engine,
)

_engine: AsyncEngine | None = None
_sessionmaker: async_sessionmaker[AsyncSession] | None = None


def _dsn() -> str:
    url = os.environ["DATABASE_URL"]
    # SQLAlchemy needs the +asyncpg driver
    if url.startswith("postgresql://"):
        url = url.replace("postgresql://", "postgresql+asyncpg://", 1)
    return url


async def init_db() -> None:
    global _engine, _sessionmaker
    _engine = create_async_engine(_dsn(), pool_pre_ping=True, echo=False)
    _sessionmaker = async_sessionmaker(_engine, expire_on_commit=False)


async def dispose_db() -> None:
    if _engine is not None:
        await _engine.dispose()


def sessionmaker() -> async_sessionmaker[AsyncSession]:
    assert _sessionmaker is not None, "init_db() not called"
    return _sessionmaker


async def session_scope() -> AsyncIterator[AsyncSession]:
    async with sessionmaker()() as s:
        yield s
