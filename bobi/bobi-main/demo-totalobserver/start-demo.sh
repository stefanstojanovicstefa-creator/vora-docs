#!/bin/bash
# start-demo.sh - Launch TotalObserver demo (agent + UI)

set -e

echo "🏢 Starting TotalObserver Demo..."

# Check if in correct directory
if [ ! -f "CLAUDE_CODE_SPEC.md" ]; then
  echo "⚠️  Run this script from demo-totalobserver directory"
  exit 1
fi

# Start agent in background
echo "🤖 Starting agent..."
cd agent
source ../../venv/bin/activate
python totalobserver_demo_agent.py dev &
AGENT_PID=$!
cd ..

# Wait for agent to initialize
echo "⏳ Waiting for agent to start..."
sleep 5

# Start UI in background
echo "🎨 Starting UI..."
cd demo-ui
npm run dev &
UI_PID=$!
cd ..

echo ""
echo "✅ Demo started!"
echo ""
echo "📍 Agent PID: $AGENT_PID"
echo "📍 UI PID: $UI_PID"
echo ""
echo "🌐 Demo UI: http://localhost:8080"
echo ""
echo "To stop demo:"
echo "  kill $AGENT_PID $UI_PID"
echo ""
