#!/bin/bash

# AI Task Platform - Quick Start Script

echo "=== AI Task Platform - Starting Services ==="
echo ""

# Check if MongoDB is running
echo "Checking MongoDB..."
if mongosh --version &>/dev/null; then
  if ! pgrep -x "mongod" > /dev/null; then
    echo "MongoDB not running. Start with: mongod --dbpath=/path/to/data"
  else
    echo "✓ MongoDB is running"
  fi
else
  echo "MongoDB not installed"
fi

echo ""

# Check if Redis is running
echo "Checking Redis..."
if redis-cli ping &>/dev/null; then
  echo "✓ Redis is running"
else
  echo "Redis not running. Start with: redis-server"
fi

echo ""
echo "=== Starting Backend ==="
cd backend
npm install 2>/dev/null || true
npm run dev &
BACKEND_PID=$!
echo "✓ Backend started (PID: $BACKEND_PID)"

echo ""
echo "=== Starting Frontend ==="
cd ../frontend
npm install 2>/dev/null || true
npm run dev &
FRONTEND_PID=$!
echo "✓ Frontend started (PID: $FRONTEND_PID)"

echo ""
echo "=== Starting Worker ==="
cd ../worker
pip3 install -q -r requirements.txt 2>/dev/null || true
python3 worker.py &
WORKER_PID=$!
echo "✓ Worker started (PID: $WORKER_PID)"

echo ""
echo "=== Services Running ==="
echo "Backend: http://localhost:5000"
echo "Frontend: http://localhost:5173"
echo "Worker: Processing tasks from Redis queue"
echo ""
echo "Press Ctrl+C to stop all services"

# Trap Ctrl+C and kill all background processes
trap "kill $BACKEND_PID $FRONTEND_PID $WORKER_PID 2>/dev/null; echo 'Services stopped'; exit" INT

wait
