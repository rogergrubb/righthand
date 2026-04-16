"""
lessons_daily — runs every night at LESSONS_DAILY_CRON.

Pulls the day's conversations, asks Claude to extract:
  - mistake  (what went wrong)
  - lesson   (what was learned)
  - correction (what to do differently)
  - tags

Writes each extraction to lessons_learned. These rows are the compounding moat.
"""

from __future__ import annotations

import json
import logging
from datetime import date, timedelta

from sqlalchemy import text

from brain.agent import RightHandBrain
from db.session import sessionmaker

log = logging.getLogger("righthand.lessons_daily")

EXTRACT_PROMPT = """\
You are extracting lessons-learned from a founder's conversations today.

For each distinct mistake or friction you find in the transcript below, emit one JSON
object with keys: mistake, lesson, correction, tags (array of strings). Return a JSON
array. If nothing is worth recording, return [].

TRANSCRIPT:
{transcript}
"""


async def run_lessons_daily(brain: RightHandBrain) -> None:
    today = date.today()
    yesterday = today - timedelta(days=1)

    async with sessionmaker()() as s:
        rows = (
            await s.execute(
                text(
                    """
                    SELECT transcript
                    FROM conversations
                    WHERE user_id = :uid
                      AND started_at::date = :d
                    """
                ),
                {"uid": brain.user_id, "d": yesterday},
            )
        ).mappings().all()

    transcript_blob = "\n\n".join(json.dumps(r["transcript"]) for r in rows) or "(no conversations)"
    if transcript_blob == "(no conversations)":
        log.info("lessons_daily: nothing to extract for %s", yesterday)
        return

    msg = await brain.client.messages.create(
        model=brain.reasoning_model,
        max_tokens=2048,
        system="You extract lessons from founder transcripts. Return ONLY valid JSON.",
        messages=[{"role": "user", "content": EXTRACT_PROMPT.format(transcript=transcript_blob[:60000])}],
    )
    raw = "".join(b.text for b in msg.content if getattr(b, "type", None) == "text").strip()

    try:
        entries = json.loads(raw)
    except json.JSONDecodeError:
        log.warning("lessons_daily: model returned non-JSON, skipping")
        return

    for e in entries:
        await brain.memory.record_lesson(
            mistake=e.get("mistake", ""),
            lesson=e.get("lesson", ""),
            correction=e.get("correction"),
            tags=e.get("tags", []),
        )
    log.info("lessons_daily: recorded %d lessons for %s", len(entries), yesterday)
