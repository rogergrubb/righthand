#!/usr/bin/env bash
# RIGHTHAND one-shot bootstrap for fresh machines.
set -euo pipefail

if [ ! -f .env ]; then
  cp .env.example .env
  echo "Created .env — open it and fill in ANTHROPIC_API_KEY + OPENAI_API_KEY."
  exit 1
fi

docker-compose up --build
