#!/bin/bash
# Exit immediately if a command exits with a non-zero status
set -e

# Kill all background processes started by this script when exiting (Ctrl+C)
trap "kill 0" EXIT

echo "==========================================="
echo "   Starting GlimmerFall2 Dev Environment   "
echo "==========================================="

echo ""
echo "[1/4] Installing Python Backend Dependencies..."
cd backend
if [ -x .venv/bin/pip ]; then
  .venv/bin/pip install -r requirements.txt
else
  pip install -r requirements.txt
fi
cd ..

echo ""
echo "[2/4] Installing React Frontend Dependencies..."
cd frontend
npm install --legacy-peer-deps
cd ..

echo ""
echo "[3/4] Starting Python Backend Server (Port 8000)..."
cd backend
if [ -x .venv/bin/python ]; then
  .venv/bin/python -m uvicorn server:app --port 8000 &
else
  uvicorn server:app --port 8000 &
fi
cd ..

echo ""
echo "[4/4] Starting React Frontend Server (Port 3000)..."
cd frontend
npm start
