#!/usr/bin/env bash
# KRATOS-PS1 — stop broker + engine + ghost
set -uo pipefail
cd "$(dirname "$0")/.."

for name in broker engine; do
  if [ -f "$name.pid" ] && kill -0 "$(cat "$name.pid")" 2>/dev/null; then
    kill "$(cat "$name.pid")" && echo "stopped $name"
  fi
  rm -f "$name.pid"
done

pkill -f "ghost/ghost.js" 2>/dev/null && echo "stopped ghost" || true
echo "done (broker.log / engine.log kept for post-mortem)"
