# ARCHITECTURE

## System diagram

```
   ┌────────────────────────────────────────────────────┐
   │                   BROWSER (Vercel)                 │
   │                                                    │
   │  ┌────────────┐   ┌──────────────────────────────┐ │
   │  │  Voice UI  │   │  3D Force Graph (Three.js)   │ │
   │  │ (WebRTC)   │   │  nodes = files / systems     │ │
   │  └─────┬──────┘   └──────────────┬───────────────┘ │
   │        │                         │                 │
   └────────┼─────────────────────────┼─────────────────┘
            │ WebSocket (audio frames)│ WebSocket (node pulses)
            ▼                         ▲
   ┌────────────────────────────────────────────────────┐
   │               BACKEND (Railway)                    │
   │                                                    │
   │  ┌──────────────┐   ┌──────────────────────────┐  │
   │  │ Voice Bridge │──▶│   Claude Agent SDK       │  │
   │  │ (OpenAI      │   │   - Opus 4.6 reasoning   │  │
   │  │  Realtime)   │◀──│   - Haiku 4.5 retrieval  │  │
   │  └──────────────┘   │   - Tool use             │  │
   │                     │   - Subagents            │  │
   │                     └────┬─────────────┬───────┘  │
   │                          │             │          │
   │           ┌──────────────▼───┐  ┌──────▼────────┐ │
   │           │  Memory (RAG)    │  │ File System   │ │
   │           │  pgvector search │  │ scanner       │ │
   │           └──────────────────┘  │ + watcher     │ │
   │                                 └───────────────┘ │
   │                                                    │
   │  ┌──────────────────────┐  ┌────────────────────┐ │
   │  │  Scheduled Tasks     │  │   MCP Servers      │ │
   │  │ - lessons_daily.py   │  │ - GitHub           │ │
   │  │ - trends_daily.py    │  │ - Gmail            │ │
   │  └──────────────────────┘  │ - Slack / Stripe   │ │
   │                            └────────────────────┘ │
   └────────────────────────┬───────────────────────────┘
                            │
                            ▼
           ┌────────────────────────────────┐
           │    Postgres + pgvector (Neon)  │
           │   - conversations              │
           │   - memory_chunks (embeddings) │
           │   - lessons_learned            │
           │   - trend_reports              │
           │   - graph_nodes / graph_edges  │
           └────────────────────────────────┘
```

## Key design decisions

### Voice: OpenAI Realtime API (not Whisper + TTS)

The Jarno Surakka reference build confirms this is worth the token cost (~$0.01/turn for audio vs pennies for STT+TTS). The UX leap from turn-taking VAD and native interruption is the difference between "demo" and "something you'd live with." We pay the premium. Fallback stub exists for local Whisper + Piper when users want offline/cheap mode.

### Brain: Claude Agent SDK (not raw API)

The Agent SDK gives us proper tool use, subagents, and MCP connectors out of the box. We don't roll our own agent loop. Claude Opus 4.6 handles reasoning and multi-step planning; Haiku 4.5 handles fast memory retrieval and routing. This is the only way to keep costs sane at always-on usage.

### Memory: Postgres + pgvector (not a vector DB service)

pgvector is the right call for a single-tenant founder tool. One database, one connection string, SQL we can query ourselves, relational integrity between conversations / lessons / trends / graph nodes. Upgrade path exists if we hit scale — but Neon's serverless Postgres scales to thousands of users before we need anything fancier.

### Visualization: 3d-force-graph (Jarno's choice, validated)

Three.js is the universal substrate. 3d-force-graph handles the physics and WebGL wiring so we can focus on the node taxonomy. WebSocket pulses on touch are cheap to implement and give the "AI thinking in real time" UX that sells the product to every visitor.

### Hosting: Vercel + Railway + Neon (not all-Vercel)

Vercel is perfect for the frontend and marketing site (edge-deployed, instant rollbacks, zero infra work). But Vercel's serverless model is wrong for long-lived WebSocket connections and stateful voice sessions — those need an always-on process. Railway ($5–20/mo) runs the backend brain with persistent state. Neon (free tier start) handles Postgres with pgvector. Total starting infra: ~$25/mo.

### Multi-tenancy: architected from day one, disabled until v1.0

Every database row has a `user_id` column from commit one, even though today it's always the same UUID. When we flip to multi-user in v1.0, we're not rewriting — we're toggling auth on and partitioning queries. Saves three months of painful refactor at the worst possible moment.

## Data model (v0.1)

```sql
users
  id (uuid pk)
  email
  created_at

conversations
  id (uuid pk)
  user_id (fk)
  started_at
  ended_at
  transcript (jsonb)

memory_chunks
  id (uuid pk)
  user_id (fk)
  source_type (enum: conversation | file | lesson | trend | integration)
  source_id (uuid)
  content (text)
  embedding (vector(1536))
  metadata (jsonb)
  created_at

lessons_learned
  id (uuid pk)
  user_id (fk)
  date (date)
  mistake (text)
  lesson (text)
  correction (text)
  tags (text[])
  source_conversation_id (fk nullable)
  created_at

trend_reports
  id (uuid pk)
  user_id (fk)
  date (date)
  domain (enum: tech | social_media | social_sciences | world_news)
  summary (text)
  correlations (jsonb)
  projection_1d (text)
  projection_1w (text)
  projection_1m (text)
  projection_1y (text)

graph_nodes
  id (uuid pk)
  user_id (fk)
  kind (enum: file | project | system | person | lesson | trend)
  label (text)
  metadata (jsonb)
  last_touched_at

graph_edges
  id (uuid pk)
  user_id (fk)
  source_node_id (fk)
  target_node_id (fk)
  kind (enum: imports | references | mentions | belongs_to)
  weight (float)
```

## Self-modification loop (v0.3, guarded)

The Jarno demo's most impressive trick was the AI modifying its own code through 10 iterative commits. We want this. But we want it safe.

The flow:

1. User: *"Add a feature that does X."*
2. Claude reads its own codebase (via file tools).
3. Claude forms a plan and writes it to a PR branch.
4. Claude runs tests in Docker.
5. If tests pass, Claude opens a PR on GitHub and asks the user for voice approval.
6. User says "dew it" → merge + deploy.
7. User says "no" → Claude iterates or abandons.

No auto-merge to main. No auto-deploy without voice confirmation. Roger's "dew it" is the kill switch.

## Cost model (v0.1, single user)

| Item | Monthly |
|------|---------|
| Vercel (Hobby) | Free |
| Railway (Hobby) | $5 |
| Neon (Free tier) | Free |
| Anthropic API (heavy usage) | $50–200 |
| OpenAI Realtime (voice) | $30–100 |
| Domain | ~$1 (annualized) |
| **Total** | **~$100–300/mo** |

Gross margin calculation (for v1.0 pricing):
At $30/mo consumer tier with light usage (~$20/mo COGS), margin is 33%. At $99/mo pro tier with heavy usage (~$40/mo COGS), margin is 60%. Both are healthy SaaS numbers. Pricing confirmed viable.

## Security posture

- All API keys in environment variables; none committed.
- Voice audio streams are ephemeral — not stored unless user opts in.
- Database-level row security when multi-tenancy ships.
- No telemetry in v0.1. Observability added in v0.3 via a single PostHog project.
- Self-modification PRs require voice approval. No silent code changes ever.
