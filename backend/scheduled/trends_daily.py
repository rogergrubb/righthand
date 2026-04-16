"""
trends_daily — runs every morning at TRENDS_DAILY_CRON.

Claude researches four domains:
  - tech (cutting edge computer science, AI, infra)
  - social_media (what's going viral, platform shifts)
  - social_sciences (cultural / psychological / behavioral)
  - world_news (macro economic, geopolitical, regulatory)

Then runs a synthesis pass that finds correlations across the four domains and
projects them into 1-day / 1-week / 1-month / 1-year futures.

Output rows go into trend_reports. These are delivered as Roger's morning brief.
"""

from __future__ import annotations

import json
import logging

from brain.agent import RightHandBrain

log = logging.getLogger("righthand.trends_daily")

DOMAINS = ["tech", "social_media", "social_sciences", "world_news"]

DOMAIN_PROMPT = """\
Research the most important signals in the domain "{domain}" in the last 24 hours.
Output JSON with keys:
  summary         — 3–5 sentences of what matters
  correlations    — object of {{other_domain: how_it_connects}}
  projection_1d   — one sentence
  projection_1w   — one sentence
  projection_1m   — one sentence
  projection_1y   — one sentence
Return ONLY the JSON object.
"""

SYNTHESIS_PROMPT = """\
You are given four daily domain reports (tech, social_media, social_sciences, world_news).
Find the 3 highest-signal correlations across them and project how they compound over
1 day, 1 week, 1 month, 1 year. Favor correlations that materially affect a solopreneur
founder building an always-on personal AI assistant aiming for a $1B valuation.
Return JSON: {{summary, correlations, projection_1d, projection_1w, projection_1m, projection_1y}}.

REPORTS:
{reports_json}
"""


async def _one_domain(brain: RightHandBrain, domain: str) -> dict:
    msg = await brain.client.messages.create(
        model=brain.reasoning_model,
        max_tokens=1024,
        system="You are a research analyst. Return ONLY valid JSON.",
        messages=[{"role": "user", "content": DOMAIN_PROMPT.format(domain=domain)}],
    )
    raw = "".join(b.text for b in msg.content if getattr(b, "type", None) == "text").strip()
    try:
        return json.loads(raw)
    except json.JSONDecodeError:
        log.warning("trends_daily: %s returned non-JSON", domain)
        return {}


async def run_trends_daily(brain: RightHandBrain) -> None:
    reports: dict[str, dict] = {}

    for d in DOMAINS:
        r = await _one_domain(brain, d)
        if not r:
            continue
        reports[d] = r
        await brain.memory.record_trend_report(
            domain=d,
            summary=r.get("summary", ""),
            correlations=r.get("correlations", {}),
            projections={
                "1d": r.get("projection_1d"),
                "1w": r.get("projection_1w"),
                "1m": r.get("projection_1m"),
                "1y": r.get("projection_1y"),
            },
        )

    # Synthesis pass
    msg = await brain.client.messages.create(
        model=brain.reasoning_model,
        max_tokens=1536,
        system="You are the synthesis analyst. Return ONLY valid JSON.",
        messages=[{"role": "user", "content": SYNTHESIS_PROMPT.format(
            reports_json=json.dumps(reports)
        )}],
    )
    raw = "".join(b.text for b in msg.content if getattr(b, "type", None) == "text").strip()
    try:
        synth = json.loads(raw)
    except json.JSONDecodeError:
        log.warning("trends_daily: synthesis returned non-JSON, skipping")
        return

    await brain.memory.record_trend_report(
        domain="synthesis",
        summary=synth.get("summary", ""),
        correlations=synth.get("correlations", {}),
        projections={
            "1d": synth.get("projection_1d"),
            "1w": synth.get("projection_1w"),
            "1m": synth.get("projection_1m"),
            "1y": synth.get("projection_1y"),
        },
    )
    log.info("trends_daily: wrote %d domain reports + synthesis", len(reports))
