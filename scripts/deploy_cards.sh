#!/usr/bin/env bash
# Deploy GlimmerFall TCG FastAPI + WebSocket backend to the Oracle VM (isolated on 127.0.0.1:8100).
# Leaves the existing `glimmerfall` (glimmerfallonline on :8080) PM2 app untouched!
set -euo pipefail

KEY="${SSH_KEY:-$HOME/ssh-key.key}"
HOST="${ORACLE_HOST:-ubuntu@79.76.40.148}"
REMOTE_DIR="${REMOTE_DIR:-~/glimmerfall-cards}"

ssh -i "$KEY" "$HOST" "
  set -e
  if [ ! -d $REMOTE_DIR ]; then
    git clone https://github.com/EWilliamHertz/Glimmerfall2.git $REMOTE_DIR
  fi
  cd $REMOTE_DIR
  git pull --ff-only
  cd backend
  if [ ! -d .venv ]; then
    python3 -m venv .venv
  fi
  .venv/bin/pip install -q -r requirements.txt
  if [ -f .env ]; then
    set -a && . ./.env && set +a
    .venv/bin/python migrations/remodel_2026_11.py
  fi
  pm2 startOrReload ecosystem.config.cjs
  pm2 save
"
