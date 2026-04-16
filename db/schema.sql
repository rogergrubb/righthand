-- RIGHTHAND initial schema
-- Single-user today, multi-tenant-ready from commit one.

CREATE EXTENSION IF NOT EXISTS vector;
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ========== Users ==========
CREATE TABLE IF NOT EXISTS users (
    id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    email       TEXT UNIQUE NOT NULL,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Bootstrap Roger as the default user.
INSERT INTO users (id, email)
VALUES ('00000000-0000-0000-0000-000000000001', 'roger@grubb.net')
ON CONFLICT (id) DO NOTHING;

-- ========== Conversations ==========
CREATE TABLE IF NOT EXISTS conversations (
    id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id     UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    started_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
    ended_at    TIMESTAMPTZ,
    transcript  JSONB NOT NULL DEFAULT '[]'::jsonb
);
CREATE INDEX IF NOT EXISTS idx_conv_user_started ON conversations(user_id, started_at DESC);

-- ========== Semantic memory (RAG) ==========
CREATE TABLE IF NOT EXISTS memory_chunks (
    id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id       UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    source_type   TEXT NOT NULL CHECK (source_type IN
                    ('conversation','file','lesson','trend','integration')),
    source_id     UUID,
    content       TEXT NOT NULL,
    embedding     VECTOR(1536),
    metadata      JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_mem_user ON memory_chunks(user_id);
CREATE INDEX IF NOT EXISTS idx_mem_embedding
    ON memory_chunks USING ivfflat (embedding vector_cosine_ops)
    WITH (lists = 100);

-- ========== Lessons learned (the moat) ==========
CREATE TABLE IF NOT EXISTS lessons_learned (
    id                      UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id                 UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    date                    DATE NOT NULL DEFAULT CURRENT_DATE,
    mistake                 TEXT NOT NULL,
    lesson                  TEXT NOT NULL,
    correction              TEXT,
    tags                    TEXT[] DEFAULT '{}',
    source_conversation_id  UUID REFERENCES conversations(id) ON DELETE SET NULL,
    created_at              TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_lessons_user_date ON lessons_learned(user_id, date DESC);
CREATE INDEX IF NOT EXISTS idx_lessons_tags ON lessons_learned USING GIN (tags);

-- ========== Daily trend reports ==========
CREATE TABLE IF NOT EXISTS trend_reports (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id         UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    date            DATE NOT NULL DEFAULT CURRENT_DATE,
    domain          TEXT NOT NULL CHECK (domain IN
                      ('tech','social_media','social_sciences','world_news','synthesis')),
    summary         TEXT NOT NULL,
    correlations    JSONB NOT NULL DEFAULT '{}'::jsonb,
    projection_1d   TEXT,
    projection_1w   TEXT,
    projection_1m   TEXT,
    projection_1y   TEXT,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_trends_user_date ON trend_reports(user_id, date DESC);

-- ========== Graph (nodes + edges) ==========
CREATE TABLE IF NOT EXISTS graph_nodes (
    id               UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id          UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    kind             TEXT NOT NULL CHECK (kind IN
                       ('file','project','system','person','lesson','trend')),
    label            TEXT NOT NULL,
    metadata         JSONB NOT NULL DEFAULT '{}'::jsonb,
    last_touched_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_nodes_user_kind ON graph_nodes(user_id, kind);

CREATE TABLE IF NOT EXISTS graph_edges (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id         UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    source_node_id  UUID NOT NULL REFERENCES graph_nodes(id) ON DELETE CASCADE,
    target_node_id  UUID NOT NULL REFERENCES graph_nodes(id) ON DELETE CASCADE,
    kind            TEXT NOT NULL CHECK (kind IN
                      ('imports','references','mentions','belongs_to')),
    weight          REAL NOT NULL DEFAULT 1.0
);
CREATE INDEX IF NOT EXISTS idx_edges_user ON graph_edges(user_id);
CREATE INDEX IF NOT EXISTS idx_edges_source ON graph_edges(source_node_id);
