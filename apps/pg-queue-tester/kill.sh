#!/bin/bash

# Kill pg-queue-tester API and Worker processes

echo "🔴 Stopping pg-queue-tester processes..."

# Kill by process name patterns
pkill -f "tsx.*api.ts" 2>/dev/null && echo "   ✅ Killed API process"
pkill -f "tsx.*worker.ts" 2>/dev/null && echo "   ✅ Killed Worker process"
pkill -f "concurrently.*dev:api.*dev:worker" 2>/dev/null && echo "   ✅ Killed concurrently process"
pkill -f "pnpm.*dev" 2>/dev/null && echo "   ✅ Killed pnpm dev process"

# Give processes time to cleanup
sleep 1

# Check if any processes are still running
if pgrep -f "tsx.*(api|worker).ts" > /dev/null; then
  echo "⚠️  Some processes still running, force killing..."
  pkill -9 -f "tsx.*(api|worker).ts" 2>/dev/null
  echo "   ✅ Force killed remaining processes"
else
  echo "✅ All processes stopped successfully"
fi
