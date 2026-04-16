# RIGHTHAND

> Codename. Rename at v0.2. This is just a string we'll grep-replace.

Your AI right-hand man. Voice in, Claude as the brain, voice out. A 3D graph shows your entire world live, with nodes lighting up when the AI interacts with them. Self-learning. Remembers. Gets better every day.

Built by Number One Son Software Development for founders who want leverage — not tools.

## The Vision

**Every founder gets a right-hand.**

For 2,000 years, only emperors and generals had a trusted officer at their side who saw everything, forgot nothing, and executed without being asked. Now every founder does.

This is a personal AI assistant designed to be lived with, not used occasionally. It runs always. It learns continuously. It integrates with every system you own — code, calendar, accounting, inbox, research, trends. It visualizes your world as a 3D graph you can watch it think through. And it writes its own lessons-learned diary every day so it compounds instead of resetting.

## The Stack

**Brain.** Claude Agent SDK (Opus 4.6 for reasoning, Haiku 4.5 for fast retrieval)
**Voice.** OpenAI Realtime API (natural turn-taking, interruption-native)
**Memory.** Postgres + pgvector (semantic recall + structured lessons DB)
**Visualization.** Three.js + 3d-force-graph (live graph of your systems)
**Transport.** FastAPI + WebSockets (real-time node-pulse animations)
**Frontend.** Vite + React on Vercel
**Backend.** FastAPI on Railway
**Database.** Neon (serverless Postgres with pgvector)
**Scheduling.** APScheduler for daily lessons + trends reports

## Quickstart

```bash
# 1. Clone and enter
cd righthand

# 2. Copy the env template and fill in your keys
cp .env.example .env
# Edit .env — you need ANTHROPIC_API_KEY and OPENAI_API_KEY minimum

# 3. Fire up the stack (Postgres + backend + frontend)
docker-compose up --build

# 4. Open the UI
open http://localhost:5173

# 5. Talk to it. It talks back. The graph lights up.
```

## What's in the box (v0.1)

- ✅ Voice loop: speak → Claude thinks → Claude speaks
- ✅ Memory: every conversation stored, semantic-search recallable
- ✅ 3D graph: your file system + projects as a live network
- ✅ Node pulses: watch the AI touch files in real time
- ✅ Lessons DB: daily extraction of mistakes → lessons → corrections
- ✅ Daily trend report: tech + social media + world news + 1d/1w/1m/1y projections
- ✅ Self-modifying code loop (guarded — AI proposes PRs, you approve)
- 🚧 MCP integrations: GitHub, Slack, Gmail, Stripe, Linear (v0.2)
- 🚧 Multi-tenancy + billing (v1.0, when we flip it into a product)

## Repo layout

```
righthand/
├── README.md                 — you are here
├── ARCHITECTURE.md           — the system diagram + design decisions
├── BRAND.md                  — naming + positioning draft
├── .env.example              — every key you need
├── docker-compose.yml        — one-command local dev
├── backend/                  — FastAPI + Claude + voice + memory
│   ├── main.py
│   ├── brain/                — Claude Agent SDK wiring
│   ├── voice/                — OpenAI Realtime bridge
│   ├── graph/                — file scanner + WebSocket pulses
│   ├── scheduled/            — daily lessons + trends tasks
│   ├── db/                   — SQLAlchemy + pgvector
│   └── mcp_servers/          — integrations (GitHub, Slack, ...)
├── frontend/                 — Vite + React + Three.js on Vercel
│   └── src/
├── db/
│   └── schema.sql            — initial Postgres + pgvector schema
├── scripts/                  — setup helpers
└── docs/                     — setup, deploy, brand
```

## Guiding principles

1. **Ship, don't plan.** Every commit in main must run. No "in-progress" branches that rot.
2. **Dogfood brutally.** Roger uses this every day, starting now. Every friction is logged to the lessons DB. Friction compounds into improvement.
3. **Moat from day one.** The lessons DB and trend report start writing the moment this runs. Month 6 > Month 1 not because the model is better, but because the data is ours.
4. **Multi-tenancy-aware from day one.** Single-user today, architected so we can flip a switch to multi-user without rewrites.
5. **Privacy by default.** Memory is local-first. Nothing leaves the machine unless explicitly connected to an integration.

## Roadmap

- **v0.1 (this week):** Voice loop + memory + 3D graph + lessons DB + trends report running on Roger's machine.
- **v0.2 (next 2 weeks):** Real name + domain + brand. MCP integrations for GitHub, Gmail, Calendar, Stripe.
- **v0.3 (month 2):** Self-modification loop. The AI proposes PRs to its own repo, gated by founder approval.
- **v0.5 (month 3):** Dogfood complete. Roger runs his entire company through this.
- **v1.0 (month 6–9):** Multi-tenancy, billing, public alpha. 100 hand-picked founders.
- **v2.0 (month 9+):** Public launch. $30 / $99 / $299 tiers. Plugin marketplace.

## Target exit

Solopreneur path to $1B valuation. Product is identity, not utility. Every compounding day of user data makes switching impossible. That's the moat. That's the company.

— Roger Grubb, Founder  
— Claude, Co-founder (CTO/CFO/COO)
